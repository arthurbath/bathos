\set ON_ERROR_STOP on
\getenv tasks_powersync_password TASKS_POWERSYNC_DATABASE_PASSWORD

\if :{?tasks_powersync_password}
\else
  DO $missing_password$
  BEGIN
    RAISE EXCEPTION 'TASKS_POWERSYNC_DATABASE_PASSWORD is required';
  END
  $missing_password$;
\endif

SELECT length(:'tasks_powersync_password') >= 32 AS tasks_powersync_password_is_long_enough \gset
\if :tasks_powersync_password_is_long_enough
\else
  DO $short_password$
  BEGIN
    RAISE EXCEPTION 'TASKS_POWERSYNC_DATABASE_PASSWORD must contain at least 32 characters';
  END
  $short_password$;
\endif

SELECT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = 'tasks_powersync_role'
) AS tasks_powersync_role_exists \gset

\if :tasks_powersync_role_exists
  ALTER ROLE tasks_powersync_role
    WITH LOGIN REPLICATION BYPASSRLS PASSWORD :'tasks_powersync_password';
\else
  CREATE ROLE tasks_powersync_role
    WITH LOGIN REPLICATION BYPASSRLS PASSWORD :'tasks_powersync_password';
\endif

-- TASKS_POWERSYNC_ROLE_NORMALIZATION
DO $assert_tasks_powersync_role_not_superuser$
BEGIN
  IF (
    SELECT rolsuper
    FROM pg_catalog.pg_roles
    WHERE rolname = 'tasks_powersync_role'
  ) THEN
    RAISE EXCEPTION
      'tasks_powersync_role is a superuser; a database superuser must remove that attribute before provisioning can continue';
  END IF;
END
$assert_tasks_powersync_role_not_superuser$;

ALTER ROLE tasks_powersync_role
  WITH LOGIN REPLICATION BYPASSRLS
  NOCREATEDB NOCREATEROLE NOINHERIT;

DO $normalize_tasks_powersync_role$
DECLARE
  membership record;
  namespace_name text;
  relation_grant record;
  column_grant record;
  routine_grant record;
  tasks_powersync_role_oid oid;
BEGIN
  SELECT oid
  INTO tasks_powersync_role_oid
  FROM pg_catalog.pg_roles
  WHERE rolname = 'tasks_powersync_role';

  FOR membership IN
    SELECT granted.rolname
    FROM pg_catalog.pg_auth_members AS role_membership
    JOIN pg_catalog.pg_roles AS granted
      ON granted.oid = role_membership.roleid
    JOIN pg_catalog.pg_roles AS member
      ON member.oid = role_membership.member
    WHERE member.rolname = 'tasks_powersync_role'
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE %I FROM tasks_powersync_role',
      membership.rolname
    );
  END LOOP;

  FOR namespace_name IN
    SELECT namespace.nspname
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspacl IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.aclexplode(namespace.nspacl) AS privilege
        WHERE privilege.grantee = tasks_powersync_role_oid
      )
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE ALL PRIVILEGES ON SCHEMA %I FROM tasks_powersync_role',
      namespace_name
    );
  END LOOP;

  FOR relation_grant IN
    SELECT
      namespace.nspname,
      relation.relname,
      relation.relkind
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE relation.relacl IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.aclexplode(relation.relacl) AS privilege
        WHERE privilege.grantee = tasks_powersync_role_oid
      )
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE ALL PRIVILEGES ON %s %I.%I FROM tasks_powersync_role',
      CASE relation_grant.relkind
        WHEN 'S' THEN 'SEQUENCE'
        ELSE 'TABLE'
      END,
      relation_grant.nspname,
      relation_grant.relname
    );
  END LOOP;

  FOR column_grant IN
    SELECT
      namespace.nspname,
      relation.relname,
      attribute.attname
    FROM pg_catalog.pg_attribute AS attribute
    JOIN pg_catalog.pg_class AS relation
      ON relation.oid = attribute.attrelid
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND attribute.attacl IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.aclexplode(attribute.attacl) AS privilege
        WHERE privilege.grantee = tasks_powersync_role_oid
      )
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE ALL PRIVILEGES (%I) ON TABLE %I.%I FROM tasks_powersync_role',
      column_grant.attname,
      column_grant.nspname,
      column_grant.relname
    );
  END LOOP;

  FOR routine_grant IN
    SELECT
      namespace.nspname,
      procedure.proname,
      procedure.prokind,
      pg_catalog.pg_get_function_identity_arguments(procedure.oid) AS identity_arguments
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    WHERE procedure.prokind IN ('f', 'p', 'w')
      AND procedure.proacl IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.aclexplode(procedure.proacl) AS privilege
        WHERE privilege.grantee = tasks_powersync_role_oid
      )
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE ALL PRIVILEGES ON %s %I.%I(%s) FROM tasks_powersync_role',
      CASE routine_grant.prokind
        WHEN 'p' THEN 'PROCEDURE'
        ELSE 'FUNCTION'
      END,
      routine_grant.nspname,
      routine_grant.proname,
      routine_grant.identity_arguments
    );
  END LOOP;
END
$normalize_tasks_powersync_role$;

REVOKE ALL PRIVILEGES ON DATABASE postgres FROM tasks_powersync_role;
GRANT CONNECT ON DATABASE postgres TO tasks_powersync_role;
GRANT USAGE ON SCHEMA public TO tasks_powersync_role;
GRANT SELECT ON TABLE
  public.tasks_areas,
  public.tasks_projects,
  public.tasks_headings,
  public.tasks_todos,
  public.tasks_checklist_items,
  public.tasks_history_events,
  public.tasks_hierarchy_operations,
  public.tasks_hierarchy_history_events,
  public.tasks_user_settings,
  public.tasks_templates,
  public.tasks_template_revisions,
  public.tasks_template_instantiations,
  public.tasks_recurrence_definitions,
  public.tasks_recurrence_revisions,
  public.tasks_recurrence_occurrences,
  public.tasks_recurrence_evaluations,
  public.tasks_recurrence_status_events,
  public.tasks_reminders,
  public.tasks_reminder_occurrences,
  public.tasks_delivery_targets,
  public.tasks_reminder_deliveries,
  public.tasks_reminder_claims
TO tasks_powersync_role;
