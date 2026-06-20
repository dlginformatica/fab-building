
-- Fase 16: editor dipendenze moduli (versionato), audit permessi/deleghe, log accessi negati

-- Versioning delle regole di dipendenza
CREATE TABLE public.module_dependency_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version int NOT NULL,
  rules jsonb NOT NULL, -- array of {module, depends_on, note?}
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.module_dependency_versions TO authenticated;
GRANT ALL ON public.module_dependency_versions TO service_role;
ALTER TABLE public.module_dependency_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read versions" ON public.module_dependency_versions FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "admins write versions" ON public.module_dependency_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "admins update versions" ON public.module_dependency_versions FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));

CREATE UNIQUE INDEX module_dependency_versions_active_uq ON public.module_dependency_versions(active) WHERE active = true;

-- Audit unificato permessi/deleghe
CREATE TABLE public.permission_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity text NOT NULL, -- 'module_permission' | 'user_delegation' | 'user_role' | 'module_dependency_version'
  entity_id uuid,
  action text NOT NULL, -- 'created'|'updated'|'deleted'|'activated'|...
  reason text,
  before jsonb,
  after jsonb,
  structure_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.permission_audit TO authenticated;
GRANT ALL ON public.permission_audit TO service_role;
ALTER TABLE public.permission_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read permission audit" ON public.permission_audit FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'super_admin') OR actor_id = auth.uid() OR target_user_id = auth.uid());
CREATE POLICY "system can insert audit" ON public.permission_audit FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX permission_audit_created_idx ON public.permission_audit(created_at DESC);
CREATE INDEX permission_audit_target_idx ON public.permission_audit(target_user_id);

-- Log accessi negati (per Smart Inbox)
CREATE TABLE public.access_denied_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL,
  structure_id uuid,
  reason text NOT NULL, -- 'missing_dependency'|'no_role'|'no_delegation'|'expired_delegation'|'other'
  missing_deps text[] DEFAULT ARRAY[]::text[],
  path text,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.access_denied_log TO authenticated;
GRANT ALL ON public.access_denied_log TO service_role;
ALTER TABLE public.access_denied_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own denials" ON public.access_denied_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "users insert own denials" ON public.access_denied_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "users update own denials" ON public.access_denied_log FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE INDEX access_denied_user_idx ON public.access_denied_log(user_id, created_at DESC);

-- RPC: has_module_access esplicativo (motivo del rifiuto + dipendenze mancanti)
CREATE OR REPLACE FUNCTION public.explain_module_access(_user uuid, _module text, _structure uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enabled boolean;
  v_source text;
  v_missing text[];
  v_user_modules text[];
BEGIN
  v_enabled := public.has_module_access(_user, _module, _structure);
  -- collect modules user actually has (from active delegations)
  SELECT COALESCE(array_agg(DISTINCT m), ARRAY[]::text[]) INTO v_user_modules FROM (
    SELECT unnest(d.modules) AS m FROM public.user_delegations d
    WHERE d.delegate_id = _user AND d.active = true
      AND (d.starts_at IS NULL OR d.starts_at <= now())
      AND (d.ends_at IS NULL OR d.ends_at > now())
  ) s;
  -- dependencies for the requested module not present in user's modules
  SELECT COALESCE(array_agg(DISTINCT depends_on), ARRAY[]::text[]) INTO v_missing
  FROM public.module_dependencies
  WHERE module = _module AND NOT (depends_on = ANY(v_user_modules));

  IF v_enabled THEN v_source := 'granted';
  ELSIF public.has_role(_user,'super_admin') THEN v_source := 'granted';
  ELSIF array_length(v_missing,1) > 0 THEN v_source := 'missing_dependency';
  ELSIF v_user_modules IS NULL OR array_length(v_user_modules,1) IS NULL THEN v_source := 'no_delegation';
  ELSE v_source := 'no_role';
  END IF;

  RETURN jsonb_build_object(
    'enabled', v_enabled,
    'reason', v_source,
    'missing_deps', v_missing,
    'user_modules', v_user_modules
  );
END $$;

-- Triggers di audit su user_delegations & module_permissions
CREATE OR REPLACE FUNCTION public.tg_permission_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_target uuid; v_struct uuid;
BEGIN
  IF TG_TABLE_NAME = 'user_delegations' THEN
    v_target := COALESCE((to_jsonb(NEW)->>'delegate_id')::uuid, (to_jsonb(OLD)->>'delegate_id')::uuid);
    v_struct := COALESCE((to_jsonb(NEW)->>'structure_id')::uuid, (to_jsonb(OLD)->>'structure_id')::uuid);
  ELSIF TG_TABLE_NAME = 'module_permissions' THEN
    v_target := COALESCE((to_jsonb(NEW)->>'user_id')::uuid, (to_jsonb(OLD)->>'user_id')::uuid);
    v_struct := COALESCE((to_jsonb(NEW)->>'structure_id')::uuid, (to_jsonb(OLD)->>'structure_id')::uuid);
  ELSIF TG_TABLE_NAME = 'user_roles' THEN
    v_target := COALESCE((to_jsonb(NEW)->>'user_id')::uuid, (to_jsonb(OLD)->>'user_id')::uuid);
    v_struct := COALESCE((to_jsonb(NEW)->>'structure_id')::uuid, (to_jsonb(OLD)->>'structure_id')::uuid);
  END IF;
  INSERT INTO public.permission_audit(actor_id, target_user_id, entity, entity_id, action, before, after, structure_id, reason)
  VALUES (
    auth.uid(), v_target, TG_TABLE_NAME,
    COALESCE((to_jsonb(NEW)->>'id')::uuid, (to_jsonb(OLD)->>'id')::uuid),
    lower(TG_OP),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
    v_struct,
    NULLIF(COALESCE(to_jsonb(NEW)->>'reason',''),'')
  );
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS audit_user_delegations ON public.user_delegations;
CREATE TRIGGER audit_user_delegations AFTER INSERT OR UPDATE OR DELETE ON public.user_delegations
FOR EACH ROW EXECUTE FUNCTION public.tg_permission_audit();

DROP TRIGGER IF EXISTS audit_module_permissions ON public.module_permissions;
CREATE TRIGGER audit_module_permissions AFTER INSERT OR UPDATE OR DELETE ON public.module_permissions
FOR EACH ROW EXECUTE FUNCTION public.tg_permission_audit();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_permission_audit();

-- RPC: attiva una versione delle dipendenze (sostituisce module_dependencies)
CREATE OR REPLACE FUNCTION public.activate_dependency_version(_version_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; r jsonb;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Permesso negato';
  END IF;
  SELECT * INTO v FROM public.module_dependency_versions WHERE id = _version_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Versione non trovata'; END IF;
  UPDATE public.module_dependency_versions SET active = false WHERE active = true;
  UPDATE public.module_dependency_versions SET active = true WHERE id = _version_id;
  DELETE FROM public.module_dependencies;
  FOR r IN SELECT * FROM jsonb_array_elements(v.rules) LOOP
    INSERT INTO public.module_dependencies(module, depends_on)
    VALUES (r->>'module', r->>'depends_on')
    ON CONFLICT DO NOTHING;
  END LOOP;
  INSERT INTO public.permission_audit(actor_id, entity, entity_id, action, after, reason)
  VALUES (auth.uid(), 'module_dependency_version', _version_id, 'activated', to_jsonb(v), v.note);
END $$;
