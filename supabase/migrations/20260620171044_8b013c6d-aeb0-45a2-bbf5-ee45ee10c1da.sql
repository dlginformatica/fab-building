
-- =========================================================
-- Fase 21.1 — Sync lock/queue, notifiche, trial custom
-- =========================================================

-- 1) Tabella job/log per sincronizzazioni abbonamento
CREATE TABLE IF NOT EXISTS public.subscription_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('queued','running','success','failed','skipped_locked')),
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_source text NOT NULL DEFAULT 'manual'
    CHECK (trigger_source IN ('manual','cron','retry')),
  attempts smallint NOT NULL DEFAULT 1,
  processed_count int NOT NULL DEFAULT 0,
  error_message text,
  details jsonb,
  parent_job_id uuid REFERENCES public.subscription_sync_jobs(id) ON DELETE SET NULL
);

GRANT SELECT ON public.subscription_sync_jobs TO authenticated;
GRANT ALL ON public.subscription_sync_jobs TO service_role;

ALTER TABLE public.subscription_sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin sees sync jobs" ON public.subscription_sync_jobs;
CREATE POLICY "Super admin sees sync jobs" ON public.subscription_sync_jobs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));

-- 2) Sync wrapper con advisory lock + retry + notifiche
CREATE OR REPLACE FUNCTION public.subscriptions_sync_run(
  _source text DEFAULT 'manual',
  _parent uuid DEFAULT NULL
) RETURNS public.subscription_sync_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job public.subscription_sync_jobs;
  v_lock_key bigint := 894231007;
  v_attempt smallint := 1;
  v_rows record;
  v_count int := 0;
  v_actor uuid := auth.uid();
  v_changes jsonb := '[]'::jsonb;
BEGIN
  IF _source = 'manual' AND NOT public.has_role(v_actor,'super_admin') THEN
    RAISE EXCEPTION 'Solo il super admin può forzare la sincronizzazione';
  END IF;

  IF _parent IS NOT NULL THEN
    SELECT attempts+1 INTO v_attempt FROM public.subscription_sync_jobs WHERE id = _parent;
    IF v_attempt IS NULL THEN v_attempt := 1; END IF;
  END IF;

  INSERT INTO public.subscription_sync_jobs(
    status, triggered_by, trigger_source, attempts, parent_job_id
  ) VALUES ('running', v_actor, _source, v_attempt, _parent)
  RETURNING * INTO v_job;

  -- Lock cooperativo: salta se un altro run è in corso
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    UPDATE public.subscription_sync_jobs
      SET status='skipped_locked', finished_at=now(),
          error_message='Un altro run è in corso (lock attivo)'
      WHERE id = v_job.id RETURNING * INTO v_job;
    RETURN v_job;
  END IF;

  BEGIN
    FOR v_rows IN
      WITH upd AS (
        UPDATE public.org_subscriptions s
           SET status='readonly'::subscription_status, updated_at=now()
         WHERE (
           (s.status='trial'  AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at <= now())
           OR
           (s.status='active' AND s.current_period_end IS NOT NULL AND s.current_period_end <= now())
         )
        RETURNING s.org_id, s.id AS sub_id, s.status, s.trial_ends_at, s.current_period_end,
                  (CASE WHEN s.trial_ends_at IS NOT NULL AND s.trial_ends_at <= now()
                        THEN 'trial_ended' ELSE 'subscription_expired' END) AS kind
      )
      SELECT * FROM upd
    LOOP
      v_count := v_count + 1;
      v_changes := v_changes || jsonb_build_object(
        'org_id', v_rows.org_id, 'kind', v_rows.kind,
        'trial_ends_at', v_rows.trial_ends_at, 'period_end', v_rows.current_period_end
      );

      -- Notifica in-app a owner + admin dell'org
      INSERT INTO public.admin_alerts(org_id, admin_user_id, source_user_id, kind, reason, payload)
      SELECT v_rows.org_id, m.user_id, NULL, v_rows.kind,
             CASE WHEN v_rows.kind = 'trial_ended'
                  THEN 'Periodo di prova terminato — passa a Sola lettura'
                  ELSE 'Abbonamento scaduto — passa a Sola lettura' END,
             jsonb_build_object(
               'sub_id', v_rows.sub_id,
               'status', 'readonly',
               'billing_url', '/app/billing'
             )
      FROM public.org_memberships m
      WHERE m.org_id = v_rows.org_id AND m.role IN ('owner','admin')
      ON CONFLICT DO NOTHING;
    END LOOP;

    UPDATE public.subscription_sync_jobs
       SET status='success', finished_at=now(),
           processed_count=v_count,
           details=jsonb_build_object('changes', v_changes)
     WHERE id = v_job.id
    RETURNING * INTO v_job;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.subscription_sync_jobs
       SET status='failed', finished_at=now(),
           processed_count=v_count,
           error_message=SQLERRM,
           details=jsonb_build_object('changes', v_changes, 'sqlstate', SQLSTATE)
     WHERE id = v_job.id
    RETURNING * INTO v_job;
  END;

  RETURN v_job;
END $$;

REVOKE ALL ON FUNCTION public.subscriptions_sync_run(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.subscriptions_sync_run(text, uuid) TO authenticated;

-- Retry: rilancia un job fallito come nuovo run linked
CREATE OR REPLACE FUNCTION public.subscriptions_sync_retry(_job uuid)
RETURNS public.subscription_sync_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.subscription_sync_jobs;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Solo il super admin può eseguire retry';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.subscription_sync_jobs WHERE id=_job AND status IN ('failed','skipped_locked')) THEN
    RAISE EXCEPTION 'Job non eleggibile per retry';
  END IF;
  v := public.subscriptions_sync_run('retry', _job);
  RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.subscriptions_sync_retry(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.subscriptions_sync_retry(uuid) TO authenticated;

-- 3) Allinea il cron al nuovo wrapper (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('subscriptions-sync-expired-hourly') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname='subscriptions-sync-expired-hourly'
    );
    PERFORM cron.schedule(
      'subscriptions-sync-run-5min',
      '*/5 * * * *',
      $cron$ SELECT public.subscriptions_sync_run('cron', NULL); $cron$
    ) WHERE NOT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname='subscriptions-sync-run-5min'
    );
  END IF;
END $$;

-- 4) Trial custom per organizzazione
CREATE OR REPLACE FUNCTION public.super_admin_set_trial_days(
  _org uuid, _days int, _note text DEFAULT NULL
) RETURNS public.org_subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.org_subscriptions;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Solo il super admin può impostare il trial custom';
  END IF;
  IF _days IS NULL OR _days < 0 OR _days > 3650 THEN
    RAISE EXCEPTION 'Durata trial non valida (0..3650 giorni)';
  END IF;

  UPDATE public.org_subscriptions s
     SET status='trial'::subscription_status,
         trial_started_at = COALESCE(s.trial_started_at, now()),
         trial_ends_at    = now() + (_days || ' days')::interval,
         updated_at = now(),
         manual_payment_notes = COALESCE(_note, s.manual_payment_notes)
   WHERE s.org_id = _org
  RETURNING * INTO v;

  IF v.id IS NULL THEN
    INSERT INTO public.org_subscriptions(org_id, tier, status, trial_started_at, trial_ends_at, manual_payment_notes)
    VALUES (_org, 'small', 'trial', now(), now() + (_days || ' days')::interval, _note)
    RETURNING * INTO v;
  END IF;

  INSERT INTO public.permission_audit(actor_id, entity, entity_id, action, after, reason)
  VALUES (auth.uid(),'org_subscription', v.id, 'set_trial_days',
          to_jsonb(v) || jsonb_build_object('days', _days),
          COALESCE(_note, 'Trial custom impostato a '||_days||' giorni'));
  RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.super_admin_set_trial_days(uuid, int, text) FROM public;
GRANT EXECUTE ON FUNCTION public.super_admin_set_trial_days(uuid, int, text) TO authenticated;

-- 5) Vista audit ergonomica: chi ha forzato cosa
CREATE OR REPLACE VIEW public.v_subscription_audit AS
SELECT
  pa.id, pa.created_at, pa.actor_id,
  prof.email AS actor_email, prof.full_name AS actor_name,
  pa.entity_id AS sub_id,
  s.org_id, o.name AS org_name,
  pa.action,
  pa.reason,
  pa.before,
  pa.after,
  (pa.before->>'tier')   AS old_tier,
  (pa.after ->>'tier')   AS new_tier,
  (pa.before->>'status') AS old_status,
  (pa.after ->>'status') AS new_status
FROM public.permission_audit pa
LEFT JOIN public.org_subscriptions s ON s.id = pa.entity_id
LEFT JOIN public.organizations o ON o.id = s.org_id
LEFT JOIN public.profiles prof ON prof.id = pa.actor_id
WHERE pa.entity = 'org_subscription'
ORDER BY pa.created_at DESC;

GRANT SELECT ON public.v_subscription_audit TO authenticated;
