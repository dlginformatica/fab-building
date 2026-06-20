
-- Template editabili per notifiche e tracking dispatch su sla_notifications

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  event text NOT NULL,
  channel_type text NOT NULL CHECK (channel_type IN ('email','teams','push')),
  name text NOT NULL,
  subject text NOT NULL,
  body_md text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read templates" ON public.notification_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage templates" ON public.notification_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_nt_touch ON public.notification_templates;
CREATE TRIGGER trg_nt_touch BEFORE UPDATE ON public.notification_templates
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Tracking dispatch su sla_notifications
ALTER TABLE public.sla_notifications
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sla_notifications_dispatched ON public.sla_notifications(dispatched_at) WHERE dispatched_at IS NULL;

-- Seed template default (uno per evento+canale, scope globale)
INSERT INTO public.notification_templates (event, channel_type, name, subject, body_md)
SELECT * FROM (VALUES
  ('sla_warning','email','Default · SLA in scadenza (email)','[HotelOps] SLA in scadenza · ticket #{{ticket_number}}',E'Il ticket **#{{ticket_number}} — {{title}}** è in scadenza SLA.\n\nScadenza: {{due_at}}\nPriorità: {{priority}}\n\nApri il ticket in HotelOps.'),
  ('sla_warning','teams','Default · SLA in scadenza (Teams)','SLA in scadenza · #{{ticket_number}}',E'Il ticket **#{{ticket_number}} — {{title}}** scade il {{due_at}}.'),
  ('sla_violated','email','Default · SLA violato (email)','[HotelOps] SLA violato · ticket #{{ticket_number}}',E'**SLA VIOLATO** per il ticket #{{ticket_number}} — {{title}}.\n\nRitardo: +{{delay_minutes}} min\nPriorità: {{priority}}\n\nAzione richiesta immediata.'),
  ('sla_violated','teams','Default · SLA violato (Teams)','🚨 SLA violato · #{{ticket_number}}',E'Ticket **#{{ticket_number}} — {{title}}** in ritardo di **{{delay_minutes}} min**.'),
  ('sla_warning','push','Default · SLA in scadenza (push)','SLA in scadenza',E'#{{ticket_number}} — {{title}} scade {{due_at}}'),
  ('sla_violated','push','Default · SLA violato (push)','🚨 SLA violato',E'#{{ticket_number}} in ritardo di {{delay_minutes}} min')
) AS t(event, channel_type, name, subject, body_md)
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_templates nt
  WHERE nt.event = t.event AND nt.channel_type = t.channel_type AND nt.structure_id IS NULL
);
