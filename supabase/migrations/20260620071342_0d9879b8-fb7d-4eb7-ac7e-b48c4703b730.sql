
DO $$
DECLARE
  v_url text := 'https://project--83b017ab-cb1a-4977-a89e-bc32522b4ed2.lovable.app/api/public/hooks/sla-notify';
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'SCHEDULER_SECRET' LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE NOTICE 'SCHEDULER_SECRET non trovato nel vault: salto schedulazione cron';
    RETURN;
  END IF;

  PERFORM cron.unschedule('sla-notify-dispatch') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='sla-notify-dispatch');

  PERFORM cron.schedule(
    'sla-notify-dispatch',
    '* * * * *',
    format($cron$SELECT net.http_post(
      url := %L,
      headers := jsonb_build_object('Content-Type','application/json','apikey', %L)
    );$cron$, v_url, v_secret)
  );
END $$;
