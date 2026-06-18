
-- Phase 0.10: scheduled report exports + delegations history support
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS recipients text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS next_run_at timestamptz;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS pdf_layout jsonb;

CREATE TABLE IF NOT EXISTS public.scheduled_report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.report_templates(id) ON DELETE CASCADE,
  structure_id uuid,
  status text NOT NULL DEFAULT 'queued',
  rows_count integer,
  recipients text[] NOT NULL DEFAULT '{}',
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_report_runs TO authenticated;
GRANT ALL ON public.scheduled_report_runs TO service_role;
ALTER TABLE public.scheduled_report_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read scheduled runs" ON public.scheduled_report_runs;
CREATE POLICY "admins read scheduled runs" ON public.scheduled_report_runs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins manage scheduled runs" ON public.scheduled_report_runs;
CREATE POLICY "admins manage scheduled runs" ON public.scheduled_report_runs
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
