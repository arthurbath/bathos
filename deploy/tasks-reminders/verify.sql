\set ON_ERROR_STOP on

DO $validation$
DECLARE
  secret_count integer;
  dispatch_secret text;
  job_count integer;
  job_active boolean;
  job_schedule text;
  job_command text;
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
    RAISE EXCEPTION 'Vault reminder dispatch secret is absent, duplicated, or too short';
  END IF;

  SELECT count(*), bool_and(active), min(schedule), min(command)
  INTO job_count, job_active, job_schedule, job_command
  FROM cron.job
  WHERE jobname = 'tasks-dispatch-reminders';

  IF job_count <> 1 OR job_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected exactly one active tasks-dispatch-reminders Cron job';
  END IF;
  IF job_schedule IS DISTINCT FROM '* * * * *' THEN
    RAISE EXCEPTION 'Task reminder Cron schedule is not once per minute';
  END IF;
  IF position('https://rsqfokyqntmtdejfwmjs.supabase.co/functions/v1/dispatch-task-reminders' in job_command) = 0
    OR position('x-tasks-dispatch-secret' in job_command) = 0
    OR position('tasks_reminder_dispatch_secret' in job_command) = 0 THEN
    RAISE EXCEPTION 'Task reminder Cron command differs from the approved endpoint and Vault lookup';
  END IF;
  IF position(dispatch_secret in job_command) > 0 THEN
    RAISE EXCEPTION 'Task reminder Cron command contains the decrypted secret';
  END IF;
END
$validation$;

SELECT
  'ready' AS tasks_reminder_delivery_status,
  jobid AS cron_job_id,
  schedule,
  active,
  clock_timestamp() AS verified_at
FROM cron.job
WHERE jobname = 'tasks-dispatch-reminders';
