-- Canonical owner planning time zone for date-derived task views

CREATE TABLE public.tasks_user_settings (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  planning_timezone text NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  client_mutation_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_user_settings_id_owner_key UNIQUE (id, owner_id),
  CONSTRAINT tasks_user_settings_revision_valid CHECK (revision > 0),
  CONSTRAINT tasks_user_settings_timezone_not_blank CHECK (
    planning_timezone = btrim(planning_timezone)
    AND planning_timezone <> ''
    AND char_length(planning_timezone) <= 255
  )
);

ALTER TABLE public.tasks_user_settings REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_user_settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX tasks_user_settings_owner_idx
ON public.tasks_user_settings (owner_id);

CREATE OR REPLACE FUNCTION tasks_private.prepare_user_settings_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_timezone_names
    WHERE name = NEW.planning_timezone
  ) THEN
    RAISE EXCEPTION 'Task planning time zone is not recognized'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Task planning setting identity is immutable'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.revision <> OLD.revision + 1 THEN
      RAISE EXCEPTION 'Task planning setting revision must advance by exactly one'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.client_mutation_id = OLD.client_mutation_id THEN
      RAISE EXCEPTION 'Task planning setting mutation identifier must change'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.revision <> 1 THEN
    RAISE EXCEPTION 'A new task planning setting must begin at revision one'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.prepare_user_settings_write()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_user_settings_prepare_write
BEFORE INSERT OR UPDATE ON public.tasks_user_settings
FOR EACH ROW
EXECUTE FUNCTION tasks_private.prepare_user_settings_write();

CREATE POLICY "Task owners can read their planning settings"
ON public.tasks_user_settings
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Task owners can create their planning settings"
ON public.tasks_user_settings
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Task owners can update their planning settings"
ON public.tasks_user_settings
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = owner_id)
WITH CHECK ((SELECT auth.uid()) = owner_id);

REVOKE ALL ON TABLE public.tasks_user_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tasks_user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks_user_settings TO service_role;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v2()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _tasks jsonb;
  _history jsonb;
  _settings jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to export task data'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(task) - 'owner_id' ORDER BY task.id), '[]'::jsonb)
  INTO _tasks
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(event) - 'owner_id' ORDER BY event.occurred_at, event.id),
    '[]'::jsonb
  )
  INTO _history
  FROM public.tasks_history_events AS event
  WHERE event.owner_id = _owner_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(setting) - 'owner_id' ORDER BY setting.id), '[]'::jsonb)
  INTO _settings
  FROM public.tasks_user_settings AS setting
  WHERE setting.owner_id = _owner_id;

  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 2,
    'created_at', clock_timestamp(),
    'manifest', jsonb_build_object(
      'collections', jsonb_build_array(
        'tasks_todos',
        'tasks_history_events',
        'tasks_user_settings'
      ),
      'counts', jsonb_build_object(
        'tasks_todos', jsonb_array_length(_tasks),
        'tasks_history_events', jsonb_array_length(_history),
        'tasks_user_settings', jsonb_array_length(_settings)
      ),
      'checksums', jsonb_build_object(
        'algorithm', 'sha256',
        'tasks_todos', tasks_private.export_checksum(_tasks),
        'tasks_history_events', tasks_private.export_checksum(_history),
        'tasks_user_settings', tasks_private.export_checksum(_settings)
      )
    ),
    'data', jsonb_build_object(
      'tasks_todos', _tasks,
      'tasks_history_events', _history,
      'tasks_user_settings', _settings
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_create_export_v2()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v2() TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v2(_envelope jsonb)
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
    RAISE EXCEPTION 'Invalid task export format'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(_envelope ->> 'schema_version', '') !~ '^[0-9]+$'
    OR (_envelope ->> 'schema_version')::integer <> 2 THEN
    RAISE EXCEPTION 'Unsupported task export schema version'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(_envelope -> 'manifest') IS DISTINCT FROM 'object'
    OR jsonb_typeof(_envelope -> 'data') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid task export envelope'
      USING ERRCODE = '22023';
  END IF;

  _tasks := _envelope #> '{data,tasks_todos}';
  _history := _envelope #> '{data,tasks_history_events}';
  _settings := _envelope #> '{data,tasks_user_settings}';
  IF jsonb_typeof(_tasks) IS DISTINCT FROM 'array'
    OR jsonb_typeof(_history) IS DISTINCT FROM 'array'
    OR jsonb_typeof(_settings) IS DISTINCT FROM 'array'
    OR jsonb_array_length(_settings) > 1 THEN
    RAISE EXCEPTION 'Invalid task export collections'
      USING ERRCODE = '22023';
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
    RAISE EXCEPTION 'Task export checksum validation failed'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v2(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v2(
  _envelope jsonb,
  _dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _v1_envelope jsonb;
  _base_result jsonb;
  _setting_json jsonb;
  _setting public.tasks_user_settings;
  _existing public.tasks_user_settings;
  _inserts jsonb := '[]'::jsonb;
  _matches jsonb := '[]'::jsonb;
  _conflicts jsonb := '[]'::jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data'
      USING ERRCODE = '42501';
  END IF;

  PERFORM tasks_private.validate_export_v2(_envelope);

  FOR _setting_json IN
    SELECT value FROM jsonb_array_elements(_envelope #> '{data,tasks_user_settings}')
  LOOP
    IF jsonb_typeof(_setting_json) IS DISTINCT FROM 'object'
      OR NOT (_setting_json ?& ARRAY[
        'id', 'planning_timezone', 'revision', 'client_mutation_id', 'created_at', 'updated_at'
      ]) THEN
      RAISE EXCEPTION 'Task export contains an incomplete planning setting'
        USING ERRCODE = '22023';
    END IF;

    _setting := jsonb_populate_record(
      NULL::public.tasks_user_settings,
      (_setting_json - 'owner_id') || jsonb_build_object('owner_id', _owner_id)
    );

    _existing := NULL;
    SELECT setting.*
    INTO _existing
    FROM public.tasks_user_settings AS setting
    WHERE setting.id = _setting.id
      OR setting.owner_id = _owner_id
      OR setting.client_mutation_id = _setting.client_mutation_id
    ORDER BY (setting.id = _setting.id) DESC
    LIMIT 1;

    IF NOT FOUND THEN
      _inserts := _inserts || jsonb_build_array(_setting.id);
    ELSIF _existing.id = _setting.id
      AND _existing.owner_id = _owner_id
      AND to_jsonb(_existing) - 'owner_id' = _setting_json - 'owner_id' THEN
      _matches := _matches || jsonb_build_array(_setting.id);
    ELSE
      _conflicts := _conflicts || jsonb_build_array(_setting.id);
    END IF;
  END LOOP;

  _v1_envelope := jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 1,
    'created_at', _envelope -> 'created_at',
    'manifest', jsonb_build_object(
      'collections', jsonb_build_array('tasks_todos', 'tasks_history_events'),
      'counts', jsonb_build_object(
        'tasks_todos', _envelope #> '{manifest,counts,tasks_todos}',
        'tasks_history_events', _envelope #> '{manifest,counts,tasks_history_events}'
      ),
      'checksums', jsonb_build_object(
        'algorithm', 'sha256',
        'tasks_todos', _envelope #> '{manifest,checksums,tasks_todos}',
        'tasks_history_events', _envelope #> '{manifest,checksums,tasks_history_events}'
      )
    ),
    'data', jsonb_build_object(
      'tasks_todos', _envelope #> '{data,tasks_todos}',
      'tasks_history_events', _envelope #> '{data,tasks_history_events}'
    )
  );

  _base_result := public.tasks_restore_export_v1(_v1_envelope, _dry_run);

  IF NOT _dry_run AND jsonb_array_length(_inserts) = 1 THEN
    INSERT INTO public.tasks_user_settings SELECT (_setting).*;
  END IF;

  RETURN _base_result || jsonb_build_object(
    'schema_version', 2,
    'tasks_user_settings', jsonb_build_object(
      'inserts', jsonb_array_length(_inserts),
      'matches', jsonb_array_length(_matches),
      'conflicts', jsonb_array_length(_conflicts),
      'insert_ids', _inserts,
      'match_ids', _matches,
      'conflict_ids', _conflicts
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v2(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v2(jsonb, boolean) TO authenticated;
