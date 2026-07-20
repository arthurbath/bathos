-- Portable Tasks schema v4: complete hierarchy, operation receipts, and history.

CREATE OR REPLACE FUNCTION tasks_private.in_restore_context(_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tasks_private.restore_contexts AS context
    WHERE context.backend_pid = pg_backend_pid()
      AND context.transaction_id = txid_current()
      AND context.owner_id = _owner_id
  );
$$;

REVOKE ALL ON FUNCTION tasks_private.in_restore_context(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION tasks_private.in_restore_context(uuid)
TO authenticated, service_role;

-- Restored hierarchy rows already include their authoritative history, and
-- restored operation receipts must never replay the historical operation.
DROP TRIGGER tasks_areas_append_history ON public.tasks_areas;
CREATE TRIGGER tasks_areas_append_history
AFTER INSERT OR UPDATE ON public.tasks_areas
FOR EACH ROW
WHEN (NOT tasks_private.in_restore_context(NEW.owner_id))
EXECUTE FUNCTION tasks_private.append_hierarchy_history();

DROP TRIGGER tasks_projects_append_history ON public.tasks_projects;
CREATE TRIGGER tasks_projects_append_history
AFTER INSERT OR UPDATE ON public.tasks_projects
FOR EACH ROW
WHEN (NOT tasks_private.in_restore_context(NEW.owner_id))
EXECUTE FUNCTION tasks_private.append_hierarchy_history();

DROP TRIGGER tasks_headings_append_history ON public.tasks_headings;
CREATE TRIGGER tasks_headings_append_history
AFTER INSERT OR UPDATE ON public.tasks_headings
FOR EACH ROW
WHEN (NOT tasks_private.in_restore_context(NEW.owner_id))
EXECUTE FUNCTION tasks_private.append_hierarchy_history();

DROP TRIGGER tasks_checklist_items_append_history ON public.tasks_checklist_items;
CREATE TRIGGER tasks_checklist_items_append_history
AFTER INSERT OR UPDATE ON public.tasks_checklist_items
FOR EACH ROW
WHEN (NOT tasks_private.in_restore_context(NEW.owner_id))
EXECUTE FUNCTION tasks_private.append_hierarchy_history();

DROP TRIGGER tasks_hierarchy_operations_apply ON public.tasks_hierarchy_operations;
CREATE TRIGGER tasks_hierarchy_operations_apply
AFTER INSERT ON public.tasks_hierarchy_operations
FOR EACH ROW
WHEN (NOT tasks_private.in_restore_context(NEW.owner_id))
EXECUTE FUNCTION tasks_private.apply_hierarchy_operation();

-- Schema v3 predates deletion roots. Keep its snapshot comparison stable even
-- though the current history trigger now records that v4-only field.
CREATE OR REPLACE FUNCTION tasks_private.normalize_todo_snapshot_v3(_snapshot jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN _snapshot IS NULL OR _snapshot = 'null'::jsonb THEN NULL
    ELSE (_snapshot - 'deletion_root_id') || jsonb_build_object(
      'today_section', COALESCE(_snapshot ->> 'today_section', 'daytime'),
      'area_id', _snapshot -> 'area_id',
      'project_id', _snapshot -> 'project_id',
      'heading_id', _snapshot -> 'heading_id',
      'hierarchy_order_key', _snapshot -> 'hierarchy_order_key'
    )
  END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_todo_snapshot_v3(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.normalize_history_event_v4(_event jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_set(
    jsonb_set(
      _event,
      '{before_state}',
      COALESCE(
        tasks_private.normalize_todo_snapshot_v4(_event -> 'before_state'),
        'null'::jsonb
      )
    ),
    '{after_state}',
    tasks_private.normalize_todo_snapshot_v4(_event -> 'after_state')
  );
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_history_event_v4(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v4(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _collection text;
  _collections constant text[] := ARRAY[
    'tasks_areas',
    'tasks_projects',
    'tasks_headings',
    'tasks_todos',
    'tasks_checklist_items',
    'tasks_history_events',
    'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events',
    'tasks_user_settings'
  ];
  _records jsonb;
BEGIN
  IF jsonb_typeof(_envelope) IS DISTINCT FROM 'object'
    OR _envelope ->> 'format' IS DISTINCT FROM 'garden.bath.tasks.export'
    OR COALESCE(_envelope ->> 'schema_version', '') !~ '^[0-9]+$'
    OR (_envelope ->> 'schema_version')::integer <> 4
    OR jsonb_typeof(_envelope -> 'manifest') IS DISTINCT FROM 'object'
    OR jsonb_typeof(_envelope -> 'data') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid task export v4 envelope' USING ERRCODE = '22023';
  END IF;

  IF _envelope #> '{manifest,collections}' IS DISTINCT FROM to_jsonb(_collections)
    OR _envelope #>> '{manifest,checksums,algorithm}' IS DISTINCT FROM 'sha256' THEN
    RAISE EXCEPTION 'Task export v4 collections are invalid' USING ERRCODE = '22023';
  END IF;

  FOREACH _collection IN ARRAY _collections LOOP
    _records := _envelope #> ARRAY['data', _collection];
    IF jsonb_typeof(_records) IS DISTINCT FROM 'array'
      OR COALESCE(_envelope #>> ARRAY['manifest', 'counts', _collection], '') !~ '^[0-9]+$'
      OR (_envelope #>> ARRAY['manifest', 'counts', _collection])::integer
        <> jsonb_array_length(_records)
      OR _envelope #>> ARRAY['manifest', 'checksums', _collection]
        IS DISTINCT FROM tasks_private.export_checksum(_records)
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(_records) AS record(value)
        WHERE jsonb_typeof(record.value) IS DISTINCT FROM 'object'
          OR NOT (record.value ? 'id')
          OR record.value ? 'owner_id'
      ) THEN
      RAISE EXCEPTION 'Task export v4 collection % is invalid', _collection
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF jsonb_array_length(_envelope #> '{data,tasks_user_settings}') > 1 THEN
    RAISE EXCEPTION 'Task export v4 contains multiple planning settings'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_envelope #> '{data,tasks_projects}') AS project(value)
    WHERE project.value ->> 'area_id' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_areas}') AS area(value)
        WHERE area.value ->> 'id' = project.value ->> 'area_id'
      )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_envelope #> '{data,tasks_headings}') AS heading(value)
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_projects}') AS project(value)
      WHERE project.value ->> 'id' = heading.value ->> 'project_id'
    )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}') AS task(value)
    WHERE (task.value ->> 'area_id' IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_areas}') AS area(value)
      WHERE area.value ->> 'id' = task.value ->> 'area_id'
    )) OR (task.value ->> 'project_id' IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_projects}') AS project(value)
      WHERE project.value ->> 'id' = task.value ->> 'project_id'
    )) OR (task.value ->> 'heading_id' IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_headings}') AS heading(value)
      WHERE heading.value ->> 'id' = task.value ->> 'heading_id'
        AND heading.value ->> 'project_id' = task.value ->> 'project_id'
    ))
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_envelope #> '{data,tasks_checklist_items}') AS item(value)
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}') AS task(value)
      WHERE task.value ->> 'id' = item.value ->> 'task_id'
    )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_envelope #> '{data,tasks_history_events}') AS event(value)
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}') AS task(value)
      WHERE task.value ->> 'id' = event.value ->> 'task_id'
    )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      _envelope #> '{data,tasks_hierarchy_history_events}'
    ) AS event(value)
    WHERE (event.value ->> 'operation_id' IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        _envelope #> '{data,tasks_hierarchy_operations}'
      ) AS operation(value)
      WHERE operation.value ->> 'id' = event.value ->> 'operation_id'
    )) OR CASE event.value ->> 'entity_type'
      WHEN 'area' THEN NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_areas}') AS area(value)
        WHERE area.value ->> 'id' = event.value ->> 'entity_id'
      )
      WHEN 'project' THEN NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_projects}') AS project(value)
        WHERE project.value ->> 'id' = event.value ->> 'entity_id'
      )
      WHEN 'heading' THEN NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_headings}') AS heading(value)
        WHERE heading.value ->> 'id' = event.value ->> 'entity_id'
      )
      WHEN 'checklist_item' THEN NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(
          _envelope #> '{data,tasks_checklist_items}'
        ) AS item(value)
        WHERE item.value ->> 'id' = event.value ->> 'entity_id'
      )
      ELSE true
    END
  ) THEN
    RAISE EXCEPTION 'Task export v4 contains an absent hierarchy parent'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v4(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.classify_restore_v4_collection(
  _owner_id uuid,
  _table regclass,
  _records jsonb,
  _has_mutation_id boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _record jsonb;
  _existing jsonb;
  _id uuid;
  _mutation_id uuid;
  _insert_ids jsonb := '[]'::jsonb;
  _match_ids jsonb := '[]'::jsonb;
  _conflict_ids jsonb := '[]'::jsonb;
BEGIN
  FOR _record IN SELECT value FROM jsonb_array_elements(_records) LOOP
    _id := (_record ->> 'id')::uuid;
    _mutation_id := CASE WHEN _has_mutation_id
      THEN (_record ->> 'client_mutation_id')::uuid ELSE NULL END;
    _existing := NULL;

    IF _has_mutation_id THEN
      EXECUTE format(
        'SELECT to_jsonb(existing) FROM %s AS existing '
        'WHERE existing.id = $1 OR (existing.owner_id = $2 AND existing.client_mutation_id = $3) '
        'ORDER BY (existing.id = $1) DESC LIMIT 1',
        _table
      ) INTO _existing USING _id, _owner_id, _mutation_id;
    ELSE
      EXECUTE format(
        'SELECT to_jsonb(existing) FROM %s AS existing WHERE existing.id = $1 LIMIT 1',
        _table
      ) INTO _existing USING _id;
    END IF;

    IF _existing IS NULL THEN
      _insert_ids := _insert_ids || jsonb_build_array(_id);
    ELSE
      IF _table = 'public.tasks_history_events'::regclass THEN
        _existing := tasks_private.normalize_history_event_v4(_existing - 'owner_id')
          || jsonb_build_object('owner_id', _existing -> 'owner_id');
      END IF;
      IF _existing ->> 'id' = _id::text
        AND _existing ->> 'owner_id' = _owner_id::text
        AND _existing - 'owner_id' = _record - 'owner_id' THEN
        _match_ids := _match_ids || jsonb_build_array(_id);
      ELSE
        _conflict_ids := _conflict_ids || jsonb_build_array(_id);
      END IF;
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

REVOKE ALL ON FUNCTION tasks_private.classify_restore_v4_collection(uuid, regclass, jsonb, boolean)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.insert_restore_v4_collection(
  _owner_id uuid,
  _table regclass,
  _records jsonb,
  _report jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _record jsonb;
BEGIN
  FOR _record IN SELECT value FROM jsonb_array_elements(_records) LOOP
    IF _report -> 'insert_ids' @> jsonb_build_array(_record -> 'id') THEN
      EXECUTE format(
        'INSERT INTO %s SELECT (jsonb_populate_record('
        'NULL::%s, ($1 - ''owner_id'') || jsonb_build_object(''owner_id'', $2))).*',
        _table,
        _table
      ) USING _record, _owner_id;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.insert_restore_v4_collection(uuid, regclass, jsonb, jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v4()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _areas jsonb;
  _projects jsonb;
  _headings jsonb;
  _tasks jsonb;
  _items jsonb;
  _history jsonb;
  _operations jsonb;
  _hierarchy_history jsonb;
  _settings jsonb;
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings'
  ];
  _data jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
  _collection text;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to export task data'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(row) - 'owner_id' ORDER BY row.id), '[]'::jsonb)
    INTO _areas FROM public.tasks_areas AS row WHERE row.owner_id = _owner_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(row) - 'owner_id' ORDER BY row.id), '[]'::jsonb)
    INTO _projects FROM public.tasks_projects AS row WHERE row.owner_id = _owner_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(row) - 'owner_id' ORDER BY row.id), '[]'::jsonb)
    INTO _headings FROM public.tasks_headings AS row WHERE row.owner_id = _owner_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(row) - 'owner_id' ORDER BY row.id), '[]'::jsonb)
    INTO _tasks FROM public.tasks_todos AS row WHERE row.owner_id = _owner_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(row) - 'owner_id' ORDER BY row.id), '[]'::jsonb)
    INTO _items FROM public.tasks_checklist_items AS row WHERE row.owner_id = _owner_id;
  SELECT COALESCE(jsonb_agg(
    tasks_private.normalize_history_event_v4(to_jsonb(row) - 'owner_id')
    ORDER BY row.occurred_at, row.id
  ), '[]'::jsonb)
    INTO _history FROM public.tasks_history_events AS row WHERE row.owner_id = _owner_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(row) - 'owner_id' ORDER BY row.requested_at, row.id), '[]'::jsonb)
    INTO _operations FROM public.tasks_hierarchy_operations AS row WHERE row.owner_id = _owner_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(row) - 'owner_id' ORDER BY row.occurred_at, row.id), '[]'::jsonb)
    INTO _hierarchy_history FROM public.tasks_hierarchy_history_events AS row
    WHERE row.owner_id = _owner_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(row) - 'owner_id' ORDER BY row.id), '[]'::jsonb)
    INTO _settings FROM public.tasks_user_settings AS row WHERE row.owner_id = _owner_id;

  _data := jsonb_build_object(
    'tasks_areas', _areas,
    'tasks_projects', _projects,
    'tasks_headings', _headings,
    'tasks_todos', _tasks,
    'tasks_checklist_items', _items,
    'tasks_history_events', _history,
    'tasks_hierarchy_operations', _operations,
    'tasks_hierarchy_history_events', _hierarchy_history,
    'tasks_user_settings', _settings
  );

  FOREACH _collection IN ARRAY _collections LOOP
    _counts := _counts || jsonb_build_object(_collection, jsonb_array_length(_data -> _collection));
    _checksums := _checksums || jsonb_build_object(
      _collection,
      tasks_private.export_checksum(_data -> _collection)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 4,
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

REVOKE ALL ON FUNCTION public.tasks_create_export_v4() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v4() TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v4(
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
  _report jsonb := jsonb_build_object('dry_run', _dry_run, 'schema_version', 4);
  _collection text;
  _table regclass;
  _collection_report jsonb;
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings'
  ];
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v4(_envelope);

  FOREACH _collection IN ARRAY _collections LOOP
    _table := ('public.' || _collection)::regclass;
    _collection_report := tasks_private.classify_restore_v4_collection(
      _owner_id,
      _table,
      _envelope #> ARRAY['data', _collection],
      _collection <> 'tasks_hierarchy_operations'
    );
    _report := _report || jsonb_build_object(_collection, _collection_report);
  END LOOP;

  IF NOT _dry_run THEN
    INSERT INTO tasks_private.restore_contexts (backend_pid, transaction_id, owner_id)
    VALUES (pg_backend_pid(), txid_current(), _owner_id);

    FOREACH _collection IN ARRAY _collections LOOP
      _table := ('public.' || _collection)::regclass;
      PERFORM tasks_private.insert_restore_v4_collection(
        _owner_id,
        _table,
        _envelope #> ARRAY['data', _collection],
        _report -> _collection
      );
    END LOOP;

    DELETE FROM tasks_private.restore_contexts
    WHERE backend_pid = pg_backend_pid() AND transaction_id = txid_current();
  END IF;

  RETURN _report;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v4(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v4(jsonb, boolean) TO authenticated;
