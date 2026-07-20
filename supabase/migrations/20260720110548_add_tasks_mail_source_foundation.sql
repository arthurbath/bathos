-- Structured Mail source identity and retirement lifecycle for personal tasks.

CREATE TABLE public.tasks_mail_sources (
  task_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_identifier text NOT NULL,
  mailbox_identifier text NOT NULL,
  message_identifier text NOT NULL,
  deep_link text NOT NULL,
  retirement_destination_identifier text NOT NULL,
  lifecycle text NOT NULL DEFAULT 'retained',
  retirement_attempted_at timestamptz,
  retired_at timestamptz,
  last_error_code text,
  revision bigint NOT NULL DEFAULT 1,
  client_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_mail_sources_task_owner_fkey
    FOREIGN KEY (task_id, owner_id)
    REFERENCES public.tasks_todos(id, owner_id)
    ON DELETE CASCADE,
  CONSTRAINT tasks_mail_sources_account_identifier_valid CHECK (
    btrim(account_identifier) <> '' AND char_length(account_identifier) <= 500
  ),
  CONSTRAINT tasks_mail_sources_mailbox_identifier_valid CHECK (
    btrim(mailbox_identifier) <> '' AND char_length(mailbox_identifier) <= 1000
  ),
  CONSTRAINT tasks_mail_sources_message_identifier_valid CHECK (
    btrim(message_identifier) <> '' AND char_length(message_identifier) <= 2000
  ),
  CONSTRAINT tasks_mail_sources_deep_link_valid CHECK (
    btrim(deep_link) <> ''
    AND char_length(deep_link) <= 8000
    AND deep_link LIKE 'message://%'
  ),
  CONSTRAINT tasks_mail_sources_retirement_destination_valid CHECK (
    btrim(retirement_destination_identifier) <> ''
    AND char_length(retirement_destination_identifier) <= 1000
  ),
  CONSTRAINT tasks_mail_sources_lifecycle_valid CHECK (
    lifecycle IN ('retained', 'retirement_pending', 'retirement_failed', 'retired')
  ),
  CONSTRAINT tasks_mail_sources_lifecycle_state_valid CHECK (
    (
      lifecycle = 'retained'
      AND retired_at IS NULL
      AND last_error_code IS NULL
    ) OR (
      lifecycle = 'retirement_pending'
      AND retirement_attempted_at IS NOT NULL
      AND retired_at IS NULL
      AND last_error_code IS NULL
    ) OR (
      lifecycle = 'retirement_failed'
      AND retirement_attempted_at IS NOT NULL
      AND retired_at IS NULL
      AND NULLIF(btrim(last_error_code), '') IS NOT NULL
    ) OR (
      lifecycle = 'retired'
      AND retirement_attempted_at IS NOT NULL
      AND retired_at IS NOT NULL
      AND last_error_code IS NULL
    )
  ),
  CONSTRAINT tasks_mail_sources_error_code_valid CHECK (
    last_error_code IS NULL OR char_length(last_error_code) <= 200
  ),
  CONSTRAINT tasks_mail_sources_revision_valid CHECK (revision > 0)
);

ALTER TABLE public.tasks_mail_sources REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_mail_sources ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX tasks_mail_sources_owner_message_key
ON public.tasks_mail_sources (owner_id, account_identifier, message_identifier);

CREATE UNIQUE INDEX tasks_mail_sources_owner_client_mutation_key
ON public.tasks_mail_sources (owner_id, client_mutation_id);

CREATE INDEX tasks_mail_sources_owner_lifecycle_idx
ON public.tasks_mail_sources (owner_id, lifecycle, updated_at, task_id);

CREATE POLICY tasks_mail_sources_select_own
ON public.tasks_mail_sources
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY tasks_mail_sources_insert_own
ON public.tasks_mail_sources
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY tasks_mail_sources_update_own
ON public.tasks_mail_sources
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = owner_id)
WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY tasks_mail_sources_delete_own
ON public.tasks_mail_sources
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = owner_id);

REVOKE ALL ON TABLE public.tasks_mail_sources FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks_mail_sources TO authenticated;
GRANT ALL ON TABLE public.tasks_mail_sources TO service_role;

CREATE OR REPLACE FUNCTION public.tasks_prepare_mail_source_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.task_id IS DISTINCT FROM OLD.task_id THEN
    RAISE EXCEPTION 'Mail source task identifier is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Mail source owner is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Mail source creation time is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'Mail source revision must increment by exactly one' USING ERRCODE = '23514';
  END IF;
  IF NEW.client_mutation_id = OLD.client_mutation_id THEN
    RAISE EXCEPTION 'Mail source mutation identifier must change' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_prepare_mail_source_update()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_mail_sources_prepare_update
BEFORE UPDATE ON public.tasks_mail_sources
FOR EACH ROW
EXECUTE FUNCTION public.tasks_prepare_mail_source_update();

CREATE OR REPLACE FUNCTION tasks_private.validate_mail_source_pair(
  _task_id uuid,
  _owner_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _task public.tasks_todos;
  _source public.tasks_mail_sources;
BEGIN
  SELECT task.* INTO _task
  FROM public.tasks_todos AS task
  WHERE task.id = _task_id AND task.owner_id = _owner_id;

  SELECT source.* INTO _source
  FROM public.tasks_mail_sources AS source
  WHERE source.task_id = _task_id AND source.owner_id = _owner_id;

  IF _task.id IS NULL THEN
    IF _source.task_id IS NULL THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Mail task and source records must exist together' USING ERRCODE = '23514';
  END IF;
  IF _task.source_kind IS DISTINCT FROM 'mail_message' THEN
    IF _source.task_id IS NULL THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Only Mail-sourced tasks may own a Mail source record' USING ERRCODE = '23514';
  END IF;
  IF _source.task_id IS NULL THEN
    RAISE EXCEPTION 'Mail task and source records must exist together' USING ERRCODE = '23514';
  END IF;
  IF _task.source_external_id IS DISTINCT FROM _source.message_identifier
    OR _task.source_url IS DISTINCT FROM _source.deep_link THEN
    RAISE EXCEPTION 'Mail task and source identity must match' USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_mail_source_pair(uuid, uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.enforce_todo_mail_source_pair()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) IS DISTINCT FROM COALESCE(NEW.owner_id, OLD.owner_id) THEN
    RAISE EXCEPTION 'Mail source task owner does not match the authenticated user'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_mail_source_pair(
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.owner_id, OLD.owner_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.enforce_todo_mail_source_pair()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.enforce_mail_source_todo_pair()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) IS DISTINCT FROM COALESCE(NEW.owner_id, OLD.owner_id) THEN
    RAISE EXCEPTION 'Mail source owner does not match the authenticated user'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_mail_source_pair(
    COALESCE(NEW.task_id, OLD.task_id),
    COALESCE(NEW.owner_id, OLD.owner_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.enforce_mail_source_todo_pair()
FROM PUBLIC, anon, authenticated;

CREATE CONSTRAINT TRIGGER tasks_todos_mail_source_pair
AFTER INSERT OR UPDATE OF source_kind, source_url, source_external_id OR DELETE
ON public.tasks_todos
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION tasks_private.enforce_todo_mail_source_pair();

CREATE CONSTRAINT TRIGGER tasks_mail_sources_todo_pair
AFTER INSERT OR UPDATE OR DELETE
ON public.tasks_mail_sources
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION tasks_private.enforce_mail_source_todo_pair();

CREATE OR REPLACE FUNCTION tasks_private.export_v5_as_v4(_envelope jsonb)
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
    'tasks_hierarchy_history_events', 'tasks_user_settings'
  ];
  _data jsonb := (_envelope -> 'data') - 'tasks_mail_sources';
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
    'schema_version', 4,
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

REVOKE ALL ON FUNCTION tasks_private.export_v5_as_v4(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v5(_envelope jsonb)
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
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources'
  ];
  _sources jsonb;
BEGIN
  IF jsonb_typeof(_envelope) IS DISTINCT FROM 'object'
    OR _envelope ->> 'format' IS DISTINCT FROM 'garden.bath.tasks.export'
    OR COALESCE(_envelope ->> 'schema_version', '') !~ '^[0-9]+$'
    OR (_envelope ->> 'schema_version')::integer <> 5
    OR jsonb_typeof(_envelope -> 'manifest') IS DISTINCT FROM 'object'
    OR jsonb_typeof(_envelope -> 'data') IS DISTINCT FROM 'object'
    OR _envelope #> '{manifest,collections}' IS DISTINCT FROM to_jsonb(_collections)
    OR _envelope #>> '{manifest,checksums,algorithm}' IS DISTINCT FROM 'sha256' THEN
    RAISE EXCEPTION 'Invalid task export v5 envelope' USING ERRCODE = '22023';
  END IF;

  _sources := _envelope #> '{data,tasks_mail_sources}';
  IF jsonb_typeof(_sources) IS DISTINCT FROM 'array'
    OR COALESCE(
      _envelope #>> '{manifest,counts,tasks_mail_sources}',
      ''
    ) !~ '^[0-9]+$'
    OR (_envelope #>> '{manifest,counts,tasks_mail_sources}')::integer
      <> jsonb_array_length(_sources)
    OR _envelope #>> '{manifest,checksums,tasks_mail_sources}'
      IS DISTINCT FROM tasks_private.export_checksum(_sources)
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(_sources) AS source(value)
      WHERE jsonb_typeof(source.value) IS DISTINCT FROM 'object'
        OR NOT (source.value ? 'task_id')
        OR source.value ? 'owner_id'
    ) THEN
    RAISE EXCEPTION 'Task export v5 Mail sources are invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM tasks_private.validate_export_v4(
    tasks_private.export_v5_as_v4(_envelope)
  );

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}') AS task(value)
    WHERE task.value ->> 'source_kind' = 'mail_message'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(_sources) AS source(value)
        WHERE source.value ->> 'task_id' = task.value ->> 'id'
          AND source.value ->> 'message_identifier'
            = task.value ->> 'source_external_id'
          AND source.value ->> 'deep_link' = task.value ->> 'source_url'
      )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_sources) AS source(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}') AS task(value)
      WHERE task.value ->> 'id' = source.value ->> 'task_id'
        AND task.value ->> 'source_kind' = 'mail_message'
        AND task.value ->> 'source_external_id'
          = source.value ->> 'message_identifier'
        AND task.value ->> 'source_url' = source.value ->> 'deep_link'
    )
  ) THEN
    RAISE EXCEPTION 'Task export v5 contains an invalid Mail source pair'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v5(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.classify_restore_v5_mail_sources(
  _owner_id uuid,
  _records jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _record jsonb;
  _existing jsonb;
  _task_id uuid;
  _insert_ids jsonb := '[]'::jsonb;
  _match_ids jsonb := '[]'::jsonb;
  _conflict_ids jsonb := '[]'::jsonb;
BEGIN
  FOR _record IN SELECT value FROM jsonb_array_elements(_records) LOOP
    _task_id := (_record ->> 'task_id')::uuid;
    SELECT to_jsonb(source) INTO _existing
    FROM public.tasks_mail_sources AS source
    WHERE source.task_id = _task_id
      OR (
        source.owner_id = _owner_id
        AND source.account_identifier = _record ->> 'account_identifier'
        AND source.message_identifier = _record ->> 'message_identifier'
      )
      OR (
        source.owner_id = _owner_id
        AND source.client_mutation_id = (_record ->> 'client_mutation_id')::uuid
      )
    ORDER BY (source.task_id = _task_id) DESC
    LIMIT 1;

    IF _existing IS NULL THEN
      _insert_ids := _insert_ids || jsonb_build_array(_task_id);
    ELSIF _existing ->> 'task_id' = _task_id::text
      AND _existing ->> 'owner_id' = _owner_id::text
      AND _existing - 'owner_id' = _record THEN
      _match_ids := _match_ids || jsonb_build_array(_task_id);
    ELSE
      _conflict_ids := _conflict_ids || jsonb_build_array(_task_id);
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

REVOKE ALL ON FUNCTION tasks_private.classify_restore_v5_mail_sources(uuid, jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v5()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _base jsonb;
  _sources jsonb;
  _data jsonb;
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources'
  ];
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
  _collection text;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to export task data'
      USING ERRCODE = '42501';
  END IF;
  _base := public.tasks_create_export_v4();
  SELECT COALESCE(
    jsonb_agg(to_jsonb(source) - 'owner_id' ORDER BY source.task_id),
    '[]'::jsonb
  ) INTO _sources
  FROM public.tasks_mail_sources AS source
  WHERE source.owner_id = _owner_id;
  _data := (_base -> 'data') || jsonb_build_object('tasks_mail_sources', _sources);

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

REVOKE ALL ON FUNCTION public.tasks_create_export_v5() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v5() TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v5(
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
  _report jsonb;
  _source_report jsonb;
  _record jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v5(_envelope);
  _report := public.tasks_restore_export_v4(
    tasks_private.export_v5_as_v4(_envelope),
    _dry_run
  );
  _source_report := tasks_private.classify_restore_v5_mail_sources(
    _owner_id,
    _envelope #> '{data,tasks_mail_sources}'
  );
  _report := (_report || jsonb_build_object(
    'schema_version', 5,
    'tasks_mail_sources', _source_report
  ));

  IF NOT _dry_run THEN
    FOR _record IN
      SELECT value
      FROM jsonb_array_elements(_envelope #> '{data,tasks_mail_sources}')
    LOOP
      IF _source_report -> 'insert_ids' @> jsonb_build_array(_record -> 'task_id') THEN
        INSERT INTO public.tasks_mail_sources
        SELECT (
          jsonb_populate_record(
            NULL::public.tasks_mail_sources,
            _record || jsonb_build_object('owner_id', _owner_id)
          )
        ).*;
      END IF;
    END LOOP;
  END IF;
  RETURN _report;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v5(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v5(jsonb, boolean)
TO authenticated;
