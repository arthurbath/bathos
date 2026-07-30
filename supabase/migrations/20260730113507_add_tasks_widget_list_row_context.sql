-- Add bounded presentation-only context to the existing widget projection
-- without changing its schema version or exposing recurrence-rule details.

ALTER FUNCTION tasks_private.build_widget_list_projection(
  uuid,
  text,
  date,
  boolean,
  text
) RENAME TO build_widget_list_projection_without_row_context;

CREATE OR REPLACE FUNCTION tasks_private.build_widget_list_projection(
  _owner_id uuid,
  _list_id text,
  _planning_date date,
  _automatic_list_sorting boolean,
  _quick_filter text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  _projection jsonb;
  _tasks jsonb;
BEGIN
  _projection := tasks_private.build_widget_list_projection_without_row_context(
    _owner_id,
    _list_id,
    _planning_date,
    _automatic_list_sorting,
    _quick_filter
  );

  IF _list_id <> 'upcoming' THEN
    RETURN _projection;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      projected.task || jsonb_build_object(
        'upcomingDate',
        CASE
          WHEN todo.start_date IS NOT NULL
            AND todo.start_date > _planning_date
            THEN todo.start_date
          WHEN todo.deadline IS NOT NULL
            AND todo.deadline > _planning_date
            THEN todo.deadline
          ELSE NULL
        END,
        'isRecurrenceProjection',
        todo.recurrence_definition_id IS NOT NULL
      )
      ORDER BY projected.ordinal
    ),
    '[]'::jsonb
  )
  INTO _tasks
  FROM jsonb_array_elements(_projection -> 'tasks')
    WITH ORDINALITY AS projected(task, ordinal)
  JOIN public.tasks_todos AS todo
    ON todo.owner_id = _owner_id
    AND todo.id = (projected.task ->> 'id')::uuid;

  RETURN jsonb_set(_projection, '{tasks}', _tasks, false);
END
$$;

REVOKE ALL ON FUNCTION tasks_private.build_widget_list_projection(
  uuid,
  text,
  date,
  boolean,
  text
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION tasks_private.build_widget_list_projection_without_row_context(
  uuid,
  text,
  date,
  boolean,
  text
) FROM PUBLIC, anon, authenticated;
