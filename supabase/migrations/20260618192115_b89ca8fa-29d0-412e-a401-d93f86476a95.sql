
-- Extend report_templates
ALTER TABLE public.report_templates
  ADD COLUMN IF NOT EXISTS layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS schedule_cron text,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_export_url text;

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.tg_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_action text := lower(TG_OP);
  v_id uuid;
  v_struct uuid;
  v_diff jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id := (to_jsonb(OLD)->>'id')::uuid;
    BEGIN v_struct := (to_jsonb(OLD)->>'structure_id')::uuid; EXCEPTION WHEN OTHERS THEN v_struct := NULL; END;
    v_diff := jsonb_build_object('old', to_jsonb(OLD));
  ELSE
    v_id := (to_jsonb(NEW)->>'id')::uuid;
    BEGIN v_struct := (to_jsonb(NEW)->>'structure_id')::uuid; EXCEPTION WHEN OTHERS THEN v_struct := NULL; END;
    IF TG_OP = 'UPDATE' THEN
      v_diff := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    ELSE
      v_diff := jsonb_build_object('new', to_jsonb(NEW));
    END IF;
  END IF;
  INSERT INTO public.audit_log(structure_id, user_id, entity_type, entity_id, action, diff)
  VALUES (v_struct, v_user, TG_TABLE_NAME, v_id, v_action, v_diff);
  RETURN COALESCE(NEW, OLD);
END $$;

-- Allow audit inserts from trigger (system-generated)
DROP POLICY IF EXISTS "audit_insert_self" ON public.audit_log;
CREATE POLICY "audit_insert_any" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Attach triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sla_rules','penalty_rules','module_permissions','user_delegations','report_templates','sla_violations','invoices'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log()', t, t);
  END LOOP;
END $$;
