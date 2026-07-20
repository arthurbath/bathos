-- Active Anytime planning and explicitly inactive Someday placement

UPDATE public.tasks_todos
SET
  start_date = NULL,
  today_section = 'daytime',
  revision = revision + 1,
  client_mutation_id = gen_random_uuid(),
  updated_at = now()
WHERE destination = 'inbox'
  AND (start_date IS NOT NULL OR today_section <> 'daytime');

ALTER TABLE public.tasks_todos
  DROP CONSTRAINT tasks_todos_destination_valid,
  ADD CONSTRAINT tasks_todos_destination_valid CHECK (
    destination IN ('inbox', 'today', 'anytime', 'someday')
  ),
  ADD CONSTRAINT tasks_todos_unscheduled_placement_valid CHECK (
    (destination NOT IN ('inbox', 'someday') OR start_date IS NULL)
    AND (destination = 'today' OR today_section = 'daytime')
  );

CREATE OR REPLACE FUNCTION tasks_private.todo_export_planning_is_valid_v3(_task jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    jsonb_typeof(_task) = 'object'
    AND COALESCE(_task ->> 'destination', '') IN ('inbox', 'today', 'anytime', 'someday')
    AND COALESCE(_task ->> 'today_section', '') IN ('daytime', 'evening')
    AND (
      _task ->> 'today_section' <> 'evening'
      OR _task ->> 'destination' = 'today'
    )
    AND (
      COALESCE(_task ->> 'destination', '') NOT IN ('inbox', 'someday')
      OR jsonb_typeof(_task -> 'start_date') = 'null'
    );
$$;

REVOKE ALL ON FUNCTION tasks_private.todo_export_planning_is_valid_v3(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v3(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _tasks jsonb;
  _history jsonb;
  _settings jsonb;
BEGIN
  IF jsonb_typeof(_envelope) IS DISTINCT FROM 'object'
    OR _envelope ->> 'format' IS DISTINCT FROM 'garden.bath.tasks.export' THEN
    RAISE EXCEPTION 'Invalid task export format' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(_envelope ->> 'schema_version', '') !~ '^[0-9]+$'
    OR (_envelope ->> 'schema_version')::integer <> 3 THEN
    RAISE EXCEPTION 'Unsupported task export schema version' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(_envelope -> 'manifest') IS DISTINCT FROM 'object'
    OR jsonb_typeof(_envelope -> 'data') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid task export envelope' USING ERRCODE = '22023';
  END IF;

  _tasks := _envelope #> '{data,tasks_todos}';
  _history := _envelope #> '{data,tasks_history_events}';
  _settings := _envelope #> '{data,tasks_user_settings}';
  IF jsonb_typeof(_tasks) IS DISTINCT FROM 'array'
    OR jsonb_typeof(_history) IS DISTINCT FROM 'array'
    OR jsonb_typeof(_settings) IS DISTINCT FROM 'array'
    OR jsonb_array_length(_settings) > 1 THEN
    RAISE EXCEPTION 'Invalid task export collections' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(_envelope #>> '{manifest,counts,tasks_todos}', '') !~ '^[0-9]+$'
    OR COALESCE(_envelope #>> '{manifest,counts,tasks_history_events}', '') !~ '^[0-9]+$'
    OR COALESCE(_envelope #>> '{manifest,counts,tasks_user_settings}', '') !~ '^[0-9]+$'
    OR (_envelope #>> '{manifest,counts,tasks_todos}')::integer <> jsonb_array_length(_tasks)
    OR (_envelope #>> '{manifest,counts,tasks_history_events}')::integer
      <> jsonb_array_length(_history)
    OR (_envelope #>> '{manifest,counts,tasks_user_settings}')::integer
      <> jsonb_array_length(_settings) THEN
    RAISE EXCEPTION 'Task export record counts do not match the manifest'
      USING ERRCODE = '22023';
  END IF;

  IF _envelope #>> '{manifest,checksums,algorithm}' IS DISTINCT FROM 'sha256'
    OR _envelope #>> '{manifest,checksums,tasks_todos}'
      IS DISTINCT FROM tasks_private.export_checksum(_tasks)
    OR _envelope #>> '{manifest,checksums,tasks_history_events}'
      IS DISTINCT FROM tasks_private.export_checksum(_history)
    OR _envelope #>> '{manifest,checksums,tasks_user_settings}'
      IS DISTINCT FROM tasks_private.export_checksum(_settings) THEN
    RAISE EXCEPTION 'Task export checksum validation failed' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_tasks) AS item(value)
    WHERE NOT COALESCE(tasks_private.todo_export_planning_is_valid_v3(item.value), false)
  ) THEN
    RAISE EXCEPTION 'Task export contains invalid planning placement'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v3(jsonb)
FROM PUBLIC, anon, authenticated;
