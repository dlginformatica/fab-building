
ALTER TABLE public.backup_runs
  ADD COLUMN IF NOT EXISTS integrity_hash text,
  ADD COLUMN IF NOT EXISTS integrity_status text NOT NULL DEFAULT 'unverified'
    CHECK (integrity_status IN ('unverified','verified','mismatch','missing','error')),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_ms int;

ALTER TABLE public.restore_runs
  ADD COLUMN IF NOT EXISTS steps_total int,
  ADD COLUMN IF NOT EXISTS steps_done int,
  ADD COLUMN IF NOT EXISTS current_step text,
  ADD COLUMN IF NOT EXISTS progress jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.notify_org_admins(
  _org uuid, _kind text, _reason text, _payload jsonb DEFAULT '{}'::jsonb
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0;
BEGIN
  INSERT INTO public.admin_alerts(org_id, admin_user_id, source_user_id, kind, reason, payload)
  SELECT _org, m.user_id, auth.uid(), _kind, _reason, COALESCE(_payload,'{}'::jsonb)
  FROM public.org_memberships m
  WHERE m.org_id = _org AND m.role IN ('owner','admin');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.notify_org_admins(uuid, text, text, jsonb) TO authenticated;
