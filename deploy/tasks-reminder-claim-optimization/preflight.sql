\set ON_ERROR_STOP on

DO $preflight$
DECLARE
  _publication_tables text[];
BEGIN
  SELECT ARRAY(
    SELECT tablename::text
    FROM pg_publication_tables
    WHERE pubname = 'powersync' AND schemaname = 'public'
    ORDER BY tablename
  ) INTO _publication_tables;

  IF cardinality(_publication_tables) <> 17
    OR NOT ('tasks_reminder_claims' = ANY (_publication_tables)) THEN
    RAISE EXCEPTION
      'Expected the reviewed 17-table pre-release publication including tasks_reminder_claims, found %',
      _publication_tables;
  END IF;

  IF NOT has_table_privilege(
    'tasks_powersync_role', 'public.tasks_reminder_claims', 'SELECT'
  ) THEN
    RAISE EXCEPTION 'The pre-release PowerSync role grant has already drifted';
  END IF;

  IF to_regprocedure(
    'public.tasks_claim_due_reminders_v2(timestamp with time zone,uuid,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'The surface-scoped reminder claim RPC is unavailable';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_cron'
  ) AND EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'tasks-purge-reminder-claims'
  ) THEN
    RAISE EXCEPTION 'The reminder-claim retention cron job already exists';
  END IF;
END
$preflight$;

SELECT
  count(*) AS total_receipts,
  count(*) FILTER (
    WHERE jsonb_array_length(COALESCE(result -> 'items', '[]'::jsonb)) = 0
  ) AS empty_receipts,
  count(*) FILTER (WHERE created_at >= clock_timestamp() - interval '24 hours')
    AS receipts_last_24_hours,
  min(created_at) AS oldest_receipt,
  max(created_at) AS newest_receipt,
  pg_size_pretty(pg_total_relation_size('public.tasks_reminder_claims'))
    AS receipt_table_size
FROM public.tasks_reminder_claims;

SELECT
  count(*) AS in_app_targets,
  count(*) FILTER (WHERE last_seen_at >= clock_timestamp() - interval '24 hours')
    AS in_app_targets_seen_last_24_hours
FROM public.tasks_delivery_targets
WHERE channel = 'in_app';
