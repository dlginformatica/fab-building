CREATE TYPE public.notification_channel_type AS ENUM ('email','teams');
CREATE TYPE public.notification_event AS ENUM ('ticket_created','ticket_assigned','sla_warning','sla_violated','workflow_step','invoice_due','maintenance_due');

CREATE TABLE public.notification_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.notification_channel_type NOT NULL,
  target text NOT NULL,
  events public.notification_event[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_channels TO authenticated;
GRANT ALL ON public.notification_channels TO service_role;
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nc_select" ON public.notification_channels FOR SELECT TO authenticated
  USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY "nc_mod" ON public.notification_channels FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id)))
  WITH CHECK (public.is_admin(auth.uid()) AND (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id)));
CREATE TRIGGER tg_nc_upd BEFORE UPDATE ON public.notification_channels FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.notification_channels(id) ON DELETE SET NULL,
  event public.notification_event NOT NULL,
  channel_type public.notification_channel_type NOT NULL,
  target text NOT NULL,
  subject text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ok',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_log_struct_created ON public.notification_log(structure_id, created_at DESC);
GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nl_select" ON public.notification_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id)));