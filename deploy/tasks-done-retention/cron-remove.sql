DO $remove_tasks_done_retention$
DECLARE
  job_id bigint;
BEGIN
  FOR job_id IN
    SELECT jobid FROM cron.job WHERE jobname = 'tasks-purge-expired-done'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END;
$remove_tasks_done_retention$;

SELECT count(*) AS remaining_tasks_done_retention_jobs
FROM cron.job
WHERE jobname = 'tasks-purge-expired-done';
