
-- ============ MODULE PERMISSIONS ============
CREATE TABLE public.module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role,
  module text NOT NULL,
  action text NOT NULL DEFAULT 'view',
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NOT NULL) OR (role IS NOT NULL))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_permissions TO authenticated;
GRANT ALL ON public.module_permissions TO service_role;
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage perms" ON public.module_permissions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "users see own perms" ON public.module_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_permission(_user uuid, _module text, _action text DEFAULT 'view', _structure uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user, 'super_admin') OR
    EXISTS (
      SELECT 1 FROM public.module_permissions mp
      LEFT JOIN public.user_roles ur ON ur.user_id = _user
      WHERE mp.allowed = true
        AND mp.module = _module
        AND (mp.action = _action OR mp.action = '*')
        AND (mp.structure_id IS NULL OR _structure IS NULL OR mp.structure_id = _structure)
        AND ((mp.user_id = _user) OR (mp.role IS NOT NULL AND mp.role = ur.role))
    )
$$;

-- ============ USER DELEGATIONS ============
CREATE TABLE public.user_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delegate_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  modules text[] NOT NULL DEFAULT ARRAY['*'],
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_delegations TO authenticated;
GRANT ALL ON public.user_delegations TO service_role;
ALTER TABLE public.user_delegations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delegations own or admin" ON public.user_delegations FOR ALL TO authenticated
  USING (delegator_id = auth.uid() OR delegate_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (delegator_id = auth.uid() OR public.is_admin(auth.uid()));

-- ============ PENALTY RULES ============
CREATE TABLE public.penalty_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'sla_resolve',
  threshold_minutes int,
  amount_eur numeric(12,2) NOT NULL DEFAULT 0,
  amount_pct numeric(5,2),
  per_hour boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.penalty_rules TO authenticated;
GRANT ALL ON public.penalty_rules TO service_role;
ALTER TABLE public.penalty_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "penalty rules struct" ON public.penalty_rules FOR ALL TO authenticated
  USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============ SLA VIOLATIONS ============
CREATE TABLE public.sla_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  rule_id uuid REFERENCES public.penalty_rules(id) ON DELETE SET NULL,
  kind text NOT NULL,
  delay_minutes int NOT NULL DEFAULT 0,
  penalty_eur numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aperta',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_violations TO authenticated;
GRANT ALL ON public.sla_violations TO service_role;
ALTER TABLE public.sla_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla violations struct" ON public.sla_violations FOR ALL TO authenticated
  USING (structure_id IS NULL OR public.has_structure_access(auth.uid(), structure_id))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_sla_violations_ticket ON public.sla_violations(ticket_id);
CREATE INDEX idx_sla_violations_struct ON public.sla_violations(structure_id, created_at DESC);

-- Trigger: calcola violazione SLA e penale alla risoluzione/chiusura ticket
CREATE OR REPLACE FUNCTION public.compute_sla_violation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  delay_min int;
  rule record;
  pen numeric(12,2);
BEGIN
  IF NEW.resolved_at IS NOT NULL AND (OLD.resolved_at IS NULL OR OLD.resolved_at <> NEW.resolved_at)
     AND NEW.resolve_due_at IS NOT NULL AND NEW.resolved_at > NEW.resolve_due_at THEN
    delay_min := EXTRACT(EPOCH FROM (NEW.resolved_at - NEW.resolve_due_at))/60;
    SELECT * INTO rule FROM public.penalty_rules
      WHERE active = true
        AND (structure_id = NEW.structure_id OR structure_id IS NULL)
        AND trigger_type = 'sla_resolve'
        AND (threshold_minutes IS NULL OR delay_min >= threshold_minutes)
      ORDER BY (structure_id IS NOT NULL) DESC LIMIT 1;
    pen := COALESCE(rule.amount_eur,0);
    IF rule.per_hour THEN pen := pen * GREATEST(1, ceil(delay_min/60.0)); END IF;
    INSERT INTO public.sla_violations(ticket_id, structure_id, rule_id, kind, delay_minutes, penalty_eur)
    VALUES (NEW.id, NEW.structure_id, rule.id, 'risoluzione', delay_min, pen);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_compute_sla_violation ON public.tickets;
CREATE TRIGGER trg_compute_sla_violation
AFTER UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.compute_sla_violation();

-- ============ REPORT TEMPLATES ============
CREATE TABLE public.report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  source text NOT NULL,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  group_by text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  structure_id uuid REFERENCES public.structures(id) ON DELETE CASCADE,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_templates TO authenticated;
GRANT ALL ON public.report_templates TO service_role;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report tmpl read" ON public.report_templates FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR is_shared = true OR public.is_admin(auth.uid()));
CREATE POLICY "report tmpl write own" ON public.report_templates FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_report_templates_updated BEFORE UPDATE ON public.report_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
