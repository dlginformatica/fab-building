
-- Extended dependencies for new modules
INSERT INTO public.module_dependencies(module, depends_on) VALUES
  ('cashbook','invoices'),
  ('smart_inbox','tickets'),
  ('sustainability','utilities'),
  ('scheduled_exports','reports'),
  ('alerts','sla'),
  ('overview','statistics'),
  ('audit','settings'),
  ('sla_settings','sla'),
  ('notifications','sla'),
  ('delegations','users'),
  ('organization','users'),
  ('integrations','settings'),
  ('housekeeping','rooms'),
  ('guest_issues','rooms'),
  ('messages','users'),
  ('workflows','tickets')
ON CONFLICT DO NOTHING;

-- Add 'rooms' as base if missing dep
INSERT INTO public.module_dependencies(module, depends_on)
SELECT 'rooms','structures' WHERE NOT EXISTS (SELECT 1 FROM public.module_dependencies WHERE module='rooms');

-- ============================================================
-- has_module_access: server-side authoritative check
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_module_access(_user uuid, _module text, _structure uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    -- super admin always
    public.has_role(_user,'super_admin')
    OR
    -- org owner: full access within own organization
    EXISTS (
      SELECT 1 FROM public.organizations o
      JOIN public.profiles p ON p.organization_id = o.id
      WHERE p.id = _user AND o.owner_id = _user
    )
    OR
    -- direttore/facility_manager on the (optional) structure
    public.has_role(_user,'direttore', _structure)
    OR public.has_role(_user,'facility_manager', _structure)
    OR
    -- explicit delegation matching module and structure
    EXISTS (
      SELECT 1 FROM public.user_delegations d
      WHERE d.delegate_id = _user
        AND d.active = true
        AND (d.starts_at IS NULL OR d.starts_at <= now())
        AND (d.ends_at IS NULL OR d.ends_at > now())
        AND (d.structure_id IS NULL OR _structure IS NULL OR d.structure_id = _structure)
        AND (_module = ANY(d.modules) OR '*' = ANY(d.modules))
    )
    OR
    -- granular module_permissions
    public.has_permission(_user, _module, 'view', _structure)
$$;

GRANT EXECUTE ON FUNCTION public.has_module_access(uuid,text,uuid) TO authenticated;

-- ============================================================
-- missing_module_deps: preview of mandatory dependencies missing
-- given a desired modules[] set
-- ============================================================
CREATE OR REPLACE FUNCTION public.missing_module_deps(_modules text[])
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH expanded AS (SELECT unnest(public.expand_modules_with_deps(_modules)) AS m)
  SELECT COALESCE(array_agg(DISTINCT m ORDER BY m), ARRAY[]::text[])
  FROM expanded
  WHERE m <> ALL(COALESCE(_modules, ARRAY[]::text[]))
$$;
GRANT EXECUTE ON FUNCTION public.missing_module_deps(text[]) TO authenticated, anon;

-- ============================================================
-- Trigger: auto-expand modules with dependencies on insert/update
-- of user_delegations, guaranteeing coherence at DB level.
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_delegation_expand_deps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.modules IS NOT NULL AND array_length(NEW.modules,1) > 0
     AND NOT ('*' = ANY(NEW.modules)) THEN
    NEW.modules := public.expand_modules_with_deps(NEW.modules);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS user_delegations_expand_deps ON public.user_delegations;
CREATE TRIGGER user_delegations_expand_deps
  BEFORE INSERT OR UPDATE OF modules ON public.user_delegations
  FOR EACH ROW EXECUTE FUNCTION public.tg_delegation_expand_deps();

-- ============================================================
-- permission_matrix: effective access per user in current org
-- ============================================================
CREATE OR REPLACE FUNCTION public.permission_matrix(_org uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid, email text, full_name text, module text, enabled boolean, source text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH org AS (SELECT COALESCE(_org, public.current_org_id()) AS id),
  modules(name) AS (
    SELECT DISTINCT m FROM (
      SELECT module AS m FROM public.module_dependencies
      UNION SELECT depends_on FROM public.module_dependencies
      UNION VALUES ('tickets'),('assets'),('maintenance'),('inventory'),('suppliers'),
                   ('contracts'),('work_orders'),('purchase_orders'),('utilities'),
                   ('invoices'),('reports'),('sla'),('penalties'),('users'),('audit'),
                   ('docs'),('settings'),('messages'),('statistics'),('cashbook'),
                   ('smart_inbox'),('sustainability'),('scheduled_exports'),('alerts'),
                   ('overview'),('housekeeping'),('guest_issues'),('rooms'),
                   ('sla_settings'),('notifications'),('delegations'),('organization'),
                   ('integrations'),('workflows')
    ) s
  ),
  users AS (
    SELECT m.user_id, p.email, p.full_name
    FROM public.org_memberships m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.org_id = (SELECT id FROM org)
  )
  SELECT u.user_id, u.email, u.full_name, mo.name,
    public.has_module_access(u.user_id, mo.name, NULL) AS enabled,
    CASE
      WHEN public.has_role(u.user_id,'super_admin') THEN 'super_admin'
      WHEN EXISTS (SELECT 1 FROM public.organizations o WHERE o.id=(SELECT id FROM org) AND o.owner_id=u.user_id) THEN 'org_owner'
      WHEN public.has_role(u.user_id,'direttore') THEN 'direttore'
      WHEN public.has_role(u.user_id,'facility_manager') THEN 'facility_manager'
      WHEN EXISTS (SELECT 1 FROM public.user_delegations d
                   WHERE d.delegate_id=u.user_id AND d.active=true
                     AND (mo.name=ANY(d.modules) OR '*'=ANY(d.modules))) THEN 'delega'
      WHEN public.has_permission(u.user_id, mo.name, 'view', NULL) THEN 'permesso'
      ELSE 'nessuno'
    END
  FROM users u CROSS JOIN modules mo
  ORDER BY u.email, mo.name
$$;
GRANT EXECUTE ON FUNCTION public.permission_matrix(uuid) TO authenticated;
