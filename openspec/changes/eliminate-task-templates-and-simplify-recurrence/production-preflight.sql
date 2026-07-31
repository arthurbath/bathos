-- Content-free, read-only production preflight for
-- 20260731132825_eliminate_task_templates_and_simplify_recurrence.sql.
--
-- The query intentionally returns aggregate counts only. It must run before
-- approval and again immediately before migration. Any nonzero invalid_* or
-- duplicate_* metric is a stop condition.

WITH owner_dates AS (
  SELECT settings.owner_id,
    (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date AS planning_date
  FROM public.tasks_user_settings AS settings
), occurrence_tasks AS (
  SELECT occurrence.*,
    task.start_date,
    task.lifecycle,
    task.disposition,
    owner_dates.planning_date
  FROM public.tasks_recurrence_occurrences AS occurrence
  LEFT JOIN public.tasks_todos AS task
    ON task.id = occurrence.root_id
   AND task.owner_id = occurrence.owner_id
  LEFT JOIN owner_dates
    ON owner_dates.owner_id = occurrence.owner_id
), future_generated_projections AS (
  SELECT occurrence_tasks.*
  FROM occurrence_tasks
  WHERE origin = 'generated'
    AND scheduled_date > planning_date
    AND lifecycle = 'open'
    AND disposition = 'present'
), metrics AS (
  SELECT 'template_rows_to_drop' AS metric, count(*)::bigint AS value
  FROM public.tasks_templates
  UNION ALL
  SELECT 'template_revision_rows_to_drop', count(*)
  FROM public.tasks_template_revisions
  UNION ALL
  SELECT 'template_instantiation_rows_to_drop', count(*)
  FROM public.tasks_template_instantiations
  UNION ALL
  SELECT 'template_rows_not_used_by_recurrence', count(*)
  FROM public.tasks_templates AS template
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.tasks_recurrence_revisions AS revision
    WHERE revision.template_id = template.id
      AND revision.owner_id = template.owner_id
  )
  UNION ALL
  SELECT 'recurrence_definition_rows', count(*)
  FROM public.tasks_recurrence_definitions
  UNION ALL
  SELECT 'active_recurrence_definition_rows', count(*)
  FROM public.tasks_recurrence_definitions
  WHERE status = 'active'
  UNION ALL
  SELECT 'calendar_recurrence_definition_rows', count(*)
  FROM public.tasks_recurrence_definitions AS definition
  JOIN public.tasks_recurrence_revisions AS revision
    ON revision.recurrence_id = definition.id
   AND revision.owner_id = definition.owner_id
   AND revision.revision = definition.current_revision
  WHERE revision.rule_mode = 'calendar'
  UNION ALL
  SELECT 'after_completion_recurrence_definition_rows', count(*)
  FROM public.tasks_recurrence_definitions AS definition
  JOIN public.tasks_recurrence_revisions AS revision
    ON revision.recurrence_id = definition.id
   AND revision.owner_id = definition.owner_id
   AND revision.revision = definition.current_revision
  WHERE revision.rule_mode = 'after_completion'
  UNION ALL
  SELECT 'recurrence_revision_rows_to_convert', count(*)
  FROM public.tasks_recurrence_revisions
  UNION ALL
  SELECT 'recurrence_occurrence_rows_before_conversion', count(*)
  FROM public.tasks_recurrence_occurrences
  UNION ALL
  SELECT 'future_generated_projection_tasks_to_remove', count(*)
  FROM future_generated_projections
  UNION ALL
  SELECT 'future_generated_projection_checklist_items_to_remove', count(*)
  FROM public.tasks_checklist_items AS item
  JOIN future_generated_projections AS projection
    ON projection.root_id = item.task_id
   AND projection.owner_id = item.owner_id
  UNION ALL
  SELECT 'template_provenance_task_rows_to_preserve', count(*)
  FROM public.tasks_todos
  WHERE template_instantiation_id IS NOT NULL
  UNION ALL
  SELECT 'template_provenance_future_task_rows_to_preserve', count(*)
  FROM public.tasks_todos AS task
  JOIN owner_dates ON owner_dates.owner_id = task.owner_id
  WHERE task.template_instantiation_id IS NOT NULL
    AND task.start_date > owner_dates.planning_date
    AND NOT EXISTS (
      SELECT 1
      FROM future_generated_projections AS projection
      WHERE projection.owner_id = task.owner_id
        AND projection.root_id = task.id
    )
  UNION ALL
  SELECT 'template_provenance_checklist_rows_to_preserve', count(*)
  FROM public.tasks_checklist_items AS item
  WHERE item.template_instantiation_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM future_generated_projections AS projection
      WHERE projection.owner_id = item.owner_id
        AND projection.root_id = item.task_id
    )
  UNION ALL
  SELECT 'reached_generated_instances_to_preserve', count(*)
  FROM occurrence_tasks
  WHERE origin = 'generated'
    AND scheduled_date <= planning_date
  UNION ALL
  SELECT 'deferred_reached_generated_instances_to_preserve', count(*)
  FROM occurrence_tasks
  WHERE origin = 'generated'
    AND scheduled_date <= planning_date
    AND start_date > planning_date
    AND lifecycle = 'open'
    AND disposition = 'present'
  UNION ALL
  SELECT 'future_adopted_instances_to_preserve', count(*)
  FROM occurrence_tasks
  WHERE origin = 'adopted'
    AND scheduled_date > planning_date
  UNION ALL
  SELECT 'invalid_snapshot_links', count(*)
  FROM public.tasks_recurrence_revisions AS recurrence_revision
  LEFT JOIN public.tasks_template_revisions AS template_revision
    ON template_revision.template_id = recurrence_revision.template_id
   AND template_revision.revision = recurrence_revision.template_revision
   AND template_revision.owner_id = recurrence_revision.owner_id
  WHERE template_revision.id IS NULL
     OR template_revision.source_type <> 'todo'
     OR template_revision.snapshot ->> 'kind' <> 'todo'
  UNION ALL
  SELECT 'invalid_occurrence_owners_or_roots', count(*)
  FROM occurrence_tasks
  WHERE planning_date IS NULL
     OR lifecycle IS NULL
     OR root_type <> 'todo'
  UNION ALL
  SELECT 'duplicate_future_projection_recurrences', count(*)
  FROM (
    SELECT recurrence_id
    FROM future_generated_projections
    GROUP BY recurrence_id
    HAVING count(*) > 1
  ) AS duplicate
  UNION ALL
  SELECT 'task_rows_before_conversion', count(*)
  FROM public.tasks_todos
  UNION ALL
  SELECT 'checklist_rows_before_conversion', count(*)
  FROM public.tasks_checklist_items
  UNION ALL
  SELECT 'powersync_published_tasks_tables_before_conversion', count(*)
  FROM pg_catalog.pg_publication_tables
  WHERE pubname = 'powersync'
    AND schemaname = 'public'
    AND left(tablename, 6) = 'tasks_'
)
SELECT metric, value
FROM metrics
ORDER BY metric;
