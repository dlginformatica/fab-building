
-- Rollback delle regole di dipendenza: crea una nuova versione clonando una precedente e la attiva
CREATE OR REPLACE FUNCTION public.rollback_dependency_version(_target uuid, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_src public.module_dependency_versions%ROWTYPE;
  v_next int;
  v_new_id uuid;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Permesso negato';
  END IF;
  SELECT * INTO v_src FROM public.module_dependency_versions WHERE id = _target;
  IF v_src.id IS NULL THEN RAISE EXCEPTION 'Versione di destinazione non trovata'; END IF;

  SELECT COALESCE(max(version),0)+1 INTO v_next FROM public.module_dependency_versions;
  INSERT INTO public.module_dependency_versions(version, rules, note, created_by, active)
  VALUES (v_next, v_src.rules, COALESCE(_note, 'Rollback alla versione #'||v_src.version), auth.uid(), false)
  RETURNING id INTO v_new_id;

  PERFORM public.activate_dependency_version(v_new_id);

  INSERT INTO public.permission_audit(actor_id, entity, entity_id, action, before, after, reason)
  VALUES (auth.uid(), 'module_dependency_version', v_new_id, 'rolled_back',
          to_jsonb(v_src), (SELECT to_jsonb(x) FROM public.module_dependency_versions x WHERE x.id = v_new_id),
          COALESCE(_note,'Rollback alla versione #'||v_src.version));
  RETURN v_new_id;
END $$;

-- Avvisi per amministratori di organizzazione
CREATE TABLE public.admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  source_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL, -- 'access_denied_missing_dep' | ...
  module text,
  structure_id uuid,
  reason text,
  missing_deps text[] DEFAULT ARRAY[]::text[],
  payload jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.admin_alerts TO authenticated;
GRANT ALL ON public.admin_alerts TO service_role;
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads own alerts" ON public.admin_alerts FOR SELECT TO authenticated
  USING (admin_user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "admin marks own alert read" ON public.admin_alerts FOR UPDATE TO authenticated
  USING (admin_user_id = auth.uid());

CREATE INDEX admin_alerts_admin_idx ON public.admin_alerts(admin_user_id, created_at DESC) WHERE read_at IS NULL;

-- Trigger: fan-out di un avviso a ogni admin/owner dell'organizzazione del richiedente
CREATE OR REPLACE FUNCTION public.tg_notify_admins_on_denied()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid;
BEGIN
  IF NEW.reason <> 'missing_dependency' THEN RETURN NEW; END IF;
  SELECT organization_id INTO v_org FROM public.profiles WHERE id = NEW.user_id;
  IF v_org IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.admin_alerts(org_id, admin_user_id, source_user_id, kind, module, structure_id, reason, missing_deps, payload)
  SELECT v_org, m.user_id, NEW.user_id, 'access_denied_missing_dep',
         NEW.module, NEW.structure_id, NEW.reason, NEW.missing_deps,
         jsonb_build_object('denied_id', NEW.id, 'path', NEW.path)
  FROM public.org_memberships m
  WHERE m.org_id = v_org AND m.role IN ('owner','admin') AND m.user_id <> NEW.user_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notify_admins_on_denied ON public.access_denied_log;
CREATE TRIGGER notify_admins_on_denied AFTER INSERT ON public.access_denied_log
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_admins_on_denied();
