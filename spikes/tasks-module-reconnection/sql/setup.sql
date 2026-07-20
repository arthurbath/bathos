DROP PUBLICATION IF EXISTS powersync;

CREATE PUBLICATION powersync FOR TABLE
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
  public.tasks_reminders;
