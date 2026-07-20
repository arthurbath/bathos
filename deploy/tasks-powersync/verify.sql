\set ON_ERROR_STOP on

DO $validation$
DECLARE
  expected_tables text[] := ARRAY[
    'tasks_areas',
    'tasks_checklist_items',
    'tasks_delivery_targets',
    'tasks_headings',
    'tasks_hierarchy_history_events',
    'tasks_hierarchy_operations',
    'tasks_history_events',
    'tasks_projects',
    'tasks_recurrence_definitions',
    'tasks_recurrence_evaluations',
    'tasks_recurrence_occurrences',
    'tasks_recurrence_revisions',
    'tasks_recurrence_status_events',
    'tasks_reminder_claims',
    'tasks_reminder_deliveries',
    'tasks_reminder_occurrences',
    'tasks_reminders',
    'tasks_template_instantiations',
    'tasks_template_revisions',
    'tasks_templates',
    'tasks_todos',
    'tasks_user_settings'
  ];
  actual_tables text[];
  invalid_tables text[];
  role_record record;
BEGIN
  SELECT ARRAY(
    SELECT tablename::text
    FROM pg_publication_tables
    WHERE pubname = 'powersync' AND schemaname = 'public'
    ORDER BY tablename
  ) INTO actual_tables;
  IF actual_tables IS DISTINCT FROM expected_tables THEN
    RAISE EXCEPTION 'PowerSync publication differs from the approved task table set: %', actual_tables;
  END IF;

  SELECT ARRAY(
    SELECT relation.relname::text
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = ANY (expected_tables)
      AND (NOT relation.relrowsecurity OR relation.relreplident <> 'f')
    ORDER BY relation.relname
  ) INTO invalid_tables;
  IF cardinality(invalid_tables) > 0 THEN
    RAISE EXCEPTION 'Synchronized tables missing RLS or full replica identity: %', invalid_tables;
  END IF;

  SELECT rolcanlogin, rolreplication, rolbypassrls, rolsuper, rolcreatedb, rolcreaterole
  INTO role_record
  FROM pg_roles
  WHERE rolname = 'tasks_powersync_role';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tasks_powersync_role does not exist';
  END IF;
  IF NOT role_record.rolcanlogin
    OR NOT role_record.rolreplication
    OR NOT role_record.rolbypassrls
    OR role_record.rolsuper
    OR role_record.rolcreatedb
    OR role_record.rolcreaterole THEN
    RAISE EXCEPTION 'tasks_powersync_role has unexpected role attributes';
  END IF;

  SELECT ARRAY(
    SELECT table_name
    FROM unnest(expected_tables) AS table_name
    WHERE NOT has_table_privilege(
      'tasks_powersync_role',
      format('public.%I', table_name),
      'SELECT'
    )
    ORDER BY table_name
  ) INTO invalid_tables;
  IF cardinality(invalid_tables) > 0 THEN
    RAISE EXCEPTION 'PowerSync role cannot select approved tables: %', invalid_tables;
  END IF;

  SELECT ARRAY(
    SELECT table_name::text
    FROM information_schema.role_table_grants
    WHERE grantee = 'tasks_powersync_role'
      AND table_schema = 'public'
      AND privilege_type = 'SELECT'
      AND NOT (table_name = ANY (expected_tables))
    ORDER BY table_name
  ) INTO invalid_tables;
  IF cardinality(invalid_tables) > 0 THEN
    RAISE EXCEPTION 'PowerSync role has explicit SELECT grants outside Tasks: %', invalid_tables;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'powersync'
      AND tablename IN ('tasks_web_push_subscriptions', 'tasks_mail_sources')
  ) THEN
    RAISE EXCEPTION 'The publication contains a server-only task table';
  END IF;
END
$validation$;

SELECT
  'ready' AS tasks_powersync_database_status,
  22 AS synchronized_table_count,
  current_database() AS database_name,
  clock_timestamp() AS verified_at;
