DO $verify_tasks_done_retention$
DECLARE
  job_count integer;
  job_schedule text;
  job_command text;
BEGIN
  IF to_regprocedure('tasks_private.purge_expired_done(timestamptz,integer)') IS NULL THEN
    RAISE EXCEPTION 'Tasks Done purge function is missing';
  END IF;
  IF to_regclass('tasks_private.purged_creation_receipts') IS NULL THEN
    RAISE EXCEPTION 'Tasks purged-creation receipt table is missing';
  END IF;
  IF has_function_privilege(
    'authenticated', 'tasks_private.purge_expired_done(timestamptz,integer)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated users can execute the Tasks Done purge';
  END IF;
  IF NOT has_function_privilege(
    'service_role', 'tasks_private.purge_expired_done(timestamptz,integer)', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Service role cannot execute the Tasks Done purge';
  END IF;
  IF has_table_privilege(
    'authenticated', 'tasks_private.purged_creation_receipts', 'SELECT'
  ) THEN
    RAISE EXCEPTION 'Authenticated users can read private purge receipts';
  END IF;

  SELECT count(*), min(schedule), min(command)
  INTO job_count, job_schedule, job_command
  FROM cron.job
  WHERE jobname = 'tasks-purge-expired-done' AND active;

  IF job_count <> 1 OR job_schedule <> '* * * * *'
    OR job_command <> 'SELECT tasks_private.purge_expired_done();' THEN
    RAISE EXCEPTION 'Tasks Done purge Cron differs from the approved definition';
  END IF;
END;
$verify_tasks_done_retention$;

SELECT 'ready' AS tasks_done_retention_status,
  jobid, schedule, active
FROM cron.job
WHERE jobname = 'tasks-purge-expired-done';
