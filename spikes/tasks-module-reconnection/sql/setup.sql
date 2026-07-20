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
  public.tasks_user_settings;
