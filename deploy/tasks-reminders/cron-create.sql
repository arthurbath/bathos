\set ON_ERROR_STOP on

DO $preflight$
DECLARE
  secret_count integer;
  dispatch_secret text;
BEGIN
  IF to_regclass('cron.job') IS NULL
    OR to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'pg_cron is not enabled';
  END IF;
  IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN
    RAISE EXCEPTION 'pg_net is not enabled';
  END IF;
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE EXCEPTION 'Supabase Vault is not enabled';
  END IF;

  SELECT count(*), min(decrypted_secret)
  INTO secret_count, dispatch_secret
  FROM vault.decrypted_secrets
  WHERE name = 'tasks_reminder_dispatch_secret';

  IF secret_count <> 1 OR octet_length(coalesce(dispatch_secret, '')) < 32 THEN
    RAISE EXCEPTION 'Vault must contain exactly one tasks_reminder_dispatch_secret of at least 32 bytes';
  END IF;
END
$preflight$;

SELECT cron.schedule(
  'tasks-dispatch-reminders',
  '* * * * *',
  $job$
    SELECT net.http_post(
      url := 'https://rsqfokyqntmtdejfwmjs.supabase.co/functions/v1/dispatch-task-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-tasks-dispatch-secret', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'tasks_reminder_dispatch_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    ) AS request_id;
  $job$
) AS tasks_reminder_cron_job_id;
