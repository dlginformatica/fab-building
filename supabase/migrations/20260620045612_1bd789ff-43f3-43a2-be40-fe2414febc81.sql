
ALTER TABLE public.sla_notifications
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_by uuid,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid;

CREATE TABLE IF NOT EXISTS public.sla_user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  warning_threshold_minutes int NOT NULL DEFAULT 30,
  reminder_interval_minutes int NOT NULL DEFAULT 60,
  channel_in_app boolean NOT NULL DEFAULT true,
  channel_email boolean NOT NULL DEFAULT false,
  channel_push boolean NOT NULL DEFAULT false,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, structure_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_user_settings TO authenticated;
GRANT ALL ON public.sla_user_settings TO service_role;
ALTER TABLE public.sla_user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_user_settings_own" ON public.sla_user_settings
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER tg_sla_user_settings_updated BEFORE UPDATE ON public.sla_user_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.scheduled_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  module text NOT NULL,
  format text NOT NULL DEFAULT 'pdf',
  frequency text NOT NULL DEFAULT 'monthly',
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_artifact_url text,
  share_token text UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_exports TO authenticated;
GRANT ALL ON public.scheduled_exports TO service_role;
ALTER TABLE public.scheduled_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sched_exp_struct" ON public.scheduled_exports
  FOR ALL TO authenticated
  USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
CREATE TRIGGER tg_sched_exp_updated BEFORE UPDATE ON public.scheduled_exports
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.trends_monthly(_structure uuid, _from date, _to date)
RETURNS TABLE(
  month date,
  tickets_opened bigint,
  tickets_resolved bigint,
  sla_compliance_pct numeric,
  invoices_total numeric,
  energy_kwh numeric,
  water_mc numeric,
  gas_smc numeric,
  housekeeping_done bigint,
  guest_issues bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH months AS (
    SELECT generate_series(date_trunc('month',_from), date_trunc('month',_to), interval '1 month')::date AS m
  )
  SELECT m.m,
    (SELECT count(*) FROM tickets t WHERE t.structure_id=_structure AND date_trunc('month',t.created_at)=m.m),
    (SELECT count(*) FROM tickets t WHERE t.structure_id=_structure AND t.resolved_at IS NOT NULL AND date_trunc('month',t.resolved_at)=m.m),
    (SELECT round(100.0*count(*) FILTER (WHERE resolved_at IS NOT NULL AND resolve_due_at IS NOT NULL AND resolved_at<=resolve_due_at)
            / NULLIF(count(*) FILTER (WHERE resolved_at IS NOT NULL),0),1)
     FROM tickets t WHERE t.structure_id=_structure AND date_trunc('month',t.created_at)=m.m),
    (SELECT COALESCE(sum(amount_total),0) FROM invoices i WHERE i.structure_id=_structure AND date_trunc('month',i.issue_date)=m.m),
    (SELECT COALESCE(sum(mr.value),0) FROM meter_readings mr JOIN utility_meters um ON um.id=mr.meter_id
       WHERE um.structure_id=_structure AND um.type='elettricita'::utility_type AND date_trunc('month',mr.reading_date)=m.m),
    (SELECT COALESCE(sum(mr.value),0) FROM meter_readings mr JOIN utility_meters um ON um.id=mr.meter_id
       WHERE um.structure_id=_structure AND um.type='acqua'::utility_type AND date_trunc('month',mr.reading_date)=m.m),
    (SELECT COALESCE(sum(mr.value),0) FROM meter_readings mr JOIN utility_meters um ON um.id=mr.meter_id
       WHERE um.structure_id=_structure AND um.type='gas'::utility_type AND date_trunc('month',mr.reading_date)=m.m),
    (SELECT count(*) FROM housekeeping_tasks h WHERE h.structure_id=_structure AND h.status='done' AND date_trunc('month',h.task_date)=m.m),
    (SELECT count(*) FROM guest_issues g WHERE g.structure_id=_structure AND date_trunc('month',g.created_at)=m.m)
  FROM months m ORDER BY m.m;
$$;
