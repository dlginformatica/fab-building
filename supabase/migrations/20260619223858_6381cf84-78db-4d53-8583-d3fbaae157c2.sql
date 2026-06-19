
-- Enums
CREATE TYPE public.workflow_trigger AS ENUM ('manual','ticket_opened','ticket_resolved','contract_expiring','invoice_received','asset_created','maintenance_due','custom');
CREATE TYPE public.workflow_step_type AS ENUM ('approval','action','notification','wait','condition','form');
CREATE TYPE public.workflow_instance_status AS ENUM ('running','completed','cancelled','failed','waiting');
CREATE TYPE public.workflow_transition_outcome AS ENUM ('approved','rejected','completed','skipped','timeout','escalated','cancelled');

-- 1) workflows
CREATE TABLE public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID REFERENCES public.structures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type public.workflow_trigger NOT NULL DEFAULT 'manual',
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT ALL ON public.workflows TO service_role;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflows_select" ON public.workflows FOR SELECT TO authenticated
USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY "workflows_admin_ins" ON public.workflows FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) AND (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id)));
CREATE POLICY "workflows_admin_upd" ON public.workflows FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "workflows_admin_del" ON public.workflows FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER set_updated_at_workflows BEFORE UPDATE ON public.workflows
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER audit_workflows AFTER INSERT OR UPDATE OR DELETE ON public.workflows
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();

-- 2) workflow_steps
CREATE TABLE public.workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  position INT NOT NULL,
  name TEXT NOT NULL,
  step_type public.workflow_step_type NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  assignee_role public.app_role,
  assignee_user UUID REFERENCES auth.users(id),
  sla_minutes INT,
  on_timeout TEXT NOT NULL DEFAULT 'escalate',
  next_step_id UUID REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, position)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_steps TO authenticated;
GRANT ALL ON public.workflow_steps TO service_role;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wf_steps_select" ON public.workflow_steps FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workflows w WHERE w.id = workflow_id
  AND (w.structure_id IS NULL OR public.has_structure_access(auth.uid(), w.structure_id))));
CREATE POLICY "wf_steps_admin_all" ON public.workflow_steps FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER set_updated_at_wf_steps BEFORE UPDATE ON public.workflow_steps
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) workflow_instances
CREATE TABLE public.workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  structure_id UUID REFERENCES public.structures(id) ON DELETE CASCADE,
  status public.workflow_instance_status NOT NULL DEFAULT 'running',
  current_step_id UUID REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  started_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_instances TO authenticated;
GRANT ALL ON public.workflow_instances TO service_role;
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wf_inst_select" ON public.workflow_instances FOR SELECT TO authenticated
USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY "wf_inst_ins" ON public.workflow_instances FOR INSERT TO authenticated
WITH CHECK (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY "wf_inst_upd" ON public.workflow_instances FOR UPDATE TO authenticated
USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id))
WITH CHECK (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id));
CREATE POLICY "wf_inst_del_admin" ON public.workflow_instances FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_wf_inst_status ON public.workflow_instances(status);
CREATE INDEX idx_wf_inst_struct ON public.workflow_instances(structure_id);
CREATE INDEX idx_wf_inst_ticket ON public.workflow_instances(ticket_id);

CREATE TRIGGER set_updated_at_wf_inst BEFORE UPDATE ON public.workflow_instances
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER audit_wf_inst AFTER INSERT OR UPDATE OR DELETE ON public.workflow_instances
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();

-- 4) workflow_transitions (append-only)
CREATE TABLE public.workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  from_step_id UUID REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  to_step_id UUID REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id),
  outcome public.workflow_transition_outcome NOT NULL,
  note TEXT,
  duration_seconds INT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.workflow_transitions TO authenticated;
GRANT ALL ON public.workflow_transitions TO service_role;
ALTER TABLE public.workflow_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wf_tr_select" ON public.workflow_transitions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workflow_instances wi WHERE wi.id = instance_id
  AND (wi.structure_id IS NULL OR public.has_structure_access(auth.uid(), wi.structure_id))));
CREATE POLICY "wf_tr_ins" ON public.workflow_transitions FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.workflow_instances wi WHERE wi.id = instance_id
  AND (wi.structure_id IS NULL OR public.has_structure_access(auth.uid(), wi.structure_id))));

CREATE INDEX idx_wf_tr_inst ON public.workflow_transitions(instance_id, created_at);
