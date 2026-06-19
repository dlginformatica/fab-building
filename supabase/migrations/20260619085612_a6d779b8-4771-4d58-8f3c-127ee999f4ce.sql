
CREATE TABLE IF NOT EXISTS public.reorder_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reorder_id uuid NOT NULL REFERENCES public.reorder_requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  from_status reorder_status,
  to_status reorder_status NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reorder_events TO authenticated;
GRANT ALL ON public.reorder_events TO service_role;
ALTER TABLE public.reorder_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reorder_events_read" ON public.reorder_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reorder_requests r WHERE r.id = reorder_id AND public.has_structure_access(auth.uid(), r.structure_id)));
CREATE POLICY "reorder_events_insert" ON public.reorder_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.reorder_requests r WHERE r.id = reorder_id AND public.has_structure_access(auth.uid(), r.structure_id)));

CREATE TABLE IF NOT EXISTS public.reorder_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reorder_id uuid NOT NULL REFERENCES public.reorder_requests(id) ON DELETE CASCADE,
  structure_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('ordine','ddt','fattura','altro')),
  file_path text NOT NULL,
  file_name text,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.reorder_attachments TO authenticated;
GRANT ALL ON public.reorder_attachments TO service_role;
ALTER TABLE public.reorder_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reorder_att_access" ON public.reorder_attachments FOR ALL TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id) AND uploaded_by = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_log_reorder_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.reorder_events(reorder_id, actor_id, from_status, to_status, note)
    VALUES (NEW.id, auth.uid(), NULL, NEW.status, 'Creato');
  ELSIF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.reorder_events(reorder_id, actor_id, from_status, to_status, note)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status, NULL);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_reorder_status ON public.reorder_requests;
CREATE TRIGGER trg_reorder_status AFTER INSERT OR UPDATE ON public.reorder_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_reorder_status();

DROP POLICY IF EXISTS "reorders_bucket_read" ON storage.objects;
CREATE POLICY "reorders_bucket_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='reorders' AND public.has_structure_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS "reorders_bucket_write" ON storage.objects;
CREATE POLICY "reorders_bucket_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='reorders' AND public.has_structure_access(auth.uid(), ((storage.foldername(name))[1])::uuid) AND owner = auth.uid());
DROP POLICY IF EXISTS "reorders_bucket_delete" ON storage.objects;
CREATE POLICY "reorders_bucket_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='reorders' AND public.has_structure_access(auth.uid(), ((storage.foldername(name))[1])::uuid) AND owner = auth.uid());

ALTER TABLE public.sla_rules
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS area cost_area,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.apply_sla_on_ticket()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE rule record;
BEGIN
  IF NEW.ack_due_at IS NULL OR NEW.resolve_due_at IS NULL THEN
    SELECT ack_minutes, resolve_minutes INTO rule
    FROM public.sla_rules
    WHERE enabled = true
      AND priority = NEW.priority
      AND (structure_id = NEW.structure_id OR structure_id IS NULL)
      AND (category_id = NEW.category_id OR category_id IS NULL)
      AND (area = NEW.area OR area IS NULL)
    ORDER BY (structure_id IS NOT NULL) DESC, (area IS NOT NULL) DESC, (category_id IS NOT NULL) DESC
    LIMIT 1;
    IF rule.ack_minutes IS NOT NULL THEN
      NEW.ack_due_at := COALESCE(NEW.ack_due_at, COALESCE(NEW.created_at, now()) + (rule.ack_minutes || ' minutes')::interval);
      NEW.resolve_due_at := COALESCE(NEW.resolve_due_at, COALESCE(NEW.created_at, now()) + (rule.resolve_minutes || ' minutes')::interval);
    END IF;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_apply_sla ON public.tickets;
CREATE TRIGGER trg_apply_sla BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.apply_sla_on_ticket();

DROP TRIGGER IF EXISTS trg_inherit_area_tickets ON public.tickets;
CREATE TRIGGER trg_inherit_area_tickets BEFORE INSERT OR UPDATE OF asset_id ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_inherit_area_from_asset();
DROP TRIGGER IF EXISTS trg_inherit_area_wo ON public.work_orders;
CREATE TRIGGER trg_inherit_area_wo BEFORE INSERT OR UPDATE OF asset_id ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_inherit_area_from_asset();

ALTER TABLE public.cost_centers ADD COLUMN IF NOT EXISTS area cost_area;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS qr_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS qr_generated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.asset_qr_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  structure_id uuid,
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('generated','rotated','revoked','reactivated')),
  old_token text,
  new_token text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.asset_qr_audit TO authenticated;
GRANT ALL ON public.asset_qr_audit TO service_role;
ALTER TABLE public.asset_qr_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qr_audit_read" ON public.asset_qr_audit FOR SELECT TO authenticated
  USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));

CREATE OR REPLACE FUNCTION public.tg_audit_qr() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_action text;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.qr_token IS DISTINCT FROM OLD.qr_token THEN
      v_action := CASE WHEN OLD.qr_token IS NULL THEN 'generated' ELSE 'rotated' END;
      INSERT INTO public.asset_qr_audit(asset_id, structure_id, actor_id, action, old_token, new_token)
      VALUES (NEW.id, NEW.structure_id, auth.uid(), v_action, OLD.qr_token, NEW.qr_token);
    END IF;
    IF NEW.qr_revoked_at IS DISTINCT FROM OLD.qr_revoked_at THEN
      v_action := CASE WHEN NEW.qr_revoked_at IS NULL THEN 'reactivated' ELSE 'revoked' END;
      INSERT INTO public.asset_qr_audit(asset_id, structure_id, actor_id, action, old_token, new_token)
      VALUES (NEW.id, NEW.structure_id, auth.uid(), v_action, OLD.qr_token, NEW.qr_token);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_audit_qr ON public.assets;
CREATE TRIGGER trg_audit_qr AFTER UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_qr();
