DROP PUBLICATION IF EXISTS powersync;

CREATE PUBLICATION powersync FOR TABLE
  public.tasks_areas,
  public.tasks_projects,
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
  public.tasks_reminder_claims;
