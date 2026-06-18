
-- Timezone per struttura
ALTER TABLE public.structures ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Rome';

-- Layout PDF per destinatario + retry sui report
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS recipient_layouts jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS max_retries int NOT NULL DEFAULT 3;
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS retry_backoff_minutes int NOT NULL DEFAULT 15;

ALTER TABLE public.scheduled_report_runs ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0;
ALTER TABLE public.scheduled_report_runs ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;
ALTER TABLE public.scheduled_report_runs ADD COLUMN IF NOT EXISTS last_error_at timestamptz;
ALTER TABLE public.scheduled_report_runs ADD COLUMN IF NOT EXISTS recipient_logs jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.scheduled_report_runs ADD COLUMN IF NOT EXISTS triggered_by text NOT NULL DEFAULT 'cron';

-- Coda di invio PDF (delivery queue, retry per destinatario)
CREATE TABLE IF NOT EXISTS public.report_delivery_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.scheduled_report_runs(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.report_templates(id) ON DELETE CASCADE,
  structure_id uuid REFERENCES public.structures(id) ON DELETE SET NULL,
  recipient text NOT NULL,
  subject text,
  status text NOT NULL DEFAULT 'pending', -- pending|sending|sent|error|dlq
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_delivery_queue TO authenticated;
GRANT ALL ON public.report_delivery_queue TO service_role;
ALTER TABLE public.report_delivery_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue read admin" ON public.report_delivery_queue FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE TRIGGER tg_rdq_updated BEFORE UPDATE ON public.report_delivery_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Audit specifico per le deleghe (chi/cosa/quando/motivo)
CREATE TABLE IF NOT EXISTS public.delegation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id uuid,
  action text NOT NULL, -- created|updated|revoked|reactivated|deleted
  actor_id uuid,
  delegator_id uuid,
  delegate_id uuid,
  structure_id uuid,
  modules text[],
  old_row jsonb,
  new_row jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delegation_audit TO authenticated;
GRANT ALL ON public.delegation_audit TO service_role;
ALTER TABLE public.delegation_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delegation audit read" ON public.delegation_audit FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR actor_id = auth.uid() OR delegator_id = auth.uid() OR delegate_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_delegation_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action text; v_reason text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created'; v_reason := NEW.reason;
    INSERT INTO public.delegation_audit(delegation_id, action, actor_id, delegator_id, delegate_id, structure_id, modules, new_row, reason)
    VALUES (NEW.id, v_action, auth.uid(), NEW.delegator_id, NEW.delegate_id, NEW.structure_id, NEW.modules, to_jsonb(NEW), v_reason);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.active = true AND NEW.active = false THEN v_action := 'revoked';
    ELSIF OLD.active = false AND NEW.active = true THEN v_action := 'reactivated';
    ELSE v_action := 'updated'; END IF;
    v_reason := COALESCE(NEW.reason, OLD.reason);
    INSERT INTO public.delegation_audit(delegation_id, action, actor_id, delegator_id, delegate_id, structure_id, modules, old_row, new_row, reason)
    VALUES (NEW.id, v_action, auth.uid(), NEW.delegator_id, NEW.delegate_id, NEW.structure_id, NEW.modules, to_jsonb(OLD), to_jsonb(NEW), v_reason);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.delegation_audit(delegation_id, action, actor_id, delegator_id, delegate_id, structure_id, modules, old_row, reason)
    VALUES (OLD.id, 'deleted', auth.uid(), OLD.delegator_id, OLD.delegate_id, OLD.structure_id, OLD.modules, to_jsonb(OLD), OLD.reason);
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS tg_user_delegations_audit ON public.user_delegations;
CREATE TRIGGER tg_user_delegations_audit
AFTER INSERT OR UPDATE OR DELETE ON public.user_delegations
FOR EACH ROW EXECUTE FUNCTION public.tg_delegation_audit();
