-- First-class repeating task prototypes without reusable Template entities.
--
-- A recurrence revision owns an immutable task/checklist snapshot. Occurrence
-- rows describe adopted or spawned ordinary tasks only. The next unspawned
-- calendar event is represented by tasks_recurrence_definitions.next_occurrence_date
-- and is rendered virtually by Upcoming.

ALTER TABLE public.tasks_recurrence_definitions
  ADD COLUMN next_occurrence_date date;

ALTER TABLE public.tasks_recurrence_revisions
  ADD COLUMN prototype_snapshot jsonb;

CREATE OR REPLACE FUNCTION tasks_private.recurrence_snapshot_from_todo(
  _owner_id uuid,
  _task_id uuid,
  _anchor_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _task public.tasks_todos;
  _checklist jsonb;
BEGIN
  SELECT task.* INTO _task
  FROM public.tasks_todos AS task
  WHERE task.id = _task_id
    AND task.owner_id = _owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The recurrence prototype source task is unavailable'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'node_id', item.id,
        'title', item.title,
        'completed', item.completed,
        'order_key', item.order_key
      ) ORDER BY item.order_key, item.id
    ),
    '[]'::jsonb
  ) INTO _checklist
  FROM public.tasks_checklist_items AS item
  WHERE item.owner_id = _owner_id
    AND item.task_id = _task_id
    AND item.disposition = 'present';

  RETURN jsonb_build_object(
    'version', 2,
    'kind', 'todo',
    'root', jsonb_build_object(
      'node_id', _task.id,
      'title', _task.title,
      'notes', _task.notes,
      'primary_link', _task.primary_link,
      'actionability', _task.actionability,
      'destination', _task.destination,
      'today_section', _task.today_section,
      'order_key', _task.order_key,
      'start_offset_days', CASE
        WHEN _task.start_date IS NULL THEN NULL
        ELSE _task.start_date - _anchor_date
      END,
      'deadline_offset_days', CASE
        WHEN _task.deadline IS NULL THEN NULL
        ELSE _task.deadline - _anchor_date
      END,
      'checklist', _checklist
    )
  );
END
$$;

REVOKE ALL ON FUNCTION tasks_private.recurrence_snapshot_from_todo(
  uuid, uuid, date
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.normalize_recurrence_snapshot(
  _snapshot jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  _root jsonb;
  _item jsonb;
  _checklist jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(_snapshot) <> 'object'
    OR _snapshot ->> 'kind' <> 'todo'
    OR jsonb_typeof(_snapshot -> 'root') <> 'object'
    OR NULLIF(btrim(_snapshot #>> '{root,title}'), '') IS NULL
    OR jsonb_typeof(COALESCE(_snapshot #> '{root,checklist}', '[]'::jsonb)) <> 'array'
  THEN
    RAISE EXCEPTION 'The recurrence prototype snapshot is invalid'
      USING ERRCODE = '22023';
  END IF;

  FOR _item IN
    SELECT value
    FROM jsonb_array_elements(
      COALESCE(_snapshot #> '{root,checklist}', '[]'::jsonb)
    )
  LOOP
    IF jsonb_typeof(_item) <> 'object'
      OR NULLIF(btrim(_item ->> 'title'), '') IS NULL THEN
      RAISE EXCEPTION 'The recurrence prototype checklist is invalid'
        USING ERRCODE = '22023';
    END IF;
    _checklist := _checklist || jsonb_build_array(jsonb_build_object(
      'node_id', COALESCE(NULLIF(_item ->> 'node_id', '')::uuid, gen_random_uuid()),
      'title', _item ->> 'title',
      'completed', COALESCE((_item ->> 'completed')::boolean, false),
      'order_key', COALESCE(NULLIF(_item ->> 'order_key', ''), 'a0')
    ));
  END LOOP;

  _root := _snapshot -> 'root';
  RETURN jsonb_build_object(
    'version', 2,
    'kind', 'todo',
    'root', jsonb_build_object(
      'node_id', COALESCE(NULLIF(_root ->> 'node_id', '')::uuid, gen_random_uuid()),
      'title', _root ->> 'title',
      'notes', COALESCE(_root ->> 'notes', ''),
      'primary_link', CASE
        WHEN NULLIF(btrim(_root ->> 'primary_link'), '') IS NULL THEN NULL
        ELSE _root ->> 'primary_link'
      END,
      'actionability', COALESCE(_root ->> 'actionability', 'actionable'),
      'destination', COALESCE(_root ->> 'destination', 'anytime'),
      'today_section', _root -> 'today_section',
      'order_key', COALESCE(NULLIF(_root ->> 'order_key', ''), 'a0'),
      'start_offset_days', _root -> 'start_offset_days',
      'deadline_offset_days', _root -> 'deadline_offset_days',
      'checklist', _checklist
    )
  );
END
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_recurrence_snapshot(jsonb)
FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  _invalid_count bigint;
BEGIN
  SELECT count(*) INTO _invalid_count
  FROM (
    SELECT definition.owner_id
    FROM public.tasks_recurrence_definitions AS definition
    LEFT JOIN public.tasks_user_settings AS settings
      ON settings.owner_id = definition.owner_id
    WHERE settings.owner_id IS NULL
    GROUP BY definition.owner_id
  ) AS owners_without_settings;
  IF _invalid_count <> 0 THEN
    RAISE EXCEPTION
      'Template-free recurrence conversion found % owners without planning settings',
      _invalid_count USING ERRCODE = '23514';
  END IF;

  SELECT count(*) INTO _invalid_count
  FROM public.tasks_recurrence_revisions AS recurrence_revision
  LEFT JOIN public.tasks_template_revisions AS template_revision
    ON template_revision.template_id = recurrence_revision.template_id
   AND template_revision.revision = recurrence_revision.template_revision
   AND template_revision.owner_id = recurrence_revision.owner_id
  WHERE template_revision.id IS NULL
     OR template_revision.source_type <> 'todo'
     OR template_revision.snapshot ->> 'kind' <> 'todo';
  IF _invalid_count <> 0 THEN
    RAISE EXCEPTION
      'Template-free recurrence conversion found % invalid snapshot links',
      _invalid_count USING ERRCODE = '23514';
  END IF;

  SELECT count(*) INTO _invalid_count
  FROM public.tasks_recurrence_occurrences AS occurrence
  JOIN public.tasks_todos AS task
    ON task.id = occurrence.root_id
  WHERE occurrence.owner_id <> task.owner_id
     OR occurrence.root_type <> 'todo';
  IF _invalid_count <> 0 THEN
    RAISE EXCEPTION
      'Template-free recurrence conversion found % invalid occurrence owners',
      _invalid_count USING ERRCODE = '23514';
  END IF;

  WITH owner_dates AS (
    SELECT settings.owner_id,
      (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date AS planning_date
    FROM public.tasks_user_settings AS settings
  ), future_projections AS (
    SELECT occurrence.recurrence_id
    FROM public.tasks_recurrence_occurrences AS occurrence
    JOIN owner_dates ON owner_dates.owner_id = occurrence.owner_id
    JOIN public.tasks_todos AS task
      ON task.id = occurrence.root_id
     AND task.owner_id = occurrence.owner_id
    WHERE occurrence.origin = 'generated'
      AND occurrence.scheduled_date > owner_dates.planning_date
      AND task.lifecycle = 'open'
      AND task.disposition = 'present'
  )
  SELECT count(*) INTO _invalid_count
  FROM (
    SELECT recurrence_id
    FROM future_projections
    GROUP BY recurrence_id
    HAVING count(*) > 1
  ) AS duplicates;
  IF _invalid_count <> 0 THEN
    RAISE EXCEPTION
      'Template-free recurrence conversion found % duplicate future projections',
      _invalid_count USING ERRCODE = '23514';
  END IF;
END
$$;

-- Portability schema 14 contracts the current export to the template-free
-- Tasks model while retaining a narrow, fail-closed JSON upgrade for older
-- exports whose recurrence snapshots can still be resolved.
CREATE OR REPLACE FUNCTION tasks_private.export_v14_collection(
  _collection text,
  _owner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _records jsonb;
BEGIN
  IF _collection NOT IN (
    'tasks_areas', 'tasks_todos', 'tasks_checklist_items',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings',
    'tasks_mail_sources', 'tasks_mail_source_events',
    'tasks_recurrence_definitions', 'tasks_recurrence_revisions',
    'tasks_recurrence_occurrences', 'tasks_recurrence_evaluations',
    'tasks_recurrence_status_events', 'tasks_reminders',
    'tasks_reminder_occurrences'
  ) THEN
    RAISE EXCEPTION 'Unsupported task export collection' USING ERRCODE = '22023';
  END IF;
  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(record_json ORDER BY record_json::text), ''[]''::jsonb)
       FROM (
         SELECT to_jsonb(record) - ''owner_id'' AS record_json
         FROM public.%I AS record
         WHERE record.owner_id = $1
       ) AS exported',
    _collection
  ) INTO _records USING _owner_id;
  RETURN _records;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.export_v14_collection(text, uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v14()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _collection text;
  _records jsonb;
  _data jsonb := '{}'::jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_todos', 'tasks_checklist_items',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings',
    'tasks_mail_sources', 'tasks_mail_source_events',
    'tasks_recurrence_definitions', 'tasks_recurrence_revisions',
    'tasks_recurrence_occurrences', 'tasks_recurrence_evaluations',
    'tasks_recurrence_status_events', 'tasks_reminders',
    'tasks_reminder_occurrences'
  ];
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to export task data'
      USING ERRCODE = '42501';
  END IF;
  FOREACH _collection IN ARRAY _collections LOOP
    _records := tasks_private.export_v14_collection(_collection, _owner_id);
    _data := _data || jsonb_build_object(_collection, _records);
    _counts := _counts || jsonb_build_object(
      _collection, jsonb_array_length(_records)
    );
    _checksums := _checksums || jsonb_build_object(
      _collection, tasks_private.export_checksum(_records)
    );
  END LOOP;
  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 14,
    'created_at', clock_timestamp(),
    'manifest', jsonb_build_object(
      'collections', to_jsonb(_collections),
      'counts', _counts,
      'checksums', _checksums
    ),
    'data', _data
  );
END
$$;

REVOKE ALL ON FUNCTION public.tasks_create_export_v14() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v14() TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v14(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  _collection text;
  _records jsonb;
  _expected constant text[] := ARRAY[
    'tasks_areas', 'tasks_todos', 'tasks_checklist_items',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings',
    'tasks_mail_sources', 'tasks_mail_source_events',
    'tasks_recurrence_definitions', 'tasks_recurrence_revisions',
    'tasks_recurrence_occurrences', 'tasks_recurrence_evaluations',
    'tasks_recurrence_status_events', 'tasks_reminders',
    'tasks_reminder_occurrences'
  ];
BEGIN
  IF jsonb_typeof(_envelope) <> 'object'
    OR _envelope ->> 'format' <> 'garden.bath.tasks.export'
    OR _envelope ->> 'schema_version' <> '14'
    OR jsonb_typeof(_envelope -> 'manifest') <> 'object'
    OR jsonb_typeof(_envelope -> 'data') <> 'object'
    OR _envelope #>> '{manifest,checksums,algorithm}' <> 'sha256'
    OR (_envelope #> '{manifest,collections}') IS DISTINCT FROM to_jsonb(_expected)
    OR (SELECT array_agg(key ORDER BY key)
        FROM jsonb_object_keys(_envelope -> 'data') AS key)
      IS DISTINCT FROM (SELECT array_agg(value ORDER BY value)
                        FROM unnest(_expected) AS value)
  THEN
    RAISE EXCEPTION 'Task export schema fourteen is invalid'
      USING ERRCODE = '22023';
  END IF;
  FOREACH _collection IN ARRAY _expected LOOP
    _records := _envelope #> ARRAY['data', _collection];
    IF jsonb_typeof(_records) <> 'array'
      OR (_envelope #>> ARRAY['manifest', 'counts', _collection]) !~ '^[0-9]+$'
      OR (_envelope #>> ARRAY['manifest', 'counts', _collection])::bigint
        <> jsonb_array_length(_records)
      OR (_envelope #>> ARRAY['manifest', 'checksums', _collection])
        IS DISTINCT FROM tasks_private.export_checksum(_records)
    THEN
      RAISE EXCEPTION 'Task export collection % is invalid', _collection
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- The historical validators still carry the structural Mail source and
  -- append-only audit-chain invariants. Project the template-free envelope
  -- through the existing validation-only downgrade chain so schema 14 retains
  -- those protections instead of validating checksums alone.
  PERFORM tasks_private.validate_export_v6(
    tasks_private.export_v7_as_v6(
      tasks_private.export_v8_as_v7(
        tasks_private.export_v9_as_v8(
          tasks_private.export_v10_as_v9(
            tasks_private.export_v12_as_v10_for_validation(
              tasks_private.export_v13_as_v12_for_validation(_envelope)
            )
          )
        )
      )
    )
  );
END
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v14(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.legacy_prototype_snapshot_v14(
  _snapshot jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  _checklist jsonb;
  _result jsonb;
BEGIN
  IF jsonb_typeof(_snapshot) <> 'object'
    OR _snapshot ->> 'kind' <> 'todo'
    OR jsonb_typeof(_snapshot -> 'root') <> 'object' THEN
    RAISE EXCEPTION 'Legacy recurrence prototype snapshot is invalid'
      USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(jsonb_agg(
    CASE WHEN item ? 'completed' THEN item
      ELSE item || jsonb_build_object('completed', false) END
    ORDER BY ordinal
  ), '[]'::jsonb)
  INTO _checklist
  FROM jsonb_array_elements(
    COALESCE(_snapshot #> '{root,checklist}', '[]'::jsonb)
  ) WITH ORDINALITY AS rows(item, ordinal);
  _result := jsonb_set(_snapshot, '{version}', '2'::jsonb, true);
  _result := jsonb_set(
    _result,
    '{root,primary_link}',
    COALESCE(_result #> '{root,primary_link}', 'null'::jsonb),
    true
  );
  _result := jsonb_set(_result, '{root,checklist}', _checklist, true);
  RETURN _result;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.legacy_prototype_snapshot_v14(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.upgrade_export_to_v14(_envelope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  _v13 jsonb;
  _collection text;
  _records jsonb;
  _data jsonb := '{}'::jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
  _projection_root_ids text[];
  _projection_occurrence_ids text[];
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_todos', 'tasks_checklist_items',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings',
    'tasks_mail_sources', 'tasks_mail_source_events',
    'tasks_recurrence_definitions', 'tasks_recurrence_revisions',
    'tasks_recurrence_occurrences', 'tasks_recurrence_evaluations',
    'tasks_recurrence_status_events', 'tasks_reminders',
    'tasks_reminder_occurrences'
  ];
BEGIN
  IF _envelope ->> 'schema_version' = '14' THEN
    PERFORM tasks_private.validate_export_v14(_envelope);
    RETURN _envelope;
  END IF;
  _v13 := tasks_private.upgrade_export_to_v13(_envelope);
  PERFORM tasks_private.validate_export_v13(_v13);

  SELECT COALESCE(array_agg(occurrence ->> 'root_id'), ARRAY[]::text[]),
         COALESCE(array_agg(occurrence ->> 'id'), ARRAY[]::text[])
  INTO _projection_root_ids, _projection_occurrence_ids
  FROM jsonb_array_elements(_v13 #> '{data,tasks_recurrence_occurrences}') occurrence
  JOIN LATERAL (
    SELECT definition
    FROM jsonb_array_elements(_v13 #> '{data,tasks_recurrence_definitions}') definition
    WHERE definition ->> 'id' = occurrence ->> 'recurrence_id'
  ) definition_row ON true
  WHERE occurrence ->> 'origin' = 'generated'
    AND (occurrence ->> 'scheduled_date')::date
      > COALESCE((definition_row.definition ->> 'evaluated_through_date')::date, '-infinity'::date);

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_v13 #> '{data,tasks_recurrence_occurrences}') occurrence
    WHERE occurrence ->> 'id' = ANY(_projection_occurrence_ids)
    GROUP BY occurrence ->> 'recurrence_id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Legacy export has duplicate future recurrence projections'
      USING ERRCODE = '22023';
  END IF;

  FOREACH _collection IN ARRAY _collections LOOP
    IF _collection = 'tasks_todos' THEN
      SELECT COALESCE(jsonb_agg(
        CASE WHEN task ->> 'source_kind' = 'template'
          THEN (task - ARRAY[
            'template_definition_id', 'template_revision',
            'template_instantiation_id', 'template_node_id'
          ]) || jsonb_build_object(
            'source_kind', NULL, 'source_url', NULL,
            'source_title', NULL, 'source_external_id', NULL
          )
          ELSE task - ARRAY[
            'template_definition_id', 'template_revision',
            'template_instantiation_id', 'template_node_id'
          ]
        END ORDER BY task ->> 'id'
      ), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v13 #> '{data,tasks_todos}') task
      WHERE task ->> 'id' <> ALL(_projection_root_ids);
    ELSIF _collection = 'tasks_checklist_items' THEN
      SELECT COALESCE(jsonb_agg(
        item - ARRAY[
          'template_definition_id', 'template_revision',
          'template_instantiation_id', 'template_node_id'
        ] ORDER BY item ->> 'id'
      ), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v13 #> '{data,tasks_checklist_items}') item
      WHERE item ->> 'task_id' <> ALL(_projection_root_ids);
    ELSIF _collection = 'tasks_recurrence_definitions' THEN
      SELECT COALESCE(jsonb_agg(
        definition || jsonb_build_object(
          'next_occurrence_date', CASE
            WHEN revision ->> 'rule_mode' = 'calendar' THEN COALESCE(
              (
                SELECT min(occurrence ->> 'scheduled_date')
                FROM jsonb_array_elements(
                  _v13 #> '{data,tasks_recurrence_occurrences}'
                ) occurrence
                WHERE occurrence ->> 'recurrence_id' = definition ->> 'id'
                  AND occurrence ->> 'id' = ANY(_projection_occurrence_ids)
              ),
              revision ->> 'start_date'
            )
            ELSE NULL
          END
        ) ORDER BY definition ->> 'id'
      ), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v13 #> '{data,tasks_recurrence_definitions}') definition
      JOIN LATERAL (
        SELECT row
        FROM jsonb_array_elements(_v13 #> '{data,tasks_recurrence_revisions}') row
        WHERE row ->> 'recurrence_id' = definition ->> 'id'
          AND (row ->> 'revision')::integer
            = (definition ->> 'current_revision')::integer
      ) revision_row ON true
      CROSS JOIN LATERAL (SELECT revision_row.row AS revision) named_revision;
    ELSIF _collection = 'tasks_recurrence_revisions' THEN
      SELECT COALESCE(jsonb_agg(
        (revision - ARRAY['template_id', 'template_revision'])
          || jsonb_build_object(
            'prototype_snapshot', tasks_private.legacy_prototype_snapshot_v14(
              template_revision -> 'snapshot'
            )
          )
        ORDER BY revision ->> 'recurrence_id',
          (revision ->> 'revision')::integer
      ), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v13 #> '{data,tasks_recurrence_revisions}') revision
      JOIN LATERAL (
        SELECT row
        FROM jsonb_array_elements(_v13 #> '{data,tasks_template_revisions}') row
        WHERE row ->> 'template_id' = revision ->> 'template_id'
          AND (row ->> 'revision')::integer
            = (revision ->> 'template_revision')::integer
      ) template_revision_row ON true
      CROSS JOIN LATERAL (
        SELECT template_revision_row.row AS template_revision
      ) named_template_revision;
      IF jsonb_array_length(_records)
        <> jsonb_array_length(_v13 #> '{data,tasks_recurrence_revisions}') THEN
        RAISE EXCEPTION 'Legacy recurrence snapshot reference is missing'
          USING ERRCODE = '22023';
      END IF;
    ELSIF _collection = 'tasks_recurrence_occurrences' THEN
      SELECT COALESCE(jsonb_agg(
        occurrence - 'template_instantiation_id'
        ORDER BY occurrence ->> 'id'
      ), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(
        _v13 #> '{data,tasks_recurrence_occurrences}'
      ) occurrence
      WHERE occurrence ->> 'id' <> ALL(_projection_occurrence_ids);
    ELSE
      _records := COALESCE(_v13 #> ARRAY['data', _collection], '[]'::jsonb);
    END IF;
    _data := _data || jsonb_build_object(_collection, _records);
    _counts := _counts || jsonb_build_object(
      _collection, jsonb_array_length(_records)
    );
    _checksums := _checksums || jsonb_build_object(
      _collection, tasks_private.export_checksum(_records)
    );
  END LOOP;
  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 14,
    'created_at', _v13 -> 'created_at',
    'manifest', jsonb_build_object(
      'collections', to_jsonb(_collections),
      'counts', _counts,
      'checksums', _checksums
    ),
    'data', _data
  );
END
$$;

REVOKE ALL ON FUNCTION tasks_private.upgrade_export_to_v14(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v14(
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
  _collection text;
  _table regclass;
  _collection_report jsonb;
  _record jsonb;
  _report jsonb := jsonb_build_object('schema_version', 14, 'dry_run', _dry_run);
  _conflicts bigint := 0;
  _inserts bigint := 0;
  _collections constant text[] := ARRAY[
    'tasks_user_settings', 'tasks_areas',
    'tasks_recurrence_definitions', 'tasks_recurrence_revisions',
    'tasks_todos', 'tasks_checklist_items', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_reminders',
    'tasks_reminder_occurrences'
  ];
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v14(_envelope);
  FOREACH _collection IN ARRAY _collections LOOP
    _table := ('public.' || _collection)::regclass;
    IF _collection = 'tasks_mail_sources' THEN
      _collection_report := tasks_private.classify_restore_v5_mail_sources(
        _owner_id, _envelope #> ARRAY['data', _collection]
      );
    ELSE
      _collection_report := tasks_private.classify_restore_v4_collection(
        _owner_id, _table, _envelope #> ARRAY['data', _collection],
        _collection <> 'tasks_hierarchy_operations'
      );
    END IF;
    _report := _report || jsonb_build_object(_collection, _collection_report);
    _conflicts := _conflicts + (_collection_report ->> 'conflicts')::bigint;
    _inserts := _inserts + (_collection_report ->> 'inserts')::bigint;
  END LOOP;

  IF NOT _dry_run AND _conflicts = 0 AND _inserts > 0 THEN
    SET CONSTRAINTS ALL DEFERRED;
    INSERT INTO tasks_private.restore_contexts (
      backend_pid, transaction_id, owner_id
    ) VALUES (pg_backend_pid(), txid_current(), _owner_id);
    FOREACH _collection IN ARRAY _collections LOOP
      _table := ('public.' || _collection)::regclass;
      IF _collection = 'tasks_mail_sources' THEN
        FOR _record IN SELECT value FROM jsonb_array_elements(
          _envelope #> ARRAY['data', _collection]
        ) LOOP
          IF _report -> _collection -> 'insert_ids'
            @> jsonb_build_array(_record -> 'task_id') THEN
            INSERT INTO public.tasks_mail_sources
            SELECT (jsonb_populate_record(
              NULL::public.tasks_mail_sources,
              _record || jsonb_build_object('owner_id', _owner_id)
            )).*;
          END IF;
        END LOOP;
      ELSE
        PERFORM tasks_private.insert_restore_v4_collection(
          _owner_id, _table, _envelope #> ARRAY['data', _collection],
          _report -> _collection
        );
      END IF;
    END LOOP;
    DELETE FROM tasks_private.restore_contexts
    WHERE backend_pid = pg_backend_pid()
      AND transaction_id = txid_current()
      AND owner_id = _owner_id;
    _report := _report || jsonb_build_object('applied', true, 'code', NULL);
  ELSIF NOT _dry_run AND _conflicts = 0 THEN
    _report := _report || jsonb_build_object(
      'applied', false, 'code', 'already_applied'
    );
  ELSE
    _report := _report || jsonb_build_object(
      'applied', false,
      'code', CASE WHEN _conflicts > 0 THEN 'restore_conflict' ELSE NULL END
    );
  END IF;
  RETURN _report;
END
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v14(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v14(jsonb, boolean)
TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_current(
  _envelope jsonb,
  _dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.tasks_restore_export_v14(
    tasks_private.upgrade_export_to_v14(_envelope), _dry_run
  );
END
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_current(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_current(jsonb, boolean)
TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.lock_replace_restore_scope()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  LOCK TABLE
    public.tasks_areas, public.tasks_todos, public.tasks_checklist_items,
    public.tasks_history_events, public.tasks_hierarchy_operations,
    public.tasks_hierarchy_history_events, public.tasks_user_settings,
    public.tasks_mail_sources, public.tasks_mail_source_events,
    public.tasks_recurrence_definitions, public.tasks_recurrence_revisions,
    public.tasks_recurrence_occurrences, public.tasks_recurrence_evaluations,
    public.tasks_recurrence_status_events, public.tasks_reminders,
    public.tasks_reminder_occurrences, public.tasks_reminder_deliveries,
    public.tasks_reminder_claims, tasks_private.permanent_deletion_receipts,
    tasks_private.replace_restore_receipts
  IN SHARE ROW EXCLUSIVE MODE;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.lock_replace_restore_scope()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_prepare_replace_restore_v14(_envelope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _backup jsonb;
  _preview jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to prepare task replacement'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v14(_envelope);
  _backup := public.tasks_create_export_v14();
  _preview := public.tasks_restore_export_v14(_envelope, true);
  RETURN jsonb_build_object(
    'schema_version', 14,
    'backup', _backup,
    'backup_digest', tasks_private.export_checksum(_backup - 'created_at'),
    'current_counts', _backup #> '{manifest,counts}',
    'incoming_counts', _envelope #> '{manifest,counts}',
    'restore_preview', _preview
  );
END
$$;

REVOKE ALL ON FUNCTION public.tasks_prepare_replace_restore_v14(jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_prepare_replace_restore_v14(jsonb)
TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_replace_restore_v14(
  _envelope jsonb,
  _expected_backup_digest text,
  _request_id uuid,
  _confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _target_digest text;
  _request_digest text;
  _receipt tasks_private.replace_restore_receipts;
  _backup jsonb;
  _backup_digest text;
  _restore_report jsonb;
  _result jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to replace task data'
      USING ERRCODE = '42501';
  END IF;
  IF _confirmation IS DISTINCT FROM 'REPLACE TASK DATA' THEN
    RAISE EXCEPTION 'Task replacement requires explicit confirmation'
      USING ERRCODE = '22023';
  END IF;
  IF _request_id IS NULL OR _expected_backup_digest IS NULL
    OR _expected_backup_digest !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'The pre-restore backup input is invalid'
      USING ERRCODE = '22023';
  END IF;
  PERFORM tasks_private.validate_export_v14(_envelope);
  _target_digest := tasks_private.export_checksum(_envelope);
  _request_digest := encode(extensions.digest(convert_to(jsonb_build_object(
    'backup_digest', _expected_backup_digest,
    'target_digest', _target_digest
  )::text, 'UTF8'), 'sha256'), 'hex');
  SELECT * INTO _receipt
  FROM tasks_private.replace_restore_receipts receipt
  WHERE receipt.request_id = _request_id AND receipt.owner_id = _owner_id;
  IF FOUND THEN
    IF _receipt.request_digest IS DISTINCT FROM _request_digest THEN
      RAISE EXCEPTION 'Task replacement request identifier was reused with different input'
        USING ERRCODE = '22023';
    END IF;
    RETURN _receipt.result;
  END IF;

  PERFORM tasks_private.lock_replace_restore_scope();
  PERFORM pg_advisory_xact_lock(
    hashtextextended('tasks-replace-restore:' || _owner_id::text, 0)
  );
  _backup := public.tasks_create_export_v14();
  _backup_digest := tasks_private.export_checksum(_backup - 'created_at');
  IF _backup_digest IS DISTINCT FROM _expected_backup_digest THEN
    RAISE EXCEPTION 'The pre-restore backup is stale' USING ERRCODE = '40001';
  END IF;

  SET CONSTRAINTS ALL DEFERRED;
  INSERT INTO tasks_private.restore_contexts (
    backend_pid, transaction_id, owner_id
  ) VALUES (pg_backend_pid(), txid_current(), _owner_id);
  DELETE FROM public.tasks_reminder_deliveries WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_reminder_claims WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_reminder_occurrences WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_reminders WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_mail_source_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_mail_sources WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_history_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_hierarchy_history_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_hierarchy_operations WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_checklist_items WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_todos WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_status_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_evaluations WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_occurrences WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_revisions WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_definitions WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_areas WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_user_settings WHERE owner_id = _owner_id;
  DELETE FROM tasks_private.permanent_deletion_receipts WHERE owner_id = _owner_id;
  DELETE FROM tasks_private.purged_creation_receipts WHERE owner_id = _owner_id;
  DELETE FROM tasks_private.restore_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current()
    AND owner_id = _owner_id;

  _restore_report := public.tasks_restore_export_v14(_envelope, false);
  IF COALESCE((_restore_report ->> 'applied')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Task replacement restore was rejected'
      USING ERRCODE = '40001', DETAIL = _restore_report::text;
  END IF;
  _result := jsonb_build_object(
    'outcome', 'accepted', 'schema_version', 14,
    'request_id', _request_id,
    'backup_digest', _expected_backup_digest,
    'target_digest', _target_digest,
    'removed_counts', _backup #> '{manifest,counts}',
    'restore_report', _restore_report
  );
  INSERT INTO tasks_private.replace_restore_receipts (
    request_id, owner_id, request_digest, result
  ) VALUES (_request_id, _owner_id, _request_digest, _result);
  RETURN _result;
END
$$;

REVOKE ALL ON FUNCTION public.tasks_replace_restore_v14(
  jsonb, text, uuid, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_replace_restore_v14(
  jsonb, text, uuid, text
) TO authenticated;

-- Relax the legacy Template linkage before the conversion performs any row
-- writes. PostgreSQL does not permit ALTER TABLE after queued row-trigger
-- events in the same transaction.
ALTER TABLE public.tasks_recurrence_occurrences
  DROP CONSTRAINT IF EXISTS tasks_recurrence_occurrences_instantiation_origin_valid;

ALTER TABLE public.tasks_recurrence_revisions
  ALTER COLUMN template_id DROP NOT NULL,
  ALTER COLUMN template_revision DROP NOT NULL;

-- Recurrence revisions are immutable during ordinary operation. Enter the
-- existing owner-scoped recurrence context for this transaction so the
-- one-time, fail-closed schema conversion may attach its prototype snapshots
-- without weakening the trigger for any other session or future write.
INSERT INTO tasks_private.recurrence_contexts (
  backend_pid, transaction_id, owner_id
)
SELECT pg_backend_pid(), txid_current(), owners.owner_id
FROM (
  SELECT DISTINCT owner_id
  FROM public.tasks_recurrence_revisions
) AS owners
ON CONFLICT DO NOTHING;

UPDATE public.tasks_recurrence_revisions AS recurrence_revision
SET prototype_snapshot = tasks_private.normalize_recurrence_snapshot(
  template_revision.snapshot
)
FROM public.tasks_template_revisions AS template_revision
WHERE template_revision.template_id = recurrence_revision.template_id
  AND template_revision.revision = recurrence_revision.template_revision
  AND template_revision.owner_id = recurrence_revision.owner_id;

-- A single generated future row was the old materialized prototype. Preserve
-- its latest editable content before removing it. Adopted future tasks and
-- reached tasks deferred into the future remain ordinary instances.
WITH owner_dates AS (
  SELECT settings.owner_id,
    (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date AS planning_date
  FROM public.tasks_user_settings AS settings
), future_projections AS (
  SELECT occurrence.id AS occurrence_id,
    occurrence.owner_id,
    occurrence.recurrence_id,
    occurrence.recurrence_revision,
    occurrence.root_id,
    occurrence.scheduled_date
  FROM public.tasks_recurrence_occurrences AS occurrence
  JOIN owner_dates ON owner_dates.owner_id = occurrence.owner_id
  JOIN public.tasks_todos AS task
    ON task.id = occurrence.root_id
   AND task.owner_id = occurrence.owner_id
  WHERE occurrence.origin = 'generated'
    AND occurrence.scheduled_date > owner_dates.planning_date
    AND task.lifecycle = 'open'
    AND task.disposition = 'present'
)
UPDATE public.tasks_recurrence_revisions AS revision
SET prototype_snapshot = tasks_private.recurrence_snapshot_from_todo(
  projection.owner_id,
  projection.root_id,
  projection.scheduled_date
)
FROM future_projections AS projection
WHERE revision.owner_id = projection.owner_id
  AND revision.recurrence_id = projection.recurrence_id
  AND revision.revision = projection.recurrence_revision;

ALTER TABLE public.tasks_recurrence_revisions
  ALTER COLUMN prototype_snapshot SET NOT NULL,
  ADD CONSTRAINT tasks_recurrence_revisions_prototype_snapshot_valid CHECK (
    jsonb_typeof(prototype_snapshot) = 'object'
    AND prototype_snapshot ->> 'version' = '2'
    AND prototype_snapshot ->> 'kind' = 'todo'
    AND jsonb_typeof(prototype_snapshot -> 'root') = 'object'
    AND NULLIF(btrim(prototype_snapshot #>> '{root,title}'), '') IS NOT NULL
    AND jsonb_typeof(prototype_snapshot #> '{root,checklist}') = 'array'
  );

CREATE OR REPLACE FUNCTION tasks_private.recurrence_next_date_after(
  _revision public.tasks_recurrence_revisions,
  _after_date date
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _candidate date;
  _step integer := 0;
BEGIN
  LOOP
    _candidate := tasks_private.recurrence_date_for_step(_revision, _step);
    IF _candidate IS NULL OR _candidate > _after_date THEN
      RETURN _candidate;
    END IF;
    _step := _step + 1;
    IF _step > 100000 THEN
      RAISE EXCEPTION 'Recurrence next-date search is too large'
        USING ERRCODE = '54000';
    END IF;
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.recurrence_next_date_after(
  public.tasks_recurrence_revisions, date
) FROM PUBLIC, anon, authenticated;

WITH owner_dates AS (
  SELECT settings.owner_id,
    (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date AS planning_date
  FROM public.tasks_user_settings AS settings
), future_projections AS (
  SELECT occurrence.owner_id,
    occurrence.recurrence_id,
    occurrence.scheduled_date,
    occurrence.root_id,
    occurrence.id AS occurrence_id
  FROM public.tasks_recurrence_occurrences AS occurrence
  JOIN owner_dates ON owner_dates.owner_id = occurrence.owner_id
  JOIN public.tasks_todos AS task
    ON task.id = occurrence.root_id
   AND task.owner_id = occurrence.owner_id
  WHERE occurrence.origin = 'generated'
    AND occurrence.scheduled_date > owner_dates.planning_date
    AND task.lifecycle = 'open'
    AND task.disposition = 'present'
)
UPDATE public.tasks_recurrence_definitions AS definition
SET next_occurrence_date = projection.scheduled_date,
    record_revision = definition.record_revision + 1,
    client_mutation_id = gen_random_uuid()
FROM future_projections AS projection
WHERE definition.id = projection.recurrence_id
  AND definition.owner_id = projection.owner_id;

WITH owner_dates AS (
  SELECT settings.owner_id,
    (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date AS planning_date
  FROM public.tasks_user_settings AS settings
), anchors AS (
  SELECT definition.id,
    definition.owner_id,
    revision.rule_mode,
    ROW(revision.*)::public.tasks_recurrence_revisions AS revision_row,
    greatest(
      owner_dates.planning_date,
      COALESCE((
        SELECT max(occurrence.scheduled_date)
        FROM public.tasks_recurrence_occurrences AS occurrence
        WHERE occurrence.recurrence_id = definition.id
          AND occurrence.owner_id = definition.owner_id
          AND occurrence.origin = 'adopted'
          AND occurrence.scheduled_date > owner_dates.planning_date
      ), owner_dates.planning_date)
    ) AS after_date
  FROM public.tasks_recurrence_definitions AS definition
  JOIN public.tasks_recurrence_revisions AS revision
    ON revision.recurrence_id = definition.id
   AND revision.owner_id = definition.owner_id
   AND revision.revision = definition.current_revision
  JOIN owner_dates ON owner_dates.owner_id = definition.owner_id
)
UPDATE public.tasks_recurrence_definitions AS definition
SET next_occurrence_date = CASE
  WHEN anchors.rule_mode = 'calendar'
    THEN COALESCE(
      definition.next_occurrence_date,
      tasks_private.recurrence_next_date_after(
        anchors.revision_row, anchors.after_date
      )
    )
  ELSE definition.next_occurrence_date
END,
    record_revision = definition.record_revision + 1,
    client_mutation_id = gen_random_uuid()
FROM anchors
WHERE definition.id = anchors.id
  AND definition.owner_id = anchors.owner_id
  AND definition.status = 'active';

CREATE TEMP TABLE tasks_recurrence_removed_projections ON COMMIT DROP AS
WITH owner_dates AS (
  SELECT settings.owner_id,
    (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date AS planning_date
  FROM public.tasks_user_settings AS settings
)
SELECT occurrence.id AS occurrence_id,
  occurrence.owner_id,
  occurrence.root_id
FROM public.tasks_recurrence_occurrences AS occurrence
JOIN owner_dates ON owner_dates.owner_id = occurrence.owner_id
JOIN public.tasks_todos AS task
  ON task.id = occurrence.root_id
 AND task.owner_id = occurrence.owner_id
WHERE occurrence.origin = 'generated'
  AND occurrence.scheduled_date > owner_dates.planning_date
  AND task.lifecycle = 'open'
  AND task.disposition = 'present';

DELETE FROM public.tasks_checklist_items AS item
USING tasks_recurrence_removed_projections AS projection
WHERE item.owner_id = projection.owner_id
  AND item.task_id = projection.root_id;

DELETE FROM public.tasks_todos AS task
USING tasks_recurrence_removed_projections AS projection
WHERE task.owner_id = projection.owner_id
  AND task.id = projection.root_id;

DELETE FROM public.tasks_recurrence_occurrences AS occurrence
USING tasks_recurrence_removed_projections AS projection
WHERE occurrence.owner_id = projection.owner_id
  AND occurrence.id = projection.occurrence_id;

DELETE FROM tasks_private.recurrence_contexts
WHERE backend_pid = pg_backend_pid()
  AND transaction_id = txid_current();

CREATE OR REPLACE FUNCTION tasks_private.instantiate_recurrence_occurrence(
  _owner_id uuid,
  _definition public.tasks_recurrence_definitions,
  _revision public.tasks_recurrence_revisions,
  _scheduled_date date,
  _logical_key text,
  _predecessor_occurrence_id uuid,
  _entry_channel text,
  _actor_type text
)
RETURNS public.tasks_recurrence_occurrences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _existing public.tasks_recurrence_occurrences;
  _occurrence public.tasks_recurrence_occurrences;
  _snapshot jsonb := _revision.prototype_snapshot;
  _root jsonb;
  _item jsonb;
  _task_id uuid := gen_random_uuid();
  _occurrence_id uuid := gen_random_uuid();
  _item_id uuid;
  _start_date date;
  _deadline date;
  _planning_date date;
BEGIN
  SELECT occurrence.* INTO _existing
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.recurrence_id = _definition.id
    AND occurrence.logical_key = _logical_key;
  IF FOUND THEN
    RETURN _existing;
  END IF;

  _snapshot := tasks_private.normalize_recurrence_snapshot(_snapshot);
  _root := _snapshot -> 'root';
  _start_date := CASE
    WHEN _root -> 'start_offset_days' IS NULL
      OR _root -> 'start_offset_days' = 'null'::jsonb THEN NULL
    ELSE _scheduled_date + (_root ->> 'start_offset_days')::integer
  END;
  _deadline := CASE
    WHEN _root -> 'deadline_offset_days' IS NULL
      OR _root -> 'deadline_offset_days' = 'null'::jsonb THEN NULL
    ELSE _scheduled_date + (_root ->> 'deadline_offset_days')::integer
  END;
  _planning_date := (
    clock_timestamp() AT TIME ZONE _revision.planning_timezone
  )::date;

  INSERT INTO public.tasks_todos (
    id, owner_id, title, notes, lifecycle, completed_at, canceled_at,
    disposition, deleted_at, destination, order_key, entry_channel,
    source_kind, source_url, source_title, source_external_id,
    revision, client_mutation_id, created_at, updated_at,
    last_mutation_channel, last_actor_type, start_date, deadline,
    today_section, area_id, hierarchy_order_key, actionability,
    primary_link
  ) VALUES (
    _task_id,
    _owner_id,
    _root ->> 'title',
    COALESCE(_root ->> 'notes', ''),
    'open', NULL, NULL, 'present', NULL,
    'anytime',
    COALESCE(NULLIF(_root ->> 'order_key', ''), 'a0'),
    _entry_channel,
    NULL, NULL, NULL, NULL,
    1,
    gen_random_uuid(),
    clock_timestamp(),
    clock_timestamp(),
    _entry_channel,
    _actor_type,
    _start_date,
    _deadline,
    CASE WHEN _start_date IS NOT NULL AND _start_date <= _planning_date
      THEN 'inbox' ELSE NULL END,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.tasks_areas AS area
      WHERE area.id = _revision.target_area_id
        AND area.owner_id = _owner_id
        AND area.disposition = 'present'
    ) THEN _revision.target_area_id ELSE NULL END,
    NULL,
    COALESCE(_root ->> 'actionability', 'actionable'),
    CASE WHEN NULLIF(btrim(_root ->> 'primary_link'), '') IS NULL
      THEN NULL ELSE _root ->> 'primary_link' END
  );

  FOR _item IN
    SELECT value
    FROM jsonb_array_elements(_snapshot #> '{root,checklist}')
  LOOP
    _item_id := gen_random_uuid();
    INSERT INTO public.tasks_checklist_items (
      id, owner_id, task_id, title, completed, completed_at, order_key,
      disposition, deleted_at, entry_channel, last_mutation_channel,
      last_actor_type, revision, client_mutation_id, created_at, updated_at
    ) VALUES (
      _item_id,
      _owner_id,
      _task_id,
      _item ->> 'title',
      COALESCE((_item ->> 'completed')::boolean, false),
      CASE WHEN COALESCE((_item ->> 'completed')::boolean, false)
        THEN clock_timestamp() ELSE NULL END,
      COALESCE(NULLIF(_item ->> 'order_key', ''), 'a0'),
      'present', NULL, _entry_channel, _entry_channel, _actor_type,
      1, gen_random_uuid(), clock_timestamp(), clock_timestamp()
    );
  END LOOP;

  INSERT INTO public.tasks_recurrence_occurrences (
    id, owner_id, recurrence_id, recurrence_revision, logical_key,
    scheduled_date, predecessor_occurrence_id,
    root_type, root_id, client_mutation_id, generated_at, origin
  ) VALUES (
    _occurrence_id, _owner_id, _definition.id, _revision.revision,
    _logical_key, _scheduled_date, _predecessor_occurrence_id,
    'todo', _task_id, _occurrence_id, clock_timestamp(), 'generated'
  )
  RETURNING * INTO _occurrence;

  INSERT INTO tasks_private.recurrence_contexts (
    backend_pid, transaction_id, owner_id
  ) VALUES (pg_backend_pid(), txid_current(), _owner_id)
  ON CONFLICT DO NOTHING;
  UPDATE public.tasks_todos
  SET recurrence_definition_id = _definition.id,
      recurrence_revision = _revision.revision,
      recurrence_occurrence_id = _occurrence.id,
      recurrence_logical_key = _logical_key,
      revision = revision + 1,
      client_mutation_id = gen_random_uuid(),
      last_mutation_channel = _entry_channel,
      last_actor_type = _actor_type,
      updated_at = clock_timestamp()
  WHERE id = _task_id AND owner_id = _owner_id;
  DELETE FROM tasks_private.recurrence_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current()
    AND owner_id = _owner_id;

  IF _revision.reminder_local_time IS NOT NULL
    AND auth.uid() IS NOT DISTINCT FROM _owner_id THEN
    PERFORM public.tasks_save_start_reminder(
      NULL, NULL, 'todo', _task_id,
      to_char(_revision.reminder_local_time, 'HH24:MI'),
      _revision.planning_timezone, 'earlier', gen_random_uuid(),
      _entry_channel, _actor_type
    );
  END IF;
  RETURN _occurrence;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.instantiate_recurrence_occurrence(
  uuid, public.tasks_recurrence_definitions,
  public.tasks_recurrence_revisions, date, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.tasks_save_recurrence(
  uuid, bigint, text, uuid, bigint, text, text, integer, date, text,
  text, integer, uuid, uuid, text, text
);

CREATE OR REPLACE FUNCTION public.tasks_create_recurrence_from_task(
  _task_id uuid,
  _name text,
  _rule_mode text,
  _frequency text,
  _interval_count integer,
  _schedule_date date,
  _rule_config jsonb,
  _end_mode text,
  _end_after_count integer,
  _end_on_date date,
  _reminder_local_time time,
  _deadline_offset_days integer,
  _mutation_id uuid,
  _mutation_channel text DEFAULT 'web',
  _actor_type text DEFAULT 'user'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _task public.tasks_todos;
  _definition public.tasks_recurrence_definitions;
  _revision public.tasks_recurrence_revisions;
  _occurrence public.tasks_recurrence_occurrences;
  _timezone text;
  _snapshot jsonb;
  _logical_key text;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to create recurrence'
      USING ERRCODE = '42501';
  END IF;
  IF _task_id IS NULL OR _mutation_id IS NULL
    OR NULLIF(btrim(_name), '') IS NULL
    OR _rule_mode NOT IN ('calendar', 'after_completion')
    OR _frequency NOT IN ('daily', 'weekly', 'monthly', 'yearly')
    OR _interval_count NOT BETWEEN 1 AND 1000
    OR _schedule_date IS NULL
    OR jsonb_typeof(COALESCE(_rule_config, '{}'::jsonb)) <> 'object'
    OR _end_mode NOT IN ('never', 'after', 'on_date')
    OR (_end_mode = 'after' AND COALESCE(_end_after_count, 0) < 1)
    OR (_end_mode = 'on_date' AND _end_on_date IS NULL)
    OR COALESCE(_deadline_offset_days, 0) < 0 THEN
    RAISE EXCEPTION 'Recurrence input is invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_owner_id::text || E'\x1f' || _mutation_id::text, 0)
  );
  SELECT occurrence.* INTO _occurrence
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.client_mutation_id = _mutation_id;
  IF FOUND THEN
    SELECT definition.* INTO _definition
    FROM public.tasks_recurrence_definitions AS definition
    WHERE definition.id = _occurrence.recurrence_id
      AND definition.owner_id = _owner_id;
    SELECT revision.* INTO _revision
    FROM public.tasks_recurrence_revisions AS revision
    WHERE revision.owner_id = _owner_id
      AND revision.recurrence_id = _occurrence.recurrence_id
      AND revision.revision = _occurrence.recurrence_revision;
    RETURN jsonb_build_object(
      'outcome', 'already_applied',
      'definition', to_jsonb(_definition) - 'owner_id',
      'revision', to_jsonb(_revision) - 'owner_id',
      'occurrence', to_jsonb(_occurrence) - 'owner_id'
    );
  END IF;

  SELECT task.* INTO _task
  FROM public.tasks_todos AS task
  WHERE task.id = _task_id
    AND task.owner_id = _owner_id
    AND task.disposition = 'present'
    AND task.lifecycle = 'open'
    AND task.recurrence_definition_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The task is unavailable for recurrence'
      USING ERRCODE = '22023';
  END IF;
  SELECT planning_timezone INTO _timezone
  FROM public.tasks_user_settings
  WHERE owner_id = _owner_id;

  _snapshot := tasks_private.recurrence_snapshot_from_todo(
    _owner_id, _task_id, _schedule_date
  );
  _snapshot := jsonb_set(
    jsonb_set(
      jsonb_set(_snapshot, '{root,destination}', '"anytime"'::jsonb),
      '{root,today_section}', 'null'::jsonb
    ),
    '{root,start_offset_days}',
    to_jsonb(CASE WHEN _deadline_offset_days IS NULL
      THEN 0 ELSE -_deadline_offset_days END)
  );
  _snapshot := jsonb_set(
    _snapshot,
    '{root,deadline_offset_days}',
    CASE WHEN _deadline_offset_days IS NULL
      THEN 'null'::jsonb ELSE '0'::jsonb END
  );

  INSERT INTO public.tasks_recurrence_definitions (
    owner_id, name, status, current_revision, record_revision,
    evaluated_through_date, next_occurrence_date,
    last_mutation_channel, last_actor_type, client_mutation_id,
    created_at, updated_at
  ) VALUES (
    _owner_id, btrim(_name), 'active', 1, 1, _schedule_date,
    NULL, _mutation_channel, _actor_type, _mutation_id,
    clock_timestamp(), clock_timestamp()
  ) RETURNING * INTO _definition;

  INSERT INTO public.tasks_recurrence_revisions (
    owner_id, recurrence_id, revision, name,
    rule_mode, frequency, interval_count, start_date, planning_timezone,
    missed_policy, catch_up_limit, target_area_id, client_mutation_id,
    created_at, rule_config, end_mode, end_after_count, end_on_date,
    reminder_local_time, deadline_offset_days, prototype_snapshot
  ) VALUES (
    _owner_id, _definition.id, 1, btrim(_name),
    _rule_mode, _frequency, _interval_count, _schedule_date, _timezone,
    'latest', 100, _task.area_id, _mutation_id, clock_timestamp(),
    COALESCE(_rule_config, '{}'::jsonb), _end_mode,
    CASE WHEN _end_mode = 'after' THEN _end_after_count ELSE NULL END,
    CASE WHEN _end_mode = 'on_date' THEN _end_on_date ELSE NULL END,
    _reminder_local_time, _deadline_offset_days, _snapshot
  ) RETURNING * INTO _revision;

  _logical_key := CASE WHEN _rule_mode = 'calendar'
    THEN 'calendar:' || _schedule_date::text
    ELSE 'initial:' || _schedule_date::text END;
  INSERT INTO public.tasks_recurrence_occurrences (
    owner_id, recurrence_id, recurrence_revision, logical_key,
    scheduled_date, predecessor_occurrence_id,
    root_type, root_id, client_mutation_id, generated_at, origin
  ) VALUES (
    _owner_id, _definition.id, 1, _logical_key,
    _schedule_date, NULL, 'todo', _task_id, _mutation_id,
    clock_timestamp(), 'adopted'
  ) RETURNING * INTO _occurrence;

  INSERT INTO tasks_private.recurrence_contexts (
    backend_pid, transaction_id, owner_id
  ) VALUES (pg_backend_pid(), txid_current(), _owner_id)
  ON CONFLICT DO NOTHING;
  UPDATE public.tasks_todos
  SET recurrence_definition_id = _definition.id,
      recurrence_revision = 1,
      recurrence_occurrence_id = _occurrence.id,
      recurrence_logical_key = _logical_key,
      revision = revision + 1,
      client_mutation_id = gen_random_uuid(),
      last_mutation_channel = _mutation_channel,
      last_actor_type = _actor_type,
      updated_at = clock_timestamp()
  WHERE id = _task_id AND owner_id = _owner_id;
  DELETE FROM tasks_private.recurrence_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current()
    AND owner_id = _owner_id;

  IF _rule_mode = 'calendar' THEN
    UPDATE public.tasks_recurrence_definitions
    SET next_occurrence_date = tasks_private.recurrence_next_date_after(
          _revision, _schedule_date
        ),
        record_revision = record_revision + 1,
        client_mutation_id = gen_random_uuid(),
        last_mutation_channel = _mutation_channel,
        last_actor_type = _actor_type,
        updated_at = clock_timestamp()
    WHERE id = _definition.id AND owner_id = _owner_id
    RETURNING * INTO _definition;
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'definition', to_jsonb(_definition) - 'owner_id',
    'revision', to_jsonb(_revision) - 'owner_id',
    'occurrence', to_jsonb(_occurrence) - 'owner_id'
  );
END
$$;

REVOKE ALL ON FUNCTION public.tasks_create_recurrence_from_task(
  uuid, text, text, text, integer, date, jsonb, text, integer, date,
  time, integer, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_recurrence_from_task(
  uuid, text, text, text, integer, date, jsonb, text, integer, date,
  time, integer, uuid, text, text
) TO authenticated;

DROP FUNCTION IF EXISTS public.tasks_edit_recurrence(
  uuid, bigint, text, uuid, bigint, text, text, integer, date, text,
  text, integer, uuid, jsonb, text, integer, date, time, integer, uuid,
  text, text
);

CREATE OR REPLACE FUNCTION public.tasks_edit_recurrence(
  _recurrence_id uuid,
  _expected_record_revision bigint,
  _name text,
  _rule_mode text,
  _frequency text,
  _interval_count integer,
  _start_date date,
  _planning_timezone text,
  _missed_policy text,
  _catch_up_limit integer,
  _target_area_id uuid,
  _rule_config jsonb,
  _end_mode text,
  _end_after_count integer,
  _end_on_date date,
  _reminder_local_time time,
  _deadline_offset_days integer,
  _prototype_snapshot jsonb,
  _mutation_id uuid,
  _mutation_channel text DEFAULT 'web',
  _actor_type text DEFAULT 'user'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _definition public.tasks_recurrence_definitions;
  _existing_revision public.tasks_recurrence_revisions;
  _revision public.tasks_recurrence_revisions;
  _next_revision bigint;
  _snapshot jsonb;
  _planning_date date;
  _next_date date;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to edit recurrence'
      USING ERRCODE = '42501';
  END IF;
  IF _recurrence_id IS NULL OR _mutation_id IS NULL
    OR NULLIF(btrim(_name), '') IS NULL
    OR _rule_mode NOT IN ('calendar', 'after_completion')
    OR _frequency NOT IN ('daily', 'weekly', 'monthly', 'yearly')
    OR _interval_count NOT BETWEEN 1 AND 1000
    OR _start_date IS NULL
    OR _missed_policy NOT IN ('skip', 'latest', 'all')
    OR _catch_up_limit NOT BETWEEN 1 AND 100
    OR jsonb_typeof(COALESCE(_rule_config, '{}'::jsonb)) <> 'object'
    OR _end_mode NOT IN ('never', 'after', 'on_date')
    OR (_end_mode = 'after' AND COALESCE(_end_after_count, 0) < 1)
    OR (_end_mode = 'on_date' AND _end_on_date IS NULL)
    OR COALESCE(_deadline_offset_days, 0) < 0
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_timezone_names
      WHERE name = _planning_timezone
    ) THEN
    RAISE EXCEPTION 'Recurrence input is invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_owner_id::text || E'\x1f' || _mutation_id::text, 0)
  );
  SELECT revision.* INTO _revision
  FROM public.tasks_recurrence_revisions AS revision
  WHERE revision.owner_id = _owner_id
    AND revision.client_mutation_id = _mutation_id;
  IF FOUND THEN
    SELECT definition.* INTO _definition
    FROM public.tasks_recurrence_definitions AS definition
    WHERE definition.id = _revision.recurrence_id
      AND definition.owner_id = _owner_id;
    IF _revision.recurrence_id IS DISTINCT FROM _recurrence_id THEN
      RAISE EXCEPTION
        'The mutation identifier belongs to a different recurrence revision'
        USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'outcome', 'already_applied',
      'definition', to_jsonb(_definition) - 'owner_id',
      'revision', to_jsonb(_revision) - 'owner_id'
    );
  END IF;

  SELECT definition.* INTO _definition
  FROM public.tasks_recurrence_definitions AS definition
  WHERE definition.id = _recurrence_id
    AND definition.owner_id = _owner_id
  FOR UPDATE;
  IF NOT FOUND OR _definition.status = 'archived' THEN
    RAISE EXCEPTION 'The recurrence definition is unavailable'
      USING ERRCODE = '22023';
  END IF;
  IF _definition.record_revision <> _expected_record_revision THEN
    RETURN jsonb_build_object(
      'outcome', 'conflict',
      'definition', to_jsonb(_definition) - 'owner_id'
    );
  END IF;
  SELECT revision.* INTO _existing_revision
  FROM public.tasks_recurrence_revisions AS revision
  WHERE revision.owner_id = _owner_id
    AND revision.recurrence_id = _definition.id
    AND revision.revision = _definition.current_revision;
  _snapshot := tasks_private.normalize_recurrence_snapshot(
    COALESCE(_prototype_snapshot, _existing_revision.prototype_snapshot)
  );
  IF _target_area_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tasks_areas AS area
    WHERE area.id = _target_area_id
      AND area.owner_id = _owner_id
      AND area.disposition = 'present'
  ) THEN
    RAISE EXCEPTION 'The recurrence target area is unavailable'
      USING ERRCODE = '22023';
  END IF;

  _next_revision := _definition.current_revision + 1;
  INSERT INTO public.tasks_recurrence_revisions (
    owner_id, recurrence_id, revision, name, rule_mode, frequency,
    interval_count, start_date, planning_timezone, missed_policy,
    catch_up_limit, target_area_id, client_mutation_id, created_at,
    rule_config, end_mode, end_after_count, end_on_date,
    reminder_local_time, deadline_offset_days, prototype_snapshot
  ) VALUES (
    _owner_id, _definition.id, _next_revision, btrim(_name), _rule_mode,
    _frequency, _interval_count, _start_date, _planning_timezone,
    _missed_policy, _catch_up_limit, _target_area_id, _mutation_id,
    clock_timestamp(), COALESCE(_rule_config, '{}'::jsonb), _end_mode,
    CASE WHEN _end_mode = 'after' THEN _end_after_count ELSE NULL END,
    CASE WHEN _end_mode = 'on_date' THEN _end_on_date ELSE NULL END,
    _reminder_local_time, _deadline_offset_days, _snapshot
  ) RETURNING * INTO _revision;

  _planning_date := (
    clock_timestamp() AT TIME ZONE _planning_timezone
  )::date;
  IF _rule_mode = 'calendar' THEN
    _next_date := CASE
      WHEN _start_date > _planning_date THEN _start_date
      ELSE tasks_private.recurrence_next_date_after(_revision, _planning_date)
    END;
  ELSIF EXISTS (
    SELECT 1
    FROM public.tasks_recurrence_occurrences AS occurrence
    JOIN public.tasks_todos AS task
      ON task.id = occurrence.root_id
     AND task.owner_id = occurrence.owner_id
    WHERE occurrence.owner_id = _owner_id
      AND occurrence.recurrence_id = _definition.id
      AND task.lifecycle = 'open'
      AND task.disposition = 'present'
  ) THEN
    _next_date := NULL;
  ELSE
    _next_date := greatest(_start_date, _planning_date);
  END IF;

  UPDATE public.tasks_recurrence_definitions
  SET name = btrim(_name),
      current_revision = _next_revision,
      record_revision = record_revision + 1,
      evaluated_through_date = _planning_date,
      next_occurrence_date = _next_date,
      last_mutation_channel = _mutation_channel,
      last_actor_type = _actor_type,
      client_mutation_id = _mutation_id,
      updated_at = clock_timestamp()
  WHERE id = _definition.id AND owner_id = _owner_id
  RETURNING * INTO _definition;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'definition', to_jsonb(_definition) - 'owner_id',
    'revision', to_jsonb(_revision) - 'owner_id'
  );
END
$$;

REVOKE ALL ON FUNCTION public.tasks_edit_recurrence(
  uuid, bigint, text, text, text, integer, date, text, text, integer,
  uuid, jsonb, text, integer, date, time, integer, jsonb, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_edit_recurrence(
  uuid, bigint, text, text, text, integer, date, text, text, integer,
  uuid, jsonb, text, integer, date, time, integer, jsonb, uuid, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_evaluate_recurrence(
  _recurrence_id uuid,
  _through_date date,
  _request_id uuid,
  _entry_channel text DEFAULT 'web',
  _actor_type text DEFAULT 'user'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _definition public.tasks_recurrence_definitions;
  _revision public.tasks_recurrence_revisions;
  _existing public.tasks_recurrence_evaluations;
  _occurrence public.tasks_recurrence_occurrences;
  _candidate date;
  _next_candidate date;
  _selected_dates date[] := ARRAY[]::date[];
  _occurrence_ids jsonb := '[]'::jsonb;
  _result jsonb;
  _predecessor_id uuid;
  _loop_count integer := 0;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to evaluate recurrence'
      USING ERRCODE = '42501';
  END IF;
  IF _through_date IS NULL OR _request_id IS NULL THEN
    RAISE EXCEPTION 'Recurrence evaluation input is invalid'
      USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(_owner_id::text || E'\x1f' || _request_id::text, 0)
  );
  SELECT evaluation.* INTO _existing
  FROM public.tasks_recurrence_evaluations AS evaluation
  WHERE evaluation.id = _request_id
    AND evaluation.owner_id = _owner_id;
  IF FOUND THEN
    IF _existing.recurrence_id IS DISTINCT FROM _recurrence_id
      OR _existing.through_date IS DISTINCT FROM _through_date THEN
      RAISE EXCEPTION
        'The request identifier belongs to a different recurrence evaluation'
        USING ERRCODE = '23505';
    END IF;
    RETURN _existing.result || jsonb_build_object(
      'outcome', 'already_applied'
    );
  END IF;

  SELECT definition.* INTO _definition
  FROM public.tasks_recurrence_definitions AS definition
  WHERE definition.id = _recurrence_id
    AND definition.owner_id = _owner_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The recurrence definition is unavailable'
      USING ERRCODE = '22023';
  END IF;
  SELECT revision.* INTO _revision
  FROM public.tasks_recurrence_revisions AS revision
  WHERE revision.owner_id = _owner_id
    AND revision.recurrence_id = _definition.id
    AND revision.revision = _definition.current_revision;

  _next_candidate := _definition.next_occurrence_date;

  IF _definition.status = 'active'
    AND _definition.next_occurrence_date IS NOT NULL THEN
    IF _revision.rule_mode = 'calendar' THEN
      _next_candidate := _definition.next_occurrence_date;
      WHILE _next_candidate IS NOT NULL AND _next_candidate <= _through_date LOOP
        IF _revision.missed_policy = 'all' THEN
          _selected_dates := array_append(_selected_dates, _next_candidate);
          IF cardinality(_selected_dates) > _revision.catch_up_limit THEN
            RAISE EXCEPTION 'Recurrence catch-up exceeds its safety limit'
              USING ERRCODE = '54000';
          END IF;
        ELSIF _revision.missed_policy = 'latest' THEN
          _selected_dates := ARRAY[_next_candidate];
        ELSIF _next_candidate = _through_date THEN
          _selected_dates := ARRAY[_next_candidate];
        END IF;
        _next_candidate := tasks_private.recurrence_next_date_after(
          _revision, _next_candidate
        );
        _loop_count := _loop_count + 1;
        IF _loop_count > 100000 THEN
          RAISE EXCEPTION 'Recurrence evaluation range is too large'
            USING ERRCODE = '54000';
        END IF;
      END LOOP;
      FOREACH _candidate IN ARRAY _selected_dates LOOP
        _occurrence := tasks_private.instantiate_recurrence_occurrence(
          _owner_id, _definition, _revision, _candidate,
          'calendar:' || _candidate::text, NULL, _entry_channel, _actor_type
        );
        _occurrence_ids := _occurrence_ids || jsonb_build_array(_occurrence.id);
      END LOOP;
    ELSIF _definition.next_occurrence_date <= _through_date THEN
      SELECT occurrence.id INTO _predecessor_id
      FROM public.tasks_recurrence_occurrences AS occurrence
      WHERE occurrence.owner_id = _owner_id
        AND occurrence.recurrence_id = _definition.id
      ORDER BY occurrence.generated_at DESC, occurrence.id DESC
      LIMIT 1;
      _occurrence := tasks_private.instantiate_recurrence_occurrence(
        _owner_id, _definition, _revision,
        _definition.next_occurrence_date,
        'after:' || COALESCE(_predecessor_id::text, 'initial'),
        _predecessor_id, _entry_channel, _actor_type
      );
      _occurrence_ids := jsonb_build_array(_occurrence.id);
      _next_candidate := NULL;
    END IF;
  END IF;

  UPDATE public.tasks_recurrence_definitions
  SET next_occurrence_date = _next_candidate,
      evaluated_through_date = greatest(
        COALESCE(evaluated_through_date, _through_date), _through_date
      ),
      record_revision = record_revision + 1,
      last_mutation_channel = _entry_channel,
      last_actor_type = _actor_type,
      client_mutation_id = _request_id,
      updated_at = clock_timestamp()
  WHERE id = _definition.id AND owner_id = _owner_id
  RETURNING * INTO _definition;

  _result := jsonb_build_object(
    'outcome', 'accepted',
    'status', _definition.status,
    'through_date', _through_date,
    'generated_count', jsonb_array_length(_occurrence_ids),
    'occurrence_ids', _occurrence_ids,
    'definition', to_jsonb(_definition) - 'owner_id'
  );
  INSERT INTO public.tasks_recurrence_evaluations (
    id, owner_id, recurrence_id, through_date, result, client_mutation_id
  ) VALUES (
    _request_id, _owner_id, _definition.id, _through_date, _result, _request_id
  );
  RETURN _result;
END
$$;

REVOKE ALL ON FUNCTION public.tasks_evaluate_recurrence(
  uuid, date, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_evaluate_recurrence(
  uuid, date, uuid, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.advance_after_completion_recurrence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _definition public.tasks_recurrence_definitions;
  _revision public.tasks_recurrence_revisions;
  _terminal_at timestamptz;
  _terminal_date date;
  _next_date date;
  _later_occurrence_exists boolean;
  _occurrence_count integer;
BEGIN
  IF NEW.recurrence_occurrence_id IS NULL
    OR NEW.recurrence_definition_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT definition.* INTO _definition
  FROM public.tasks_recurrence_definitions AS definition
  WHERE definition.id = NEW.recurrence_definition_id
    AND definition.owner_id = NEW.owner_id
  FOR UPDATE;
  IF NOT FOUND OR _definition.status <> 'active' THEN
    RETURN NEW;
  END IF;
  SELECT revision.* INTO _revision
  FROM public.tasks_recurrence_revisions AS revision
  WHERE revision.owner_id = NEW.owner_id
    AND revision.recurrence_id = _definition.id
    AND revision.revision = _definition.current_revision;
  IF _revision.rule_mode <> 'after_completion' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.tasks_recurrence_occurrences AS later
    JOIN public.tasks_recurrence_occurrences AS current_occurrence
      ON current_occurrence.id = NEW.recurrence_occurrence_id
     AND current_occurrence.owner_id = NEW.owner_id
    WHERE later.owner_id = NEW.owner_id
      AND later.recurrence_id = _definition.id
      AND later.generated_at > current_occurrence.generated_at
  ) INTO _later_occurrence_exists;

  IF OLD.lifecycle = 'open'
    AND NEW.lifecycle IN ('completed', 'canceled')
    AND NOT _later_occurrence_exists THEN
    SELECT count(*) INTO _occurrence_count
    FROM public.tasks_recurrence_occurrences AS occurrence
    WHERE occurrence.owner_id = NEW.owner_id
      AND occurrence.recurrence_id = _definition.id;
    IF _revision.end_mode = 'after'
      AND _occurrence_count >= _revision.end_after_count THEN
      _next_date := NULL;
    ELSE
      _terminal_at := COALESCE(NEW.completed_at, NEW.canceled_at, clock_timestamp());
      _terminal_date := (
        _terminal_at AT TIME ZONE _revision.planning_timezone
      )::date;
      _next_date := CASE
        WHEN NEW.recurrence_revision < _revision.revision
          THEN _revision.start_date
        ELSE tasks_private.add_recurrence_interval(
          _terminal_date, _revision.frequency, _revision.interval_count, 1
        )
      END;
      IF _revision.end_mode = 'on_date'
        AND _next_date > _revision.end_on_date THEN
        _next_date := NULL;
      END IF;
    END IF;
    UPDATE public.tasks_recurrence_definitions
    SET next_occurrence_date = _next_date,
        record_revision = record_revision + 1,
        client_mutation_id = gen_random_uuid(),
        last_mutation_channel = COALESCE(NEW.last_mutation_channel, 'web'),
        last_actor_type = COALESCE(NEW.last_actor_type, 'user'),
        updated_at = clock_timestamp()
    WHERE id = _definition.id AND owner_id = NEW.owner_id;
  ELSIF OLD.lifecycle IN ('completed', 'canceled')
    AND NEW.lifecycle = 'open'
    AND NOT _later_occurrence_exists THEN
    UPDATE public.tasks_recurrence_definitions
    SET next_occurrence_date = NULL,
        record_revision = record_revision + 1,
        client_mutation_id = gen_random_uuid(),
        last_mutation_channel = COALESCE(NEW.last_mutation_channel, 'web'),
        last_actor_type = COALESCE(NEW.last_actor_type, 'user'),
        updated_at = clock_timestamp()
    WHERE id = _definition.id AND owner_id = NEW.owner_id;
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.advance_after_completion_recurrence()
FROM PUBLIC, anon, authenticated;

-- Keep permanent deletion operational after Template storage disappears.
-- Recurrence occurrences remain durable receipts even when their ordinary
-- spawned task is permanently erased.
CREATE OR REPLACE FUNCTION tasks_private.permanent_deletion_scope(
  _owner_id uuid,
  _root_type text,
  _root_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  _root_title text;
  _todo_ids uuid[] := ARRAY[]::uuid[];
  _checklist_ids uuid[] := ARRAY[]::uuid[];
  _task_history_ids uuid[] := ARRAY[]::uuid[];
  _hierarchy_history_ids uuid[] := ARRAY[]::uuid[];
  _mail_source_ids uuid[] := ARRAY[]::uuid[];
  _mail_event_ids uuid[] := ARRAY[]::uuid[];
  _reminder_ids uuid[] := ARRAY[]::uuid[];
  _reminder_occurrence_ids uuid[] := ARRAY[]::uuid[];
  _reminder_delivery_ids uuid[] := ARRAY[]::uuid[];
  _operation_ids uuid[] := ARRAY[]::uuid[];
  _recurrence_occurrence_ids uuid[] := ARRAY[]::uuid[];
  _hierarchy_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF _root_type <> 'todo' THEN
    RAISE EXCEPTION 'Permanent deletion supports deleted task roots only'
      USING ERRCODE = '22023';
  END IF;
  SELECT task.title INTO _root_title
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id
    AND task.id = _root_id
    AND task.disposition = 'deleted'
    AND task.deletion_root_id = task.id;
  IF _root_title IS NULL THEN
    RAISE EXCEPTION 'The deleted task root is unavailable'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tasks_areas AS area
    WHERE area.owner_id = _owner_id
      AND area.deletion_root_id = _root_id
  ) THEN
    RAISE EXCEPTION 'The deletion root contains an unsupported area record'
      USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(array_agg(task.id ORDER BY task.id), ARRAY[]::uuid[])
  INTO _todo_ids
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id AND task.deletion_root_id = _root_id;
  SELECT COALESCE(array_agg(item.id ORDER BY item.id), ARRAY[]::uuid[])
  INTO _checklist_ids
  FROM public.tasks_checklist_items AS item
  WHERE item.owner_id = _owner_id AND item.deletion_root_id = _root_id;
  _hierarchy_ids := _todo_ids || _checklist_ids;
  SELECT COALESCE(array_agg(event.id ORDER BY event.id), ARRAY[]::uuid[])
  INTO _task_history_ids
  FROM public.tasks_history_events AS event
  WHERE event.owner_id = _owner_id AND event.task_id = ANY(_todo_ids);
  SELECT COALESCE(array_agg(event.id ORDER BY event.id), ARRAY[]::uuid[])
  INTO _hierarchy_history_ids
  FROM public.tasks_hierarchy_history_events AS event
  WHERE event.owner_id = _owner_id AND event.entity_id = ANY(_hierarchy_ids);
  SELECT COALESCE(array_agg(source.task_id ORDER BY source.task_id), ARRAY[]::uuid[])
  INTO _mail_source_ids
  FROM public.tasks_mail_sources AS source
  WHERE source.owner_id = _owner_id AND source.task_id = ANY(_todo_ids);
  SELECT COALESCE(array_agg(event.id ORDER BY event.id), ARRAY[]::uuid[])
  INTO _mail_event_ids
  FROM public.tasks_mail_source_events AS event
  WHERE event.owner_id = _owner_id AND event.task_id = ANY(_todo_ids);
  SELECT COALESCE(array_agg(reminder.id ORDER BY reminder.id), ARRAY[]::uuid[])
  INTO _reminder_ids
  FROM public.tasks_reminders AS reminder
  WHERE reminder.owner_id = _owner_id AND reminder.task_id = ANY(_todo_ids);
  SELECT COALESCE(array_agg(occurrence.id ORDER BY occurrence.id), ARRAY[]::uuid[])
  INTO _reminder_occurrence_ids
  FROM public.tasks_reminder_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.reminder_id = ANY(_reminder_ids);
  SELECT COALESCE(array_agg(delivery.id ORDER BY delivery.id), ARRAY[]::uuid[])
  INTO _reminder_delivery_ids
  FROM public.tasks_reminder_deliveries AS delivery
  WHERE delivery.owner_id = _owner_id
    AND delivery.occurrence_id = ANY(_reminder_occurrence_ids);
  SELECT COALESCE(array_agg(operation.id ORDER BY operation.id), ARRAY[]::uuid[])
  INTO _operation_ids
  FROM public.tasks_hierarchy_operations AS operation
  WHERE operation.owner_id = _owner_id
    AND (
      operation.root_id = ANY(_hierarchy_ids)
      OR operation.affected_ids && _hierarchy_ids
    );
  SELECT COALESCE(array_agg(occurrence.id ORDER BY occurrence.id), ARRAY[]::uuid[])
  INTO _recurrence_occurrence_ids
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.root_type = 'todo'
    AND occurrence.root_id = ANY(_todo_ids);
  RETURN jsonb_build_object(
    'root', jsonb_build_object('type', 'todo', 'id', _root_id, 'title', _root_title),
    'hierarchy', jsonb_build_object(
      'todos', to_jsonb(_todo_ids),
      'checklist_items', to_jsonb(_checklist_ids)
    ),
    'hierarchy_revisions', jsonb_build_object(
      'todos', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('id', task.id, 'revision', task.revision)
          ORDER BY task.id
        )
        FROM public.tasks_todos AS task
        WHERE task.owner_id = _owner_id AND task.id = ANY(_todo_ids)
      ), '[]'::jsonb),
      'checklist_items', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('id', item.id, 'revision', item.revision)
          ORDER BY item.id
        )
        FROM public.tasks_checklist_items AS item
        WHERE item.owner_id = _owner_id AND item.id = ANY(_checklist_ids)
      ), '[]'::jsonb)
    ),
    'related', jsonb_build_object(
      'task_history_events', to_jsonb(_task_history_ids),
      'hierarchy_history_events', to_jsonb(_hierarchy_history_ids),
      'mail_sources', to_jsonb(_mail_source_ids),
      'mail_source_events', to_jsonb(_mail_event_ids),
      'reminders', to_jsonb(_reminder_ids),
      'reminder_occurrences', to_jsonb(_reminder_occurrence_ids),
      'reminder_deliveries', to_jsonb(_reminder_delivery_ids)
    ),
    'preserved_receipts', jsonb_build_object(
      'hierarchy_operations', to_jsonb(_operation_ids),
      'recurrence_occurrences', to_jsonb(_recurrence_occurrence_ids)
    ),
    'erased_record_count', cardinality(_hierarchy_ids)
      + cardinality(_task_history_ids)
      + cardinality(_hierarchy_history_ids)
      + cardinality(_mail_source_ids)
      + cardinality(_mail_event_ids)
      + cardinality(_reminder_ids)
      + cardinality(_reminder_occurrence_ids)
      + cardinality(_reminder_delivery_ids)
  );
END
$$;

CREATE OR REPLACE FUNCTION tasks_private.tasks_permanently_delete_after_confirmation(
  _root_type text,
  _root_id uuid,
  _scope_digest text,
  _request_id uuid,
  _confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _existing tasks_private.permanent_deletion_receipts;
  _scope jsonb;
  _current_digest text;
  _result jsonb;
  _todo_ids uuid[];
  _checklist_ids uuid[];
  _hierarchy_history_ids uuid[];
  _reminder_ids uuid[];
  _reminder_occurrence_ids uuid[];
  _reminder_delivery_ids uuid[];
  _completed_at timestamptz := clock_timestamp();
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF _root_type <> 'todo' OR _confirmation <> 'PERMANENTLY DELETE' THEN
    RAISE EXCEPTION 'Permanent deletion requires explicit task confirmation'
      USING ERRCODE = '22023';
  END IF;
  IF _scope_digest IS NULL OR _scope_digest !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Permanent deletion requires a valid preview digest'
      USING ERRCODE = '22023';
  END IF;
  SELECT receipt.* INTO _existing
  FROM tasks_private.permanent_deletion_receipts AS receipt
  WHERE receipt.owner_id = _owner_id AND receipt.id = _request_id;
  IF FOUND THEN
    IF _existing.root_type <> _root_type
      OR _existing.root_id <> _root_id
      OR _existing.scope_digest <> _scope_digest THEN
      RAISE EXCEPTION 'Permanent-deletion request identifier was reused with changed input'
        USING ERRCODE = '22023';
    END IF;
    RETURN _existing.result;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      _owner_id::text || ':' || _root_type || ':' || _root_id::text,
      0
    )
  );
  LOCK TABLE public.tasks_todos, public.tasks_checklist_items,
    public.tasks_history_events, public.tasks_hierarchy_history_events,
    public.tasks_hierarchy_operations, public.tasks_mail_sources,
    public.tasks_mail_source_events, public.tasks_reminders,
    public.tasks_reminder_occurrences, public.tasks_reminder_deliveries,
    public.tasks_recurrence_occurrences
  IN SHARE ROW EXCLUSIVE MODE;
  _scope := tasks_private.permanent_deletion_scope(_owner_id, _root_type, _root_id);
  _current_digest := tasks_private.export_checksum(_scope);
  IF _current_digest <> _scope_digest THEN
    RAISE EXCEPTION 'Permanent-deletion preview is stale' USING ERRCODE = '40001';
  END IF;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO _todo_ids
  FROM jsonb_array_elements_text(_scope #> '{hierarchy,todos}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO _checklist_ids
  FROM jsonb_array_elements_text(_scope #> '{hierarchy,checklist_items}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _hierarchy_history_ids
  FROM jsonb_array_elements_text(
    _scope #> '{related,hierarchy_history_events}'
  ) AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO _reminder_ids
  FROM jsonb_array_elements_text(_scope #> '{related,reminders}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _reminder_occurrence_ids
  FROM jsonb_array_elements_text(_scope #> '{related,reminder_occurrences}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _reminder_delivery_ids
  FROM jsonb_array_elements_text(_scope #> '{related,reminder_deliveries}') AS value;
  DELETE FROM public.tasks_reminder_deliveries
  WHERE owner_id = _owner_id AND id = ANY(_reminder_delivery_ids);
  DELETE FROM public.tasks_reminder_occurrences
  WHERE owner_id = _owner_id AND id = ANY(_reminder_occurrence_ids);
  DELETE FROM public.tasks_reminders
  WHERE owner_id = _owner_id AND id = ANY(_reminder_ids);
  DELETE FROM public.tasks_hierarchy_history_events
  WHERE owner_id = _owner_id AND id = ANY(_hierarchy_history_ids);
  DELETE FROM public.tasks_checklist_items
  WHERE owner_id = _owner_id AND id = ANY(_checklist_ids);
  DELETE FROM public.tasks_todos
  WHERE owner_id = _owner_id AND id = ANY(_todo_ids);
  _result := (
    (_scope #- ARRAY['root', 'title']::text[])
    - 'hierarchy_revisions'::text
  ) || jsonb_build_object(
    'outcome', 'accepted',
    'request_id', _request_id,
    'scope_digest', _scope_digest,
    'completed_at', _completed_at
  );
  INSERT INTO tasks_private.permanent_deletion_receipts (
    owner_id, id, root_type, root_id, scope_digest, result, completed_at
  ) VALUES (
    _owner_id, _request_id, 'todo', _root_id,
    _scope_digest, _result, _completed_at
  );
  RETURN _result;
END
$$;

-- Remove reusable Template persistence and all template provenance after the
-- recurrence snapshots and ordinary reached instances are safe.
SET CONSTRAINTS ALL IMMEDIATE;

DROP TRIGGER IF EXISTS tasks_todos_guard_template_provenance
  ON public.tasks_todos;
DROP TRIGGER IF EXISTS tasks_checklist_items_guard_template_provenance
  ON public.tasks_checklist_items;

ALTER TABLE public.tasks_recurrence_occurrences
  DROP CONSTRAINT IF EXISTS tasks_recurrence_occurrences_instantiation_owner_fkey,
  DROP COLUMN template_instantiation_id;

ALTER TABLE public.tasks_recurrence_revisions
  DROP CONSTRAINT IF EXISTS tasks_recurrence_revisions_template_owner_fkey,
  DROP COLUMN template_id,
  DROP COLUMN template_revision;

UPDATE public.tasks_todos
SET source_kind = NULL,
    source_url = NULL,
    source_title = NULL,
    source_external_id = NULL,
    revision = revision + 1,
    client_mutation_id = gen_random_uuid(),
    last_mutation_channel = 'web',
    last_actor_type = 'system'
WHERE source_kind = 'template';

SET CONSTRAINTS ALL IMMEDIATE;

ALTER TABLE public.tasks_todos
  DROP CONSTRAINT IF EXISTS tasks_todos_template_provenance_complete,
  DROP CONSTRAINT IF EXISTS tasks_todos_template_source_valid,
  DROP CONSTRAINT IF EXISTS tasks_todos_template_definition_owner_fkey,
  DROP CONSTRAINT IF EXISTS tasks_todos_template_revision_owner_fkey,
  DROP CONSTRAINT IF EXISTS tasks_todos_template_instantiation_owner_fkey,
  DROP COLUMN template_definition_id,
  DROP COLUMN template_revision,
  DROP COLUMN template_instantiation_id,
  DROP COLUMN template_node_id;

DROP INDEX IF EXISTS public.tasks_todos_owner_template_idx;

ALTER TABLE public.tasks_checklist_items
  DROP CONSTRAINT IF EXISTS tasks_checklist_items_template_provenance_complete,
  DROP CONSTRAINT IF EXISTS tasks_checklist_items_template_definition_owner_fkey,
  DROP CONSTRAINT IF EXISTS tasks_checklist_items_template_revision_owner_fkey,
  DROP CONSTRAINT IF EXISTS tasks_checklist_items_template_instantiation_owner_fkey,
  DROP COLUMN template_definition_id,
  DROP COLUMN template_revision,
  DROP COLUMN template_instantiation_id,
  DROP COLUMN template_node_id;

ALTER TABLE public.tasks_todos
  DROP CONSTRAINT IF EXISTS tasks_todos_source_kind_valid,
  ADD CONSTRAINT tasks_todos_source_kind_valid CHECK (
    source_kind IS NULL
    OR source_kind IN (
      'webpage', 'mail_message', 'file', 'selected_text',
      'reading_item', 'other'
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'powersync'
      AND schemaname = 'public'
      AND tablename = 'tasks_template_instantiations'
  ) THEN
    ALTER PUBLICATION powersync
      DROP TABLE public.tasks_template_instantiations;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'powersync'
      AND schemaname = 'public'
      AND tablename = 'tasks_template_revisions'
  ) THEN
    ALTER PUBLICATION powersync
      DROP TABLE public.tasks_template_revisions;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'powersync'
      AND schemaname = 'public'
      AND tablename = 'tasks_templates'
  ) THEN
    ALTER PUBLICATION powersync DROP TABLE public.tasks_templates;
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.tasks_capture_template(
  uuid, text, uuid, text, date, uuid, text, text
) CASCADE;
DROP FUNCTION IF EXISTS public.tasks_instantiate_template(
  uuid, bigint, date, uuid, text, text, uuid
) CASCADE;
DROP FUNCTION IF EXISTS public.tasks_archive_template(
  uuid, bigint, uuid, text, text
) CASCADE;
DROP FUNCTION IF EXISTS public.tasks_commit_recurrence_prototype(
  uuid, bigint, uuid, uuid, uuid, jsonb, text, text
) CASCADE;
DROP FUNCTION IF EXISTS tasks_private.capture_template_source(
  uuid, text, uuid, date
) CASCADE;
DROP FUNCTION IF EXISTS tasks_private.template_snapshot_from_todo(
  uuid, uuid, date
) CASCADE;
DROP FUNCTION IF EXISTS tasks_private.resolve_template_planning(
  text, text, integer, integer, date, date, boolean
) CASCADE;
DROP FUNCTION IF EXISTS tasks_private.guard_template_provenance() CASCADE;
DROP FUNCTION IF EXISTS tasks_private.prepare_template_update() CASCADE;
DROP FUNCTION IF EXISTS tasks_private.reject_template_immutable_write() CASCADE;

-- Schema 14 remains the sole current export and replacement boundary. Legacy
-- envelopes are still accepted through tasks_restore_export_current, but the
-- schema-13 entry points cannot remain callable after their Template tables
-- have been removed.
DROP FUNCTION IF EXISTS public.tasks_replace_restore_v13(
  jsonb, text, uuid, text
);
DROP FUNCTION IF EXISTS public.tasks_prepare_replace_restore_v13(jsonb);
DROP FUNCTION IF EXISTS public.tasks_restore_export_v13(jsonb, boolean);
DROP FUNCTION IF EXISTS public.tasks_create_export_v13();
DROP FUNCTION IF EXISTS tasks_private.export_v13_collection(text, uuid);

DROP TABLE IF EXISTS tasks_private.template_contexts;
DROP TABLE public.tasks_template_instantiations CASCADE;
DROP TABLE public.tasks_template_revisions CASCADE;
DROP TABLE public.tasks_templates CASCADE;

DO $$
DECLARE
  _published_count integer;
  _unexpected text[];
  _expected constant text[] := ARRAY[
    'tasks_areas', 'tasks_checklist_items', 'tasks_delivery_targets',
    'tasks_hierarchy_history_events', 'tasks_hierarchy_operations',
    'tasks_history_events',
    'tasks_recurrence_definitions', 'tasks_recurrence_evaluations',
    'tasks_recurrence_occurrences', 'tasks_recurrence_revisions',
    'tasks_recurrence_status_events', 'tasks_reminder_claims',
    'tasks_reminder_deliveries', 'tasks_reminder_occurrences',
    'tasks_reminders', 'tasks_todos', 'tasks_user_settings'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'powersync'
  ) THEN
    RETURN;
  END IF;
  SELECT count(*), array_agg(tablename ORDER BY tablename)
  INTO _published_count, _unexpected
  FROM pg_publication_tables
  WHERE pubname = 'powersync'
    AND schemaname = 'public'
    AND tablename LIKE 'tasks_%';
  IF _published_count <> 17 OR _unexpected IS DISTINCT FROM _expected THEN
    RAISE EXCEPTION
      'PowerSync Tasks publication is not the exact 17-table contract: %',
      _unexpected USING ERRCODE = '23514';
  END IF;
END
$$;
