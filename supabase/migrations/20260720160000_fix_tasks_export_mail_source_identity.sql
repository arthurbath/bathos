-- Current export validators must recognize the task-keyed Mail source collection.

ALTER FUNCTION tasks_private.validate_export_v8(jsonb)
RENAME TO validate_export_v8_before_mail_source_identity_fix;

ALTER FUNCTION tasks_private.validate_export_v9(jsonb)
RENAME TO validate_export_v9_before_mail_source_identity_fix;

ALTER FUNCTION tasks_private.validate_export_v10(jsonb)
RENAME TO validate_export_v10_before_mail_source_identity_fix;

CREATE OR REPLACE FUNCTION tasks_private.add_export_mail_source_identity(
  _envelope jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _original_sources jsonb;
  _sources jsonb;
BEGIN
  IF jsonb_typeof(_envelope #> '{data,tasks_mail_sources}')
    IS DISTINCT FROM 'array' THEN
    RETURN _envelope;
  END IF;

  _original_sources := _envelope #> '{data,tasks_mail_sources}';
  IF _envelope #>> '{manifest,checksums,tasks_mail_sources}'
    IS DISTINCT FROM tasks_private.export_checksum(_original_sources) THEN
    RAISE EXCEPTION 'Task export checksum mismatch for tasks_mail_sources';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      source.value || jsonb_build_object('id', source.value -> 'task_id')
      ORDER BY source.ordinality
    ),
    '[]'::jsonb
  )
  INTO _sources
  FROM jsonb_array_elements(
    _original_sources
  ) WITH ORDINALITY AS source(value, ordinality);

  RETURN jsonb_set(
    jsonb_set(
      _envelope,
      '{data,tasks_mail_sources}',
      _sources,
      false
    ),
    '{manifest,checksums,tasks_mail_sources}',
    to_jsonb(tasks_private.export_checksum(_sources)),
    false
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.add_export_mail_source_identity(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v8(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  PERFORM tasks_private.validate_export_v8_before_mail_source_identity_fix(
    tasks_private.add_export_mail_source_identity(_envelope)
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v8(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v9(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  PERFORM tasks_private.validate_export_v9_before_mail_source_identity_fix(
    tasks_private.add_export_mail_source_identity(_envelope)
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v9(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v10(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  PERFORM tasks_private.validate_export_v10_before_mail_source_identity_fix(
    tasks_private.add_export_mail_source_identity(_envelope)
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v10(jsonb)
FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.tasks_restore_export_v10(jsonb, boolean)
RENAME TO tasks_restore_export_v10_before_exact_replay_fix;

ALTER FUNCTION public.tasks_restore_export_v10_before_exact_replay_fix(jsonb, boolean)
SET SCHEMA tasks_private;

REVOKE ALL ON FUNCTION tasks_private.tasks_restore_export_v10_before_exact_replay_fix(
  jsonb,
  boolean
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.classify_exact_export_v10_replay(
  _owner_id uuid,
  _envelope jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
  _collection text;
  _table regclass;
  _identity_column text;
  _record jsonb;
  _existing jsonb;
  _identity uuid;
  _insert_ids jsonb;
  _match_ids jsonb;
  _conflict_ids jsonb;
  _report jsonb := '{}'::jsonb;
BEGIN
  FOREACH _collection IN ARRAY _collections LOOP
    _table := ('public.' || _collection)::regclass;
    _identity_column := CASE
      WHEN _collection = 'tasks_mail_sources' THEN 'task_id'
      ELSE 'id'
    END;
    _insert_ids := '[]'::jsonb;
    _match_ids := '[]'::jsonb;
    _conflict_ids := '[]'::jsonb;

    FOR _record IN
      SELECT value
      FROM jsonb_array_elements(_envelope #> ARRAY['data', _collection])
    LOOP
      _identity := (_record ->> _identity_column)::uuid;
      _existing := NULL;
      IF _collection = 'tasks_user_settings' THEN
        EXECUTE format(
          'SELECT to_jsonb(row_data) - ''owner_id'' FROM %s AS row_data WHERE owner_id = $1',
          _table
        ) INTO _existing USING _owner_id;
        IF _existing IS NOT NULL THEN
          _existing := jsonb_set(_existing, '{id}', _record -> 'id');
        END IF;
      ELSE
        EXECUTE format(
          'SELECT to_jsonb(row_data) - ''owner_id'' FROM %s AS row_data WHERE owner_id = $1 AND %I = $2',
          _table,
          _identity_column
        ) INTO _existing USING _owner_id, _identity;
      END IF;

      IF _existing IS NULL THEN
        _insert_ids := _insert_ids || jsonb_build_array(_identity);
      ELSIF _existing = _record THEN
        _match_ids := _match_ids || jsonb_build_array(_identity);
      ELSE
        _conflict_ids := _conflict_ids || jsonb_build_array(_identity);
      END IF;
    END LOOP;

    _report := _report || jsonb_build_object(
      _collection,
      jsonb_build_object(
        'inserts', jsonb_array_length(_insert_ids),
        'matches', jsonb_array_length(_match_ids),
        'conflicts', jsonb_array_length(_conflict_ids),
        'insert_ids', _insert_ids,
        'match_ids', _match_ids,
        'conflict_ids', _conflict_ids
      )
    );
  END LOOP;
  RETURN _report;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.classify_exact_export_v10_replay(uuid, jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v10(
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
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
  _collection text;
  _exact_report jsonb;
  _exact boolean := true;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v10(_envelope);
  _exact_report := tasks_private.classify_exact_export_v10_replay(
    _owner_id,
    _envelope
  );
  FOREACH _collection IN ARRAY _collections LOOP
    IF (_exact_report #>> ARRAY[_collection, 'inserts'])::integer <> 0
      OR (_exact_report #>> ARRAY[_collection, 'conflicts'])::integer <> 0 THEN
      _exact := false;
      EXIT;
    END IF;
  END LOOP;

  IF _exact THEN
    RETURN _exact_report || jsonb_build_object(
      'schema_version', 10,
      'dry_run', _dry_run,
      'applied', false,
      'code', 'already_applied'
    );
  END IF;

  RETURN tasks_private.tasks_restore_export_v10_before_exact_replay_fix(
    _envelope,
    _dry_run
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v10(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v10(jsonb, boolean)
TO authenticated;
