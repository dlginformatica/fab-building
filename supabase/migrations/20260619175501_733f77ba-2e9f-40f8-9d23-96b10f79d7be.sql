
-- Estensione maintenance_tasks
ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_hours numeric(6,2),
  ADD COLUMN IF NOT EXISTS actual_hours numeric(6,2),
  ADD COLUMN IF NOT EXISTS outcome text CHECK (outcome IN ('ok','da_rifare','problema','annullato')),
  ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ticket_report_id uuid REFERENCES public.ticket_reports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_for date,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_maintenance_tasks_updated ON public.maintenance_tasks;
CREATE TRIGGER trg_maintenance_tasks_updated
  BEFORE UPDATE ON public.maintenance_tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Indici per calendario e storico
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_due ON public.maintenance_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_plan ON public.maintenance_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_assigned ON public.maintenance_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_status ON public.maintenance_tasks(status);

-- Funzione per generare task in un intervallo date in base alla frequenza
CREATE OR REPLACE FUNCTION public.generate_maintenance_tasks(_from date, _to date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  d date;
  step int;
  created int := 0;
BEGIN
  FOR p IN SELECT * FROM public.maintenance_plans WHERE active = true LOOP
    step := CASE p.frequency
      WHEN 'giornaliera' THEN 1
      WHEN 'settimanale' THEN 7
      WHEN 'mensile' THEN 30
      WHEN 'trimestrale' THEN 90
      WHEN 'semestrale' THEN 180
      WHEN 'annuale' THEN 365
      WHEN 'custom' THEN COALESCE(p.interval_days, 30)
      ELSE 30 END;

    d := COALESCE(p.next_due, _from);
    WHILE d <= _to LOOP
      IF d >= _from THEN
        INSERT INTO public.maintenance_tasks(plan_id, due_date, scheduled_for, status)
        SELECT p.id, d, d, 'pending'
        WHERE NOT EXISTS (
          SELECT 1 FROM public.maintenance_tasks t
          WHERE t.plan_id = p.id AND t.due_date = d
        );
        IF FOUND THEN created := created + 1; END IF;
      END IF;
      d := d + (step || ' days')::interval;
    END LOOP;
  END LOOP;
  RETURN created;
END $$;

REVOKE EXECUTE ON FUNCTION public.generate_maintenance_tasks(date, date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_maintenance_tasks(date, date) TO service_role;
