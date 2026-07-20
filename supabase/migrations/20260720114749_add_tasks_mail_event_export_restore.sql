-- Portable task export schema v6 with append-only Mail retirement events.

CREATE OR REPLACE FUNCTION tasks_private.export_v6_as_v5(_envelope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources'
  ];
  _data jsonb := (_envelope -> 'data') - 'tasks_mail_source_events';
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
  _collection text;
BEGIN
  FOREACH _collection IN ARRAY _collections LOOP
    _counts := _counts || jsonb_build_object(
      _collection,
      jsonb_array_length(_data -> _collection)
    );
    _checksums := _checksums || jsonb_build_object(
      _collection,
      tasks_private.export_checksum(_data -> _collection)
    );
  END LOOP;
  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 5,
    'created_at', _envelope -> 'created_at',
    'manifest', jsonb_build_object(
      'collections', to_jsonb(_collections),
      'counts', _counts,
      'checksums', _checksums
    ),
    'data', _data
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.export_v6_as_v5(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v6(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events'
  ];
  _events jsonb;
  _sources jsonb;
BEGIN
  IF jsonb_typeof(_envelope) IS DISTINCT FROM 'object'
    OR _envelope ->> 'format' IS DISTINCT FROM 'garden.bath.tasks.export'
    OR COALESCE(_envelope ->> 'schema_version', '') !~ '^[0-9]+$'
    OR (_envelope ->> 'schema_version')::integer <> 6
    OR jsonb_typeof(_envelope -> 'manifest') IS DISTINCT FROM 'object'
    OR jsonb_typeof(_envelope -> 'data') IS DISTINCT FROM 'object'
    OR _envelope #> '{manifest,collections}' IS DISTINCT FROM to_jsonb(_collections)
    OR _envelope #>> '{manifest,checksums,algorithm}' IS DISTINCT FROM 'sha256' THEN
    RAISE EXCEPTION 'Invalid task export v6 envelope' USING ERRCODE = '22023';
  END IF;

  _events := _envelope #> '{data,tasks_mail_source_events}';
  _sources := _envelope #> '{data,tasks_mail_sources}';
  IF jsonb_typeof(_events) IS DISTINCT FROM 'array'
    OR COALESCE(
      _envelope #>> '{manifest,counts,tasks_mail_source_events}',
      ''
    ) !~ '^[0-9]+$'
    OR (_envelope #>> '{manifest,counts,tasks_mail_source_events}')::integer
      <> jsonb_array_length(_events)
    OR _envelope #>> '{manifest,checksums,tasks_mail_source_events}'
      IS DISTINCT FROM tasks_private.export_checksum(_events)
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(_events) AS event(value)
      WHERE jsonb_typeof(event.value) IS DISTINCT FROM 'object'
        OR NOT event.value ?& ARRAY[
          'id', 'task_id', 'client_mutation_id', 'transition',
          'base_lifecycle', 'result_lifecycle', 'base_revision',
          'result_revision', 'occurred_at', 'error_code'
        ]
        OR event.value ? 'owner_id'
        OR COALESCE(event.value ->> 'id', '')
          !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR COALESCE(event.value ->> 'task_id', '')
          !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR COALESCE(event.value ->> 'client_mutation_id', '')
          !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR COALESCE(event.value ->> 'base_revision', '') !~ '^[0-9]+$'
        OR COALESCE(event.value ->> 'result_revision', '') !~ '^[0-9]+$'
        OR NULLIF(event.value ->> 'occurred_at', '') IS NULL
        OR event.value ->> 'transition'
          NOT IN ('retirement_started', 'retirement_failed', 'retired')
        OR event.value ->> 'base_lifecycle'
          NOT IN ('retained', 'retirement_pending', 'retirement_failed')
        OR event.value ->> 'result_lifecycle'
          NOT IN ('retirement_pending', 'retirement_failed', 'retired')
        OR (event.value ->> 'base_revision')::bigint <= 0
        OR (event.value ->> 'result_revision')::bigint
          <> (event.value ->> 'base_revision')::bigint + 1
        OR NOT (
          (
            event.value ->> 'transition' = 'retirement_started'
            AND event.value ->> 'base_lifecycle' IN ('retained', 'retirement_failed')
            AND event.value ->> 'result_lifecycle' = 'retirement_pending'
            AND event.value -> 'error_code'
              IS NOT DISTINCT FROM 'null'::jsonb
          ) OR (
            event.value ->> 'transition' = 'retirement_failed'
            AND event.value ->> 'base_lifecycle' = 'retirement_pending'
            AND event.value ->> 'result_lifecycle' = 'retirement_failed'
            AND NULLIF(btrim(event.value ->> 'error_code'), '') IS NOT NULL
            AND char_length(event.value ->> 'error_code') <= 200
          ) OR (
            event.value ->> 'transition' = 'retired'
            AND event.value ->> 'base_lifecycle' = 'retirement_pending'
            AND event.value ->> 'result_lifecycle' = 'retired'
            AND event.value -> 'error_code'
              IS NOT DISTINCT FROM 'null'::jsonb
          )
        )
    ) THEN
    RAISE EXCEPTION 'Task export v6 Mail source events are invalid'
      USING ERRCODE = '22023';
  END IF;

  PERFORM tasks_private.validate_export_v5(
    tasks_private.export_v6_as_v5(_envelope)
  );

  IF EXISTS (
    SELECT event.value ->> 'id'
    FROM jsonb_array_elements(_events) AS event(value)
    GROUP BY event.value ->> 'id'
    HAVING count(*) > 1
  ) OR EXISTS (
    SELECT event.value ->> 'client_mutation_id'
    FROM jsonb_array_elements(_events) AS event(value)
    GROUP BY event.value ->> 'client_mutation_id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Task export v6 contains duplicate Mail source event identity'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    WITH event_rows AS (
      SELECT
        event.value,
        event.value ->> 'task_id' AS task_id,
        (event.value ->> 'base_revision')::bigint AS base_revision,
        (event.value ->> 'result_revision')::bigint AS result_revision,
        event.value ->> 'base_lifecycle' AS base_lifecycle,
        event.value ->> 'result_lifecycle' AS result_lifecycle,
        lag((event.value ->> 'result_revision')::bigint) OVER (
          PARTITION BY event.value ->> 'task_id'
          ORDER BY (event.value ->> 'base_revision')::bigint
        ) AS previous_revision,
        lag(event.value ->> 'result_lifecycle') OVER (
          PARTITION BY event.value ->> 'task_id'
          ORDER BY (event.value ->> 'base_revision')::bigint
        ) AS previous_lifecycle,
        row_number() OVER (
          PARTITION BY event.value ->> 'task_id'
          ORDER BY (event.value ->> 'base_revision')::bigint
        ) AS sequence_number
      FROM jsonb_array_elements(_events) AS event(value)
    )
    SELECT 1
    FROM event_rows AS event
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(_sources) AS source(value)
      WHERE source.value ->> 'task_id' = event.task_id
    )
      OR (
        event.sequence_number = 1
        AND (event.base_revision <> 1 OR event.base_lifecycle <> 'retained')
      )
      OR (
        event.sequence_number > 1
        AND (
          event.base_revision <> event.previous_revision
          OR event.base_lifecycle <> event.previous_lifecycle
        )
      )
  ) THEN
    RAISE EXCEPTION 'Task export v6 contains an invalid Mail source event chain'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_sources) AS source(value)
    LEFT JOIN LATERAL (
      SELECT event.value
      FROM jsonb_array_elements(_events) AS event(value)
      WHERE event.value ->> 'task_id' = source.value ->> 'task_id'
      ORDER BY (event.value ->> 'result_revision')::bigint DESC
      LIMIT 1
    ) AS latest ON true
    WHERE NOT source.value ?& ARRAY[
        'task_id', 'lifecycle', 'revision', 'client_mutation_id',
        'updated_at', 'last_error_code'
      ]
      OR COALESCE(source.value ->> 'revision', '') !~ '^[0-9]+$'
      OR (source.value ->> 'revision')::bigint <= 0
      OR source.value ->> 'lifecycle'
        NOT IN ('retained', 'retirement_pending', 'retirement_failed', 'retired')
      OR (
        (source.value ->> 'revision')::bigint = 1
        AND (
          source.value ->> 'lifecycle' <> 'retained'
          OR latest.value IS NOT NULL
        )
      )
      OR (
        (source.value ->> 'revision')::bigint > 1
        AND (
          latest.value IS NULL
          OR latest.value ->> 'result_revision' <> source.value ->> 'revision'
          OR latest.value ->> 'result_lifecycle' <> source.value ->> 'lifecycle'
          OR latest.value ->> 'client_mutation_id'
            <> source.value ->> 'client_mutation_id'
          OR latest.value ->> 'occurred_at' <> source.value ->> 'updated_at'
          OR latest.value ->> 'error_code'
            IS DISTINCT FROM source.value ->> 'last_error_code'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Task export v6 Mail source state does not match its audit history'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v6(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.classify_restore_v6_mail_events(
  _owner_id uuid,
  _records jsonb,
  _source_report jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _record jsonb;
  _existing jsonb;
  _event_id uuid;
  _task_id uuid;
  _parent_available boolean;
  _insert_ids jsonb := '[]'::jsonb;
  _match_ids jsonb := '[]'::jsonb;
  _conflict_ids jsonb := '[]'::jsonb;
BEGIN
  FOR _record IN SELECT value FROM jsonb_array_elements(_records) LOOP
    _event_id := (_record ->> 'id')::uuid;
    _task_id := (_record ->> 'task_id')::uuid;
    _parent_available := (
      _source_report -> 'insert_ids' @> jsonb_build_array(_record -> 'task_id')
      OR _source_report -> 'match_ids' @> jsonb_build_array(_record -> 'task_id')
    );
    SELECT to_jsonb(event) INTO _existing
    FROM public.tasks_mail_source_events AS event
    WHERE event.id = _event_id
      OR (
        event.owner_id = _owner_id
        AND event.client_mutation_id = (_record ->> 'client_mutation_id')::uuid
      )
    ORDER BY (event.id = _event_id) DESC
    LIMIT 1;

    IF NOT _parent_available THEN
      _conflict_ids := _conflict_ids || jsonb_build_array(_event_id);
    ELSIF _existing IS NULL THEN
      _insert_ids := _insert_ids || jsonb_build_array(_event_id);
    ELSIF _existing ->> 'id' = _event_id::text
      AND _existing ->> 'owner_id' = _owner_id::text
      AND _existing - 'owner_id' = _record THEN
      _match_ids := _match_ids || jsonb_build_array(_event_id);
    ELSE
      _conflict_ids := _conflict_ids || jsonb_build_array(_event_id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserts', jsonb_array_length(_insert_ids),
    'matches', jsonb_array_length(_match_ids),
    'conflicts', jsonb_array_length(_conflict_ids),
    'insert_ids', _insert_ids,
    'match_ids', _match_ids,
    'conflict_ids', _conflict_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.classify_restore_v6_mail_events(
  uuid, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v6()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _base jsonb;
  _events jsonb;
  _data jsonb;
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events'
  ];
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
  _collection text;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to export task data'
      USING ERRCODE = '42501';
  END IF;
  _base := public.tasks_create_export_v5();
  SELECT COALESCE(
    jsonb_agg(
      to_jsonb(event) - 'owner_id'
      ORDER BY event.task_id, event.base_revision, event.id
    ),
    '[]'::jsonb
  ) INTO _events
  FROM public.tasks_mail_source_events AS event
  WHERE event.owner_id = _owner_id;
  _data := (_base -> 'data')
    || jsonb_build_object('tasks_mail_source_events', _events);

  FOREACH _collection IN ARRAY _collections LOOP
    _counts := _counts || jsonb_build_object(
      _collection,
      jsonb_array_length(_data -> _collection)
    );
    _checksums := _checksums || jsonb_build_object(
      _collection,
      tasks_private.export_checksum(_data -> _collection)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 6,
    'created_at', clock_timestamp(),
    'manifest', jsonb_build_object(
      'collections', to_jsonb(_collections),
      'counts', _counts,
      'checksums', _checksums
    ),
    'data', _data
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_create_export_v6() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v6() TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v6(
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
  _base_report jsonb;
  _source_report jsonb;
  _event_report jsonb;
  _record jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v6(_envelope);

  _base_report := public.tasks_restore_export_v5(
    tasks_private.export_v6_as_v5(_envelope),
    true
  );
  _source_report := _base_report -> 'tasks_mail_sources';
  _event_report := tasks_private.classify_restore_v6_mail_events(
    _owner_id,
    _envelope #> '{data,tasks_mail_source_events}',
    _source_report
  );

  IF NOT _dry_run THEN
    IF (_event_report ->> 'conflicts')::integer > 0 THEN
      RAISE EXCEPTION 'Task export v6 has conflicting Mail source audit history'
        USING ERRCODE = '23505';
    END IF;

    _base_report := public.tasks_restore_export_v5(
      tasks_private.export_v6_as_v5(_envelope),
      false
    );
    FOR _record IN
      SELECT value
      FROM jsonb_array_elements(_envelope #> '{data,tasks_mail_source_events}')
      ORDER BY (value ->> 'base_revision')::bigint, value ->> 'id'
    LOOP
      IF _event_report -> 'insert_ids' @> jsonb_build_array(_record -> 'id') THEN
        INSERT INTO public.tasks_mail_source_events
        SELECT (
          jsonb_populate_record(
            NULL::public.tasks_mail_source_events,
            _record || jsonb_build_object('owner_id', _owner_id)
          )
        ).*;
      END IF;
    END LOOP;
  END IF;

  RETURN _base_report || jsonb_build_object(
    'dry_run', _dry_run,
    'schema_version', 6,
    'tasks_mail_source_events', _event_report
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v6(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v6(jsonb, boolean)
TO authenticated;
