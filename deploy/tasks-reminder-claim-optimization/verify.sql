\set ON_ERROR_STOP on

DO $verification$
DECLARE
  _publication_tables text[];
  _retention_jobs integer;
BEGIN
  SELECT ARRAY(
    SELECT tablename::text
    FROM pg_publication_tables
    WHERE pubname = 'powersync' AND schemaname = 'public'
    ORDER BY tablename
  ) INTO _publication_tables;

  IF cardinality(_publication_tables) <> 16
    OR 'tasks_reminder_claims' = ANY (_publication_tables) THEN
    RAISE EXCEPTION
      'Expected the 16-table optimized publication without tasks_reminder_claims, found %',
      _publication_tables;
  END IF;

  IF has_table_privilege(
    'tasks_powersync_role', 'public.tasks_reminder_claims', 'SELECT'
  ) THEN
    RAISE EXCEPTION 'The PowerSync role still reads server-only claim receipts';
  END IF;

  IF to_regprocedure(
    'tasks_private.has_claimable_in_app_reminder(uuid,timestamp with time zone,uuid)'
  ) IS NULL OR to_regprocedure(
    'tasks_private.purge_expired_reminder_claims(timestamp with time zone)'
  ) IS NULL THEN
    RAISE EXCEPTION 'The optimized claim or retention functions are unavailable';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'tasks_private.purge_expired_reminder_claims(timestamp with time zone)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated clients can execute the private retention function';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT count(*) INTO _retention_jobs
    FROM cron.job
    WHERE jobname = 'tasks-purge-reminder-claims'
      AND schedule = '17 * * * *'
      AND command = 'SELECT tasks_private.purge_expired_reminder_claims();';
    IF _retention_jobs <> 1 THEN
      RAISE EXCEPTION 'Expected one hourly reminder-claim retention job, found %', _retention_jobs;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tasks_reminder_claims
    WHERE created_at < clock_timestamp() - interval '25 hours'
  ) THEN
    RAISE EXCEPTION 'Reminder claim receipts exceed the hourly 24-hour retention boundary';
  END IF;
END
$verification$;

SELECT
  count(*) AS retained_nonempty_receipts,
  min(created_at) AS oldest_retained_receipt,
  max(created_at) AS newest_retained_receipt,
  pg_size_pretty(pg_total_relation_size('public.tasks_reminder_claims'))
    AS receipt_table_size
FROM public.tasks_reminder_claims;
