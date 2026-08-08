DROP PUBLICATION IF EXISTS powersync;

CREATE OR REPLACE FUNCTION public.tasks_test_grant_module_access_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.bathos_module_access_grants (
    module_id, user_id, grant_source, granted_by
  ) VALUES (
    'tasks', NEW.id, 'manual', NULL
  )
  ON CONFLICT (module_id, user_id, grant_source) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_test_grant_module_access_on_signup ON auth.users;
CREATE TRIGGER tasks_test_grant_module_access_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.tasks_test_grant_module_access_on_signup();

CREATE PUBLICATION powersync FOR TABLE
  public.bathos_module_access_grants,
  public.tasks_areas,
  public.tasks_todos,
  public.tasks_checklist_items,
  public.tasks_history_events,
  public.tasks_hierarchy_operations,
  public.tasks_hierarchy_history_events,
  public.tasks_user_settings,
  public.tasks_recurrence_definitions,
  public.tasks_recurrence_revisions,
  public.tasks_recurrence_occurrences,
  public.tasks_recurrence_evaluations,
  public.tasks_recurrence_status_events,
  public.tasks_reminders,
  public.tasks_reminder_occurrences,
  public.tasks_delivery_targets,
  public.tasks_reminder_deliveries;
