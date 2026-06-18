-- 1) Ticket attachments
CREATE TABLE public.ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes bigint,
  kind text NOT NULL DEFAULT 'photo', -- photo|document|report
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_attachments TO authenticated;
GRANT ALL ON public.ticket_attachments TO service_role;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_select" ON public.ticket_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND public.has_structure_access(auth.uid(), t.structure_id)));
CREATE POLICY "att_insert" ON public.ticket_attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND public.has_structure_access(auth.uid(), t.structure_id)));
CREATE POLICY "att_delete" ON public.ticket_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_admin(auth.uid()));

-- 2) Videocall rooms (Jitsi)
CREATE TABLE public.videocall_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  room_name text NOT NULL UNIQUE,
  topic text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videocall_rooms TO authenticated;
GRANT ALL ON public.videocall_rooms TO service_role;
ALTER TABLE public.videocall_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vc_select" ON public.videocall_rooms FOR SELECT TO authenticated
  USING (public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY "vc_insert" ON public.videocall_rooms FOR INSERT TO authenticated
  WITH CHECK (public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY "vc_update" ON public.videocall_rooms FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- 3) Dashboard widgets per utente
CREATE TABLE public.dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_key text NOT NULL,    -- es: 'kpi_open_tickets','sla_violations','chart_tickets_30d'
  title text,
  position int NOT NULL DEFAULT 0,
  size text NOT NULL DEFAULT 'md', -- sm|md|lg|xl
  config jsonb NOT NULL DEFAULT '{}',
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_widgets_user ON public.dashboard_widgets(user_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_widgets TO authenticated;
GRANT ALL ON public.dashboard_widgets TO service_role;
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dw_own" ON public.dashboard_widgets FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_dw_upd BEFORE UPDATE ON public.dashboard_widgets FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4) Ticket reports (rapportino intervento)
CREATE TABLE public.ticket_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  summary text NOT NULL,
  materials_used jsonb DEFAULT '[]',
  hours_worked numeric(6,2),
  signature_data_url text,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_reports TO authenticated;
GRANT ALL ON public.ticket_reports TO service_role;
ALTER TABLE public.ticket_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tr_select" ON public.ticket_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND public.has_structure_access(auth.uid(), t.structure_id)));
CREATE POLICY "tr_insert" ON public.ticket_reports FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND public.has_structure_access(auth.uid(), t.structure_id)));
CREATE POLICY "tr_update" ON public.ticket_reports FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

-- 5) Storage policies sul bucket 'tickets' (già esistente, privato)
CREATE POLICY "tickets_obj_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tickets');
CREATE POLICY "tickets_obj_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tickets');
CREATE POLICY "tickets_obj_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tickets' AND owner = auth.uid());

-- 6) Realtime per attachments/reports/videocall
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_attachments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.videocall_rooms;