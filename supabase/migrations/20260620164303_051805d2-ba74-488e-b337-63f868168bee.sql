-- Sync function: marks expired trials/subscriptions as readonly
CREATE OR REPLACE FUNCTION public.subscriptions_sync_expired()
RETURNS TABLE(updated_org_id uuid, old_status subscription_status, new_status subscription_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH upd AS (
    UPDATE public.org_subscriptions s
       SET status = 'readonly'::subscription_status,
           updated_at = now()
     WHERE (
       (s.status = 'trial' AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at <= now())
       OR
       (s.status = 'active' AND s.current_period_end IS NOT NULL AND s.current_period_end <= now())
     )
    RETURNING s.org_id, s.status AS new_status
  )
  SELECT u.org_id, 'trial'::subscription_status, u.new_status FROM upd u;
END $$;

GRANT EXECUTE ON FUNCTION public.subscriptions_sync_expired() TO service_role;

-- Super admin force override: set tier/status, optionally extend trial or current period
CREATE OR REPLACE FUNCTION public.super_admin_force_subscription(
  _org uuid,
  _tier subscription_tier DEFAULT NULL,
  _status subscription_status DEFAULT NULL,
  _extend_days int DEFAULT NULL,
  _note text DEFAULT NULL
) RETURNS public.org_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.org_subscriptions;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Solo il super admin può forzare gli abbonamenti';
  END IF;

  UPDATE public.org_subscriptions s
     SET tier   = COALESCE(_tier, s.tier),
         status = COALESCE(_status, s.status),
         trial_ends_at = CASE
            WHEN _extend_days IS NOT NULL AND COALESCE(_status, s.status) = 'trial'
              THEN GREATEST(COALESCE(s.trial_ends_at, now()), now()) + (_extend_days || ' days')::interval
            ELSE s.trial_ends_at END,
         current_period_end = CASE
            WHEN _extend_days IS NOT NULL AND COALESCE(_status, s.status) = 'active'
              THEN GREATEST(COALESCE(s.current_period_end, now()), now()) + (_extend_days || ' days')::interval
            ELSE s.current_period_end END,
         current_period_start = CASE
            WHEN _status = 'active' AND s.status <> 'active' THEN now()
            ELSE s.current_period_start END,
         manual_payment_notes = COALESCE(_note, s.manual_payment_notes),
         updated_at = now()
   WHERE s.org_id = _org
   RETURNING * INTO v_row;

  INSERT INTO public.permission_audit(actor_id, entity, entity_id, action, after, reason)
  VALUES (auth.uid(), 'org_subscription', v_row.id, 'force_override', to_jsonb(v_row),
          COALESCE(_note, 'Override super admin'));

  RETURN v_row;
END $$;

GRANT EXECUTE ON FUNCTION public.super_admin_force_subscription(uuid, subscription_tier, subscription_status, int, text) TO authenticated;

-- Schedule hourly sync of expired subscriptions
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'subscriptions-sync-expired-hourly') THEN
    PERFORM cron.unschedule('subscriptions-sync-expired-hourly');
  END IF;
  PERFORM cron.schedule(
    'subscriptions-sync-expired-hourly',
    '5 * * * *',
    $cron$ SELECT public.subscriptions_sync_expired(); $cron$
  );
END $$;

-- Run once now to align current state
SELECT public.subscriptions_sync_expired();