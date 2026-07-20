\set ON_ERROR_STOP on

DO $rollback$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid
  INTO job_id
  FROM cron.job
  WHERE jobname = 'tasks-dispatch-reminders';

  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END
$rollback$;

SELECT count(*) AS remaining_tasks_reminder_cron_jobs
FROM cron.job
WHERE jobname = 'tasks-dispatch-reminders';
