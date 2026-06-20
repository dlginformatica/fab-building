
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
DECLARE v_rules jsonb;
BEGIN
  SELECT rules INTO v_rules FROM public.module_dependency_versions WHERE id = _target;
  IF v_rules IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH RECURSIVE target_rules AS (
    SELECT (r->>'module')::text AS module, (r->>'depends_on')::text AS depends_on
    FROM jsonb_array_elements(v_rules) r
  ),
  base AS (
    SELECT d.id AS did, d.delegate_id AS uid, d.structure_id AS sid, d.modules AS mods,
           unnest(d.modules) AS m
    FROM public.user_delegations d
    WHERE d.active = true AND NOT ('*' = ANY(d.modules))
  ),
  expanded AS (
    SELECT did, uid, sid, mods, m FROM base
    UNION
    SELECT e.did, e.uid, e.sid, e.mods, tr.depends_on
    FROM expanded e JOIN target_rules tr ON tr.module = e.m
  ),
  agg AS (
    SELECT did, uid, sid, mods, array_agg(DISTINCT m ORDER BY m) AS required
    FROM expanded GROUP BY did, uid, sid, mods
  )
  SELECT a.did, a.uid,
         (SELECT email FROM public.profiles WHERE id = a.uid),
         a.sid, a.mods, a.required,
         ARRAY(SELECT unnest(a.required) EXCEPT SELECT unnest(a.mods))
  FROM agg a
  WHERE EXISTS (SELECT 1 FROM unnest(a.required) x WHERE x <> ALL(a.mods));
END $$;
