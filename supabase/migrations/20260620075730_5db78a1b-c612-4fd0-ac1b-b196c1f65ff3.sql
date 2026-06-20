
-- Fase 18: preferenze notifica org + impatto/compatibilità versioni dipendenze

-- 1) Preferenze notifica per organizzazione (canali, frequenza, categorie)
CREATE TABLE IF NOT EXISTS public.org_notification_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[], -- in_app | email | push
  frequency text NOT NULL DEFAULT 'immediate', -- immediate | hourly | daily
  categories text[] NOT NULL DEFAULT ARRAY['access_denied_missing_dep']::text[],
  quiet_hours_start time,
  quiet_hours_end time,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_notification_prefs TO authenticated;
GRANT ALL ON public.org_notification_prefs TO service_role;

ALTER TABLE public.org_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org owners/admins read prefs" ON public.org_notification_prefs
  FOR SELECT TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id) OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "org owners/admins manage prefs" ON public.org_notification_prefs
  FOR ALL TO authenticated
  USING (public.is_org_owner(auth.uid(), org_id) OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.is_org_owner(auth.uid(), org_id) OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_org_notification_prefs_updated
  BEFORE UPDATE ON public.org_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 2) Anteprima impatto versione dipendenze su deleghe attuali
CREATE OR REPLACE FUNCTION public.dependency_version_impact(_target uuid)
RETURNS TABLE(
  delegation_id uuid,
  delegate_id uuid,
  delegate_email text,
  structure_id uuid,
  current_modules text[],
  required_modules text[],
  missing_modules text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rules jsonb;
BEGIN
  SELECT rules INTO v_rules FROM public.module_dependency_versions WHERE id = _target;
  IF v_rules IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH target_rules AS (
    SELECT (r->>'module')::text AS module, (r->>'depends_on')::text AS depends_on
    FROM jsonb_array_elements(v_rules) r
  ),
  -- recursive expansion using target rules
  RECURSIVE_EXPAND AS (
    SELECT d.id AS delegation_id, d.delegate_id, d.structure_id, d.modules,
           unnest(d.modules) AS m
    FROM public.user_delegations d
    WHERE d.active = true AND NOT ('*' = ANY(d.modules))
  ),
  expanded AS (
    SELECT delegation_id, delegate_id, structure_id, modules, m FROM RECURSIVE_EXPAND
    UNION
    SELECT e.delegation_id, e.delegate_id, e.structure_id, e.modules, tr.depends_on
    FROM expanded e JOIN target_rules tr ON tr.module = e.m
  ),
  agg AS (
    SELECT delegation_id, delegate_id, structure_id, modules,
           array_agg(DISTINCT m ORDER BY m) AS required
    FROM expanded GROUP BY delegation_id, delegate_id, structure_id, modules
  )
  SELECT a.delegation_id, a.delegate_id,
         (SELECT email FROM public.profiles WHERE id = a.delegate_id),
         a.structure_id, a.modules, a.required,
         ARRAY(SELECT unnest(a.required) EXCEPT SELECT unnest(a.modules))
  FROM agg a
  WHERE EXISTS (SELECT 1 FROM unnest(a.required) x WHERE x <> ALL(a.modules));
END $$;

GRANT EXECUTE ON FUNCTION public.dependency_version_impact(uuid) TO authenticated;

-- 3) Differenza tra due versioni (per il selettore di rollback)
CREATE OR REPLACE FUNCTION public.dependency_version_diff(_from uuid, _to uuid)
RETURNS TABLE(change text, module text, depends_on text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH a AS (
    SELECT (r->>'module')::text AS module, (r->>'depends_on')::text AS depends_on
    FROM public.module_dependency_versions v, jsonb_array_elements(v.rules) r
    WHERE v.id = _from
  ),
  b AS (
    SELECT (r->>'module')::text AS module, (r->>'depends_on')::text AS depends_on
    FROM public.module_dependency_versions v, jsonb_array_elements(v.rules) r
    WHERE v.id = _to
  )
  SELECT 'removed'::text, module, depends_on FROM a EXCEPT SELECT 'removed', module, depends_on FROM b
  UNION ALL
  SELECT 'added'::text, module, depends_on FROM b EXCEPT SELECT 'added', module, depends_on FROM a
$$;

GRANT EXECUTE ON FUNCTION public.dependency_version_diff(uuid, uuid) TO authenticated;
