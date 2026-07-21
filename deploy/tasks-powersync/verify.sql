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
  accessible_schemas text[];
  role_memberships text[];
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

  SELECT rolcanlogin, rolreplication, rolbypassrls, rolsuper, rolcreatedb, rolcreaterole,
    rolinherit
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
    OR role_record.rolcreaterole
    OR role_record.rolinherit THEN
    RAISE EXCEPTION 'tasks_powersync_role has unexpected role attributes';
  END IF;

  SELECT ARRAY(
    SELECT granted.rolname::text
    FROM pg_catalog.pg_auth_members AS role_membership
    JOIN pg_catalog.pg_roles AS granted
      ON granted.oid = role_membership.roleid
    JOIN pg_catalog.pg_roles AS member
      ON member.oid = role_membership.member
    WHERE member.rolname = 'tasks_powersync_role'
    ORDER BY granted.rolname
  ) INTO role_memberships;
  IF cardinality(role_memberships) > 0 THEN
    RAISE EXCEPTION 'PowerSync role has unexpected role memberships: %', role_memberships;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_namespace AS namespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(namespace.nspacl) AS privilege
    WHERE namespace.nspname = 'net'
      AND namespace.nspacl IS NOT NULL
      AND privilege.grantee = (
        SELECT oid
        FROM pg_catalog.pg_roles
        WHERE rolname = 'tasks_powersync_role'
      )
  ) THEN
    RAISE EXCEPTION 'PowerSync role has a direct grant on the managed pg_net schema';
  END IF;

  SELECT ARRAY(
    SELECT namespace.nspname::text
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname !~ '^pg_'
      AND namespace.nspname <> 'information_schema'
      AND has_schema_privilege(
        'tasks_powersync_role', namespace.oid, 'USAGE'
      )
    ORDER BY namespace.nspname
  ) INTO accessible_schemas;
  IF accessible_schemas IS DISTINCT FROM ARRAY['public']::text[]
    AND accessible_schemas IS DISTINCT FROM ARRAY['net', 'public']::text[] THEN
    RAISE EXCEPTION 'PowerSync role can use schemas outside its approved boundary: %', accessible_schemas;
  END IF;

  IF accessible_schemas = ARRAY['net', 'public']::text[] AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_namespace AS namespace
    JOIN pg_catalog.pg_roles AS owner_role
      ON owner_role.oid = namespace.nspowner
    WHERE namespace.nspname = 'net'
      AND owner_role.rolname = 'supabase_admin'
  ) THEN
    RAISE EXCEPTION 'The managed pg_net exception is not owned by supabase_admin';
  END IF;

  IF has_database_privilege(
    'tasks_powersync_role', current_database(), 'CREATE'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname !~ '^pg_'
      AND namespace.nspname <> 'information_schema'
      AND has_schema_privilege(
        'tasks_powersync_role', namespace.oid, 'CREATE'
      )
  ) THEN
    RAISE EXCEPTION 'PowerSync role can create persistent database objects';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.prosecdef
      AND has_function_privilege(
        'tasks_powersync_role', procedure.oid, 'EXECUTE'
      )
  ) THEN
    RAISE EXCEPTION 'PowerSync role can execute a public SECURITY DEFINER function';
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

  SELECT ARRAY(
    SELECT pg_catalog.format('%I.%I', namespace.nspname, relation.relname)
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE relation.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND namespace.nspname !~ '^pg_'
      AND namespace.nspname <> 'information_schema'
      AND has_schema_privilege(
        'tasks_powersync_role', namespace.oid, 'USAGE'
      )
      AND (
        has_table_privilege('tasks_powersync_role', relation.oid, 'SELECT')
        OR has_table_privilege('tasks_powersync_role', relation.oid, 'INSERT')
        OR has_table_privilege('tasks_powersync_role', relation.oid, 'UPDATE')
        OR has_table_privilege('tasks_powersync_role', relation.oid, 'DELETE')
        OR has_table_privilege('tasks_powersync_role', relation.oid, 'TRUNCATE')
        OR has_table_privilege('tasks_powersync_role', relation.oid, 'REFERENCES')
        OR has_table_privilege('tasks_powersync_role', relation.oid, 'TRIGGER')
      )
      AND NOT (
        namespace.nspname = 'public'
        AND relation.relname = ANY (expected_tables)
        AND has_table_privilege('tasks_powersync_role', relation.oid, 'SELECT')
        AND NOT has_table_privilege('tasks_powersync_role', relation.oid, 'INSERT')
        AND NOT has_table_privilege('tasks_powersync_role', relation.oid, 'UPDATE')
        AND NOT has_table_privilege('tasks_powersync_role', relation.oid, 'DELETE')
        AND NOT has_table_privilege('tasks_powersync_role', relation.oid, 'TRUNCATE')
        AND NOT has_table_privilege('tasks_powersync_role', relation.oid, 'REFERENCES')
        AND NOT has_table_privilege('tasks_powersync_role', relation.oid, 'TRIGGER')
        OR (
          namespace.nspname = 'net'
          AND relation.relname IN ('_http_response', 'http_request_queue')
          AND relation.relowner = (
            SELECT oid
            FROM pg_catalog.pg_roles
            WHERE rolname = 'supabase_admin'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM pg_catalog.aclexplode(relation.relacl) AS privilege
            WHERE relation.relacl IS NOT NULL
              AND privilege.grantee = (
                SELECT oid
                FROM pg_catalog.pg_roles
                WHERE rolname = 'tasks_powersync_role'
              )
          )
        )
      )
    ORDER BY namespace.nspname, relation.relname
  ) INTO invalid_tables;
  IF cardinality(invalid_tables) > 0 THEN
    RAISE EXCEPTION 'PowerSync role has usable relation privileges outside exact Tasks SELECT and the managed pg_net exception: %', invalid_tables;
  END IF;

  SELECT ARRAY(
    SELECT pg_catalog.format(
      '%I.%I.%I', namespace.nspname, relation.relname, attribute.attname
    )
    FROM pg_catalog.pg_attribute AS attribute
    JOIN pg_catalog.pg_class AS relation
      ON relation.oid = attribute.attrelid
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND namespace.nspname !~ '^pg_'
      AND namespace.nspname <> 'information_schema'
      AND has_schema_privilege(
        'tasks_powersync_role', namespace.oid, 'USAGE'
      )
      AND (
        has_column_privilege(
          'tasks_powersync_role', relation.oid, attribute.attnum, 'SELECT'
        )
        OR has_column_privilege(
          'tasks_powersync_role', relation.oid, attribute.attnum, 'INSERT'
        )
        OR has_column_privilege(
          'tasks_powersync_role', relation.oid, attribute.attnum, 'UPDATE'
        )
        OR has_column_privilege(
          'tasks_powersync_role', relation.oid, attribute.attnum, 'REFERENCES'
        )
      )
      AND NOT (
        namespace.nspname = 'public'
        AND relation.relname = ANY (expected_tables)
        AND has_column_privilege(
          'tasks_powersync_role', relation.oid, attribute.attnum, 'SELECT'
        )
        AND NOT has_column_privilege(
          'tasks_powersync_role', relation.oid, attribute.attnum, 'INSERT'
        )
        AND NOT has_column_privilege(
          'tasks_powersync_role', relation.oid, attribute.attnum, 'UPDATE'
        )
        AND NOT has_column_privilege(
          'tasks_powersync_role', relation.oid, attribute.attnum, 'REFERENCES'
        )
        OR (
          namespace.nspname = 'net'
          AND relation.relname IN ('_http_response', 'http_request_queue')
          AND relation.relowner = (
            SELECT oid
            FROM pg_catalog.pg_roles
            WHERE rolname = 'supabase_admin'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM pg_catalog.aclexplode(attribute.attacl) AS privilege
            WHERE attribute.attacl IS NOT NULL
              AND privilege.grantee = (
                SELECT oid
                FROM pg_catalog.pg_roles
                WHERE rolname = 'tasks_powersync_role'
              )
          )
        )
      )
    ORDER BY namespace.nspname, relation.relname, attribute.attnum
  ) INTO invalid_tables;
  IF cardinality(invalid_tables) > 0 THEN
    RAISE EXCEPTION 'PowerSync role has usable column privileges outside exact Tasks SELECT and the managed pg_net exception: %', invalid_tables;
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
