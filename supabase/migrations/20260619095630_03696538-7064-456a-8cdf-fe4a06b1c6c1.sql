
-- ============== SLA NOTIFICATIONS ==============
CREATE TABLE public.sla_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('warning_ack','warning_resolve','violated_ack','violated_resolve')),
  due_at timestamptz,
  delay_minutes int,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel text NOT NULL DEFAULT 'in_app',
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sla_notif_ticket ON public.sla_notifications(ticket_id);
CREATE INDEX idx_sla_notif_struct ON public.sla_notifications(structure_id, created_at DESC);
CREATE UNIQUE INDEX uniq_sla_notif_kind ON public.sla_notifications(ticket_id, kind);

GRANT SELECT, INSERT, UPDATE ON public.sla_notifications TO authenticated;
GRANT ALL ON public.sla_notifications TO service_role;
ALTER TABLE public.sla_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_notif_select" ON public.sla_notifications FOR SELECT TO authenticated
  USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY "sla_notif_ack" ON public.sla_notifications FOR UPDATE TO authenticated
  USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
-- INSERT solo via trigger SECURITY DEFINER → nessuna policy INSERT esplicita; revoca diretta:
REVOKE INSERT ON public.sla_notifications FROM authenticated;

-- Trigger: alla violazione, crea notifica violated_resolve
CREATE OR REPLACE FUNCTION public.tg_sla_violation_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.sla_notifications(ticket_id, structure_id, kind, due_at, delay_minutes, payload)
  VALUES (NEW.ticket_id, NEW.structure_id,
    CASE WHEN NEW.kind = 'risoluzione' THEN 'violated_resolve' ELSE 'violated_ack' END,
    NULL, NEW.delay_minutes,
    jsonb_build_object('penalty_eur', NEW.penalty_eur, 'rule_id', NEW.rule_id))
  ON CONFLICT (ticket_id, kind) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sla_violation_notify ON public.sla_violations;
CREATE TRIGGER sla_violation_notify
  AFTER INSERT ON public.sla_violations
  FOR EACH ROW EXECUTE FUNCTION public.tg_sla_violation_notify();

-- Funzione di scan warning (callable via cron pg_cron diretto)
CREATE OR REPLACE FUNCTION public.enqueue_sla_warnings(p_threshold_minutes int DEFAULT 30)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_count int := 0;
  v_rec record;
BEGIN
  -- warning_resolve
  FOR v_rec IN
    SELECT t.id, t.structure_id, t.resolve_due_at
    FROM public.tickets t
    WHERE t.resolved_at IS NULL
      AND t.status NOT IN ('chiuso','annullato')
      AND t.resolve_due_at IS NOT NULL
      AND t.resolve_due_at <= now() + (p_threshold_minutes || ' minutes')::interval
      AND t.resolve_due_at > now()
  LOOP
    INSERT INTO public.sla_notifications(ticket_id, structure_id, kind, due_at, payload)
    VALUES (v_rec.id, v_rec.structure_id, 'warning_resolve', v_rec.resolve_due_at,
      jsonb_build_object('threshold_minutes', p_threshold_minutes))
    ON CONFLICT (ticket_id, kind) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END LOOP;

  -- warning_ack
  FOR v_rec IN
    SELECT t.id, t.structure_id, t.ack_due_at
    FROM public.tickets t
    WHERE t.ack_at IS NULL
      AND t.status NOT IN ('chiuso','annullato')
      AND t.ack_due_at IS NOT NULL
      AND t.ack_due_at <= now() + (p_threshold_minutes || ' minutes')::interval
      AND t.ack_due_at > now()
  LOOP
    INSERT INTO public.sla_notifications(ticket_id, structure_id, kind, due_at, payload)
    VALUES (v_rec.id, v_rec.structure_id, 'warning_ack', v_rec.ack_due_at,
      jsonb_build_object('threshold_minutes', p_threshold_minutes))
    ON CONFLICT (ticket_id, kind) DO NOTHING;
  END LOOP;

  RETURN v_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.enqueue_sla_warnings(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_sla_warnings(int) TO service_role;

-- ============== ASSET DOCUMENTS ==============
CREATE TABLE public.asset_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'altro'
    CHECK (category IN ('libretto','certificazione','manuale','garanzia','collaudo','schema','dichiarazione_conformita','verbale_ispezione','altro')),
  title text NOT NULL,
  description text,
  file_path text NOT NULL,
  mime text,
  file_size_kb int,
  version int NOT NULL DEFAULT 1,
  superseded_by uuid REFERENCES public.asset_documents(id) ON DELETE SET NULL,
  issued_at date,
  expires_at date,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_asset_docs_asset ON public.asset_documents(asset_id);
CREATE INDEX idx_asset_docs_struct ON public.asset_documents(structure_id);
CREATE INDEX idx_asset_docs_expires ON public.asset_documents(expires_at) WHERE expires_at IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_documents TO authenticated;
GRANT ALL ON public.asset_documents TO service_role;
ALTER TABLE public.asset_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_docs_select" ON public.asset_documents FOR SELECT TO authenticated
  USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY "asset_docs_insert" ON public.asset_documents FOR INSERT TO authenticated
  WITH CHECK ((structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id)) AND uploaded_by = auth.uid());
CREATE POLICY "asset_docs_update" ON public.asset_documents FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (uploaded_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "asset_docs_delete" ON public.asset_documents FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER asset_docs_set_updated BEFORE UPDATE ON public.asset_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-inherit structure_id da asset
CREATE OR REPLACE FUNCTION public.tg_asset_doc_inherit_struct()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.structure_id IS NULL AND NEW.asset_id IS NOT NULL THEN
    SELECT structure_id INTO NEW.structure_id FROM public.assets WHERE id = NEW.asset_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER asset_docs_inherit_struct BEFORE INSERT ON public.asset_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_asset_doc_inherit_struct();

-- ============== ASSET MEDIA (foto/video) ==============
CREATE TABLE public.asset_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image','video')),
  title text,
  caption text,
  file_path text NOT NULL,
  thumbnail_path text,
  mime text,
  file_size_kb int,
  taken_at timestamptz,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_asset_media_asset ON public.asset_media(asset_id);
CREATE INDEX idx_asset_media_struct ON public.asset_media(structure_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_media TO authenticated;
GRANT ALL ON public.asset_media TO service_role;
ALTER TABLE public.asset_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_media_select" ON public.asset_media FOR SELECT TO authenticated
  USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY "asset_media_insert" ON public.asset_media FOR INSERT TO authenticated
  WITH CHECK ((structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id)) AND uploaded_by = auth.uid());
CREATE POLICY "asset_media_update" ON public.asset_media FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (uploaded_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "asset_media_delete" ON public.asset_media FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_asset_media_inherit_struct()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.structure_id IS NULL AND NEW.asset_id IS NOT NULL THEN
    SELECT structure_id INTO NEW.structure_id FROM public.assets WHERE id = NEW.asset_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER asset_media_inherit_struct BEFORE INSERT ON public.asset_media
  FOR EACH ROW EXECUTE FUNCTION public.tg_asset_media_inherit_struct();
