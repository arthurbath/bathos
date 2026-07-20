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
