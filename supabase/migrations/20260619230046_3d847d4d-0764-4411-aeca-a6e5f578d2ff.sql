
-- Estensione sla_violations per tracciare livello escalation
ALTER TABLE public.sla_violations
  ADD COLUMN IF NOT EXISTS last_escalation_level int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_escalation_at timestamptz;

-- Escalation rules
CREATE TABLE IF NOT EXISTS public.sla_escalation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_rule_id uuid REFERENCES public.sla_rules(id) ON DELETE CASCADE,
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  level int NOT NULL CHECK (level BETWEEN 1 AND 5),
  after_minutes int NOT NULL CHECK (after_minutes >= 0),
  notify_role app_role,
  notify_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notify_channel_id uuid REFERENCES public.notification_channels(id) ON DELETE SET NULL,
  event public.notification_event NOT NULL DEFAULT 'sla_violated',
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sla_rule_id, level)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_escalation_rules TO authenticated;
GRANT ALL ON public.sla_escalation_rules TO service_role;
ALTER TABLE public.sla_escalation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_escalation_read" ON public.sla_escalation_rules
  FOR SELECT TO authenticated
  USING (structure_id IS NULL OR has_structure_access(auth.uid(), structure_id));

CREATE POLICY "sla_escalation_manage" ON public.sla_escalation_rules
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_sla_escalation_rule ON public.sla_escalation_rules(sla_rule_id, level);
CREATE INDEX IF NOT EXISTS idx_sla_escalation_struct ON public.sla_escalation_rules(structure_id);

CREATE TRIGGER tg_sla_escalation_updated
  BEFORE UPDATE ON public.sla_escalation_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Nuovi eventi notifica
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='notification_event' AND e.enumlabel='sla_escalation_l1') THEN
    ALTER TYPE public.notification_event ADD VALUE 'sla_escalation_l1';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='notification_event' AND e.enumlabel='sla_escalation_l2') THEN
    ALTER TYPE public.notification_event ADD VALUE 'sla_escalation_l2';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='notification_event' AND e.enumlabel='sla_escalation_l3') THEN
    ALTER TYPE public.notification_event ADD VALUE 'sla_escalation_l3';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='notification_event' AND e.enumlabel='compliance_report_ready') THEN
    ALTER TYPE public.notification_event ADD VALUE 'compliance_report_ready';
  END IF;
END $$;

-- Report di conformità SLA per periodo / struttura
CREATE OR REPLACE FUNCTION public.sla_compliance_report(
  _from timestamptz,
  _to timestamptz,
  _structure uuid DEFAULT NULL
)
RETURNS TABLE(
  structure_id uuid,
  structure_name text,
  priority ticket_priority,
  total_tickets bigint,
  ack_on_time bigint,
  resolve_on_time bigint,
  violated bigint,
  ack_compliance_pct numeric,
  resolve_compliance_pct numeric,
  avg_resolve_minutes numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT t.structure_id, s.name AS structure_name, t.priority,
           t.ack_due_at, t.resolve_due_at, t.ack_at, t.resolved_at, t.created_at
    FROM public.tickets t
    LEFT JOIN public.structures s ON s.id = t.structure_id
    WHERE t.created_at >= _from AND t.created_at < _to
      AND (_structure IS NULL OR t.structure_id = _structure)
      AND (auth.uid() IS NULL OR t.structure_id IS NULL OR has_structure_access(auth.uid(), t.structure_id))
  )
  SELECT structure_id, structure_name, priority,
         count(*)::bigint,
         count(*) FILTER (WHERE ack_at IS NOT NULL AND ack_due_at IS NOT NULL AND ack_at <= ack_due_at)::bigint,
         count(*) FILTER (WHERE resolved_at IS NOT NULL AND resolve_due_at IS NOT NULL AND resolved_at <= resolve_due_at)::bigint,
         count(*) FILTER (WHERE (ack_at IS NOT NULL AND ack_due_at IS NOT NULL AND ack_at > ack_due_at)
                             OR (resolved_at IS NOT NULL AND resolve_due_at IS NOT NULL AND resolved_at > resolve_due_at))::bigint,
         round(100.0 * count(*) FILTER (WHERE ack_at IS NOT NULL AND ack_due_at IS NOT NULL AND ack_at <= ack_due_at)
               / NULLIF(count(*) FILTER (WHERE ack_at IS NOT NULL), 0), 1),
         round(100.0 * count(*) FILTER (WHERE resolved_at IS NOT NULL AND resolve_due_at IS NOT NULL AND resolved_at <= resolve_due_at)
               / NULLIF(count(*) FILTER (WHERE resolved_at IS NOT NULL), 0), 1),
         round(avg(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) FILTER (WHERE resolved_at IS NOT NULL), 1)
  FROM base
  GROUP BY structure_id, structure_name, priority
  ORDER BY structure_name NULLS LAST, priority;
$$;

REVOKE EXECUTE ON FUNCTION public.sla_compliance_report(timestamptz, timestamptz, uuid) FROM anon;

-- Escalation pending: ticket con violazione ack/resolve oltre soglia di un livello non ancora inviato
CREATE OR REPLACE FUNCTION public.sla_pending_escalations()
RETURNS TABLE(
  ticket_id uuid,
  structure_id uuid,
  violation_id uuid,
  next_level int,
  after_minutes int,
  notify_role app_role,
  notify_user_id uuid,
  notify_channel_id uuid,
  event public.notification_event,
  delay_minutes int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH active_violations AS (
    SELECT v.id AS violation_id, v.ticket_id, v.structure_id, v.delay_minutes, v.last_escalation_level,
           t.priority, t.category_id
    FROM public.sla_violations v
    JOIN public.tickets t ON t.id = v.ticket_id
    WHERE v.status = 'aperta'
  )
  SELECT av.ticket_id, av.structure_id, av.violation_id, er.level, er.after_minutes,
         er.notify_role, er.notify_user_id, er.notify_channel_id, er.event, av.delay_minutes
  FROM active_violations av
  JOIN public.sla_escalation_rules er
    ON er.enabled = true
   AND (er.structure_id IS NULL OR er.structure_id = av.structure_id)
   AND er.level = av.last_escalation_level + 1
  WHERE av.delay_minutes >= er.after_minutes;
$$;

REVOKE EXECUTE ON FUNCTION public.sla_pending_escalations() FROM anon, authenticated;
