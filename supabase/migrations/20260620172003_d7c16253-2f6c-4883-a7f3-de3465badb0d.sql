
-- ============================================================
-- BACKUP / RESTORE / IMPORT MAPPING / RESET ORG
-- ============================================================

-- 1) backup_runs: registro audit di ogni backup
CREATE TABLE IF NOT EXISTS public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid,
  kind text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','scheduled','pre_restore','pre_reset')),
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed','in_progress')),
  format text NOT NULL DEFAULT 'json' CHECK (format IN ('json','zip','xlsx')),
  storage_bucket text,
  storage_path text,
  size_bytes bigint,
  schema_version int NOT NULL DEFAULT 1,
  tables_count int,
  rows_count int,
  snapshot_taken_at timestamptz NOT NULL DEFAULT now(),
  error_message text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup_runs select" ON public.backup_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.is_org_owner(auth.uid(), org_id));
CREATE POLICY "backup_runs insert" ON public.backup_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.is_org_owner(auth.uid(), org_id));
CREATE POLICY "backup_runs update" ON public.backup_runs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.is_org_owner(auth.uid(), org_id));
CREATE POLICY "backup_runs delete" ON public.backup_runs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.is_org_owner(auth.uid(), org_id));
CREATE INDEX IF NOT EXISTS idx_backup_runs_org_taken ON public.backup_runs(org_id, snapshot_taken_at DESC);

-- 2) backup_schedules
CREATE TABLE IF NOT EXISTS public.backup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  frequency text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily','weekly','monthly')),
  hour_utc int NOT NULL DEFAULT 2 CHECK (hour_utc BETWEEN 0 AND 23),
  weekday int CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),
  day_of_month int CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 28),
  retention_count int NOT NULL DEFAULT 10 CHECK (retention_count BETWEEN 1 AND 365),
  format text NOT NULL DEFAULT 'json',
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_schedules TO authenticated;
GRANT ALL ON public.backup_schedules TO service_role;
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup_schedules all" ON public.backup_schedules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.is_org_owner(auth.uid(), org_id))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.is_org_owner(auth.uid(), org_id));
CREATE TRIGGER trg_backup_schedules_updated BEFORE UPDATE ON public.backup_schedules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) restore_runs: audit di ogni restore
CREATE TABLE IF NOT EXISTS public.restore_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid,
  source_backup_id uuid REFERENCES public.backup_runs(id) ON DELETE SET NULL,
  source_filename text,
  mode text NOT NULL CHECK (mode IN ('merge','replace','point_in_time')),
  pit_target timestamptz,
  pit_resolved_to timestamptz,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed','partial')),
  rows_inserted int DEFAULT 0,
  errors_count int DEFAULT 0,
  error_message text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.restore_runs TO authenticated;
GRANT ALL ON public.restore_runs TO service_role;
ALTER TABLE public.restore_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restore_runs select" ON public.restore_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.is_org_owner(auth.uid(), org_id));
CREATE POLICY "restore_runs insert" ON public.restore_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.is_org_owner(auth.uid(), org_id));
CREATE POLICY "restore_runs update" ON public.restore_runs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.is_org_owner(auth.uid(), org_id));

-- 4) import_mappings: schemi di mappatura versionati
CREATE TABLE IF NOT EXISTS public.import_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_table text NOT NULL,
  name text NOT NULL,
  schema_version int NOT NULL DEFAULT 1,
  delimiter text,
  mapping jsonb NOT NULL,
  fields_snapshot jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_mappings TO authenticated;
GRANT ALL ON public.import_mappings TO service_role;
ALTER TABLE public.import_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_mappings all" ON public.import_mappings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR org_id IS NULL OR public.is_org_owner(auth.uid(), org_id))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.is_org_owner(auth.uid(), org_id));
CREATE TRIGGER trg_import_mappings_updated BEFORE UPDATE ON public.import_mappings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5) RPC: trova il backup più vicino a una data per point-in-time
CREATE OR REPLACE FUNCTION public.backup_nearest_to(_org uuid, _target timestamptz)
RETURNS public.backup_runs
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.backup_runs
   WHERE org_id = _org AND status = 'success' AND storage_path IS NOT NULL
     AND snapshot_taken_at <= _target
   ORDER BY snapshot_taken_at DESC
   LIMIT 1;
$$;

-- 6) RPC: registra backup (audit)
CREATE OR REPLACE FUNCTION public.backup_record(
  _org uuid, _kind text, _format text, _bucket text, _path text,
  _size bigint, _tables int, _rows int, _details jsonb DEFAULT '{}'::jsonb
) RETURNS public.backup_runs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.backup_runs;
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin') OR public.is_org_owner(auth.uid(), _org)) THEN
    RAISE EXCEPTION 'Permesso negato';
  END IF;
  INSERT INTO public.backup_runs(org_id, actor_id, kind, format, storage_bucket, storage_path, size_bytes, tables_count, rows_count, details)
  VALUES (_org, auth.uid(), _kind, _format, _bucket, _path, _size, _tables, _rows, COALESCE(_details,'{}'::jsonb))
  RETURNING * INTO v;
  RETURN v;
END $$;

-- 7) RPC: registra restore (audit)
CREATE OR REPLACE FUNCTION public.restore_record(
  _org uuid, _source_id uuid, _source_name text, _mode text,
  _pit timestamptz, _pit_resolved timestamptz,
  _status text, _rows int, _errors int, _details jsonb DEFAULT '{}'::jsonb,
  _err text DEFAULT NULL
) RETURNS public.restore_runs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.restore_runs;
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin') OR public.is_org_owner(auth.uid(), _org)) THEN
    RAISE EXCEPTION 'Permesso negato';
  END IF;
  INSERT INTO public.restore_runs(org_id, actor_id, source_backup_id, source_filename, mode, pit_target, pit_resolved_to, status, rows_inserted, errors_count, details, error_message)
  VALUES (_org, auth.uid(), _source_id, _source_name, _mode, _pit, _pit_resolved, _status, _rows, _errors, COALESCE(_details,'{}'::jsonb), _err)
  RETURNING * INTO v;
  RETURN v;
END $$;

-- 8) RPC: reset totale dati org (super admin)
-- Cancella dati operativi, ruoli, deleghe, audit, backup. Mantiene la riga in organizations, owner membership e subscription.
CREATE OR REPLACE FUNCTION public.super_admin_reset_org(_org uuid, _confirm text, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_owner uuid;
  v_struct_ids uuid[];
  v_paths text[] := ARRAY[]::text[];
  v_deleted jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Solo il super admin può eseguire il reset';
  END IF;
  SELECT name, owner_id INTO v_name, v_owner FROM public.organizations WHERE id = _org;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Organizzazione non trovata'; END IF;
  IF _confirm IS DISTINCT FROM v_name THEN RAISE EXCEPTION 'Conferma non valida: digita esattamente il nome organizzazione'; END IF;

  SELECT array_agg(id) INTO v_struct_ids FROM public.structures WHERE organization_id = _org;
  v_struct_ids := COALESCE(v_struct_ids, ARRAY[]::uuid[]);

  -- raccolta storage path da pulire client-side
  SELECT COALESCE(array_agg(storage_path), ARRAY[]::text[]) INTO v_paths
    FROM public.backup_runs WHERE org_id = _org AND storage_path IS NOT NULL;

  -- Cancellazioni a cascata sicure (alcune tabelle hanno FK on delete cascade)
  DELETE FROM public.backup_runs WHERE org_id = _org;
  DELETE FROM public.restore_runs WHERE org_id = _org;
  DELETE FROM public.backup_schedules WHERE org_id = _org;
  DELETE FROM public.import_mappings WHERE org_id = _org;
  DELETE FROM public.admin_alerts WHERE org_id = _org;
  DELETE FROM public.org_invitations WHERE org_id = _org;
  DELETE FROM public.org_notification_prefs WHERE org_id = _org;

  IF array_length(v_struct_ids,1) IS NOT NULL THEN
    -- ordine: prima i figli, poi le strutture
    DELETE FROM public.ticket_attachments WHERE ticket_id IN (SELECT id FROM public.tickets WHERE structure_id = ANY(v_struct_ids));
    DELETE FROM public.ticket_comments WHERE ticket_id IN (SELECT id FROM public.tickets WHERE structure_id = ANY(v_struct_ids));
    DELETE FROM public.ticket_reports WHERE ticket_id IN (SELECT id FROM public.tickets WHERE structure_id = ANY(v_struct_ids));
    DELETE FROM public.tickets WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.maintenance_tasks WHERE plan_id IN (SELECT id FROM public.maintenance_plans WHERE structure_id = ANY(v_struct_ids));
    DELETE FROM public.maintenance_plans WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.contract_attachments WHERE contract_id IN (SELECT id FROM public.contracts WHERE structure_id = ANY(v_struct_ids));
    DELETE FROM public.contract_renewals WHERE contract_id IN (SELECT id FROM public.contracts WHERE structure_id = ANY(v_struct_ids));
    DELETE FROM public.contracts WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.supplier_documents WHERE supplier_id IN (SELECT id FROM public.suppliers WHERE structure_id = ANY(v_struct_ids));
    DELETE FROM public.suppliers WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.inventory_movements WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.reorder_attachments WHERE reorder_id IN (SELECT id FROM public.reorder_requests WHERE structure_id = ANY(v_struct_ids));
    DELETE FROM public.reorder_events WHERE reorder_id IN (SELECT id FROM public.reorder_requests WHERE structure_id = ANY(v_struct_ids));
    DELETE FROM public.reorder_requests WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.inventory_items WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.purchase_orders WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.work_orders WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.meter_readings WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.utility_meters WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.invoices WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.cash_movements WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.asset_documents WHERE asset_id IN (SELECT id FROM public.assets WHERE structure_id = ANY(v_struct_ids));
    DELETE FROM public.asset_media WHERE asset_id IN (SELECT id FROM public.assets WHERE structure_id = ANY(v_struct_ids));
    DELETE FROM public.asset_history WHERE asset_id IN (SELECT id FROM public.assets WHERE structure_id = ANY(v_struct_ids));
    DELETE FROM public.asset_scans WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.asset_qr_audit WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.assets WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.housekeeping_tasks WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.guest_issues WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.rooms WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.floors WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.cost_centers WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.sla_rules WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.sla_escalation_rules WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.sla_notifications WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.sla_violations WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.notification_log WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.notification_templates WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.notification_channels WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.penalty_rules WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.module_permissions WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.user_delegations WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.user_roles WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.audit_log WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.access_denied_log WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.permission_audit WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.delegation_audit WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.report_templates WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.scheduled_exports WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.workflows WHERE structure_id = ANY(v_struct_ids);
    DELETE FROM public.structures WHERE id = ANY(v_struct_ids);
  END IF;

  v_deleted := jsonb_build_object('structures_deleted', COALESCE(array_length(v_struct_ids,1),0), 'storage_paths', to_jsonb(v_paths));

  INSERT INTO public.permission_audit(actor_id, entity, entity_id, action, after, reason)
  VALUES (auth.uid(), 'organization', _org, 'reset_org', v_deleted, COALESCE(_note, 'Reset totale dati org'));

  RETURN v_deleted;
END $$;

GRANT EXECUTE ON FUNCTION public.backup_nearest_to(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.backup_record(uuid, text, text, text, text, bigint, int, int, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_record(uuid, uuid, text, text, timestamptz, timestamptz, text, int, int, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_reset_org(uuid, text, text) TO authenticated;
