ALTER TABLE public.tasks_todos
  ADD COLUMN recurrence_superseded_at timestamptz,
  ADD CONSTRAINT tasks_todos_recurrence_superseded_valid CHECK (
    recurrence_superseded_at IS NULL
    OR (
      recurrence_definition_id IS NOT NULL
      AND recurrence_occurrence_id IS NOT NULL
    )
  );

CREATE INDEX tasks_todos_owner_active_recurrence_projection_idx
ON public.tasks_todos (
  owner_id,
  recurrence_definition_id,
  recurrence_superseded_at,
  start_date
)
WHERE recurrence_definition_id IS NOT NULL
  AND lifecycle = 'open'
  AND disposition = 'present';

CREATE OR REPLACE FUNCTION public.tasks_edit_recurrence(
  _recurrence_id uuid,
  _expected_record_revision bigint,
  _name text,
  _template_id uuid,
  _template_revision bigint,
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
  _saved jsonb;
  _definition public.tasks_recurrence_definitions;
  _revision public.tasks_recurrence_revisions;
  _outcome text;
  _planning_date date;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to edit recurrence'
      USING ERRCODE = '42501';
  END IF;
  IF _recurrence_id IS NULL OR _mutation_id IS NULL
    OR jsonb_typeof(COALESCE(_rule_config, '{}'::jsonb)) <> 'object'
    OR _end_mode NOT IN ('never', 'after', 'on_date')
    OR (_end_mode = 'after' AND COALESCE(_end_after_count, 0) < 1)
    OR (_end_mode = 'on_date' AND _end_on_date IS NULL)
    OR COALESCE(_deadline_offset_days, 0) < 0 THEN
    RAISE EXCEPTION 'Recurrence input is invalid' USING ERRCODE = '22023';
  END IF;

  _saved := public.tasks_save_recurrence(
    _recurrence_id,
    _expected_record_revision,
    _name,
    _template_id,
    _template_revision,
    _rule_mode,
    _frequency,
    _interval_count,
    _start_date,
    _planning_timezone,
    _missed_policy,
    _catch_up_limit,
    _target_area_id,
    _mutation_id,
    _mutation_channel,
    _actor_type
  );
  _outcome := _saved ->> 'outcome';
  IF _outcome = 'conflict' THEN
    RETURN _saved;
  END IF;

  _definition := jsonb_populate_record(
    NULL::public.tasks_recurrence_definitions,
    (_saved -> 'definition') || jsonb_build_object('owner_id', _owner_id)
  );

  INSERT INTO tasks_private.recurrence_contexts (
    backend_pid,
    transaction_id,
    owner_id
  ) VALUES (
    pg_backend_pid(),
    txid_current(),
    _owner_id
  )
  ON CONFLICT DO NOTHING;

  IF _outcome = 'accepted' THEN
    UPDATE public.tasks_recurrence_revisions
    SET rule_config = COALESCE(_rule_config, '{}'::jsonb),
        end_mode = _end_mode,
        end_after_count = CASE
          WHEN _end_mode = 'after' THEN _end_after_count
          ELSE NULL
        END,
        end_on_date = CASE
          WHEN _end_mode = 'on_date' THEN _end_on_date
          ELSE NULL
        END,
        reminder_local_time = _reminder_local_time,
        deadline_offset_days = _deadline_offset_days
    WHERE owner_id = _owner_id
      AND recurrence_id = _definition.id
      AND revision = _definition.current_revision
    RETURNING * INTO _revision;

    IF _rule_mode = 'calendar' THEN
      _planning_date := (
        clock_timestamp() AT TIME ZONE _planning_timezone
      )::date;
      UPDATE public.tasks_todos AS task
      SET recurrence_superseded_at = clock_timestamp(),
          revision = task.revision + 1,
          client_mutation_id = gen_random_uuid(),
          last_mutation_channel = _mutation_channel,
          last_actor_type = 'system',
          updated_at = clock_timestamp()
      WHERE task.owner_id = _owner_id
        AND task.recurrence_definition_id = _definition.id
        AND task.recurrence_revision < _definition.current_revision
        AND task.recurrence_superseded_at IS NULL
        AND task.lifecycle = 'open'
        AND task.disposition = 'present'
        AND EXISTS (
          SELECT 1
          FROM public.tasks_recurrence_occurrences AS occurrence
          WHERE occurrence.id = task.recurrence_occurrence_id
            AND occurrence.owner_id = task.owner_id
            AND occurrence.scheduled_date > _planning_date
        );
      UPDATE public.tasks_recurrence_definitions
      SET evaluated_through_date = _planning_date,
          record_revision = record_revision + 1,
          client_mutation_id = gen_random_uuid(),
          last_mutation_channel = _mutation_channel,
          last_actor_type = 'system'
      WHERE id = _definition.id
        AND owner_id = _owner_id
      RETURNING * INTO _definition;
    END IF;
  ELSE
    SELECT revision.* INTO _revision
    FROM public.tasks_recurrence_revisions AS revision
    WHERE revision.owner_id = _owner_id
      AND revision.recurrence_id = _definition.id
      AND revision.revision = _definition.current_revision;
    IF _revision.rule_config IS DISTINCT FROM COALESCE(_rule_config, '{}'::jsonb)
      OR _revision.end_mode IS DISTINCT FROM _end_mode
      OR _revision.end_after_count IS DISTINCT FROM (CASE
        WHEN _end_mode = 'after' THEN _end_after_count
        ELSE NULL
      END)
      OR _revision.end_on_date IS DISTINCT FROM (CASE
        WHEN _end_mode = 'on_date' THEN _end_on_date
        ELSE NULL
      END)
      OR _revision.reminder_local_time IS DISTINCT FROM _reminder_local_time
      OR _revision.deadline_offset_days IS DISTINCT FROM _deadline_offset_days THEN
      RAISE EXCEPTION
        'The mutation identifier belongs to a different recurrence revision'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  DELETE FROM tasks_private.recurrence_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current()
    AND owner_id = _owner_id;

  IF _revision.id IS NULL THEN
    RAISE EXCEPTION 'The recurrence revision could not be saved'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object(
    'outcome',
    _outcome,
    'definition',
    to_jsonb(_definition) - 'owner_id',
    'revision',
    to_jsonb(_revision) - 'owner_id'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_edit_recurrence(
  uuid, bigint, text, uuid, bigint, text, text, integer, date, text,
  text, integer, uuid, jsonb, text, integer, date, time, integer, uuid,
  text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_edit_recurrence(
  uuid, bigint, text, uuid, bigint, text, text, integer, date, text,
  text, integer, uuid, jsonb, text, integer, date, time, integer, uuid,
  text, text
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
  _scheduled_date date;
  _occurrence_count integer;
  _entry_channel text := COALESCE(
    NEW.last_mutation_channel,
    'web'
  );
  _actor_type text := COALESCE(NEW.last_actor_type, 'user');
BEGIN
  IF OLD.lifecycle <> 'open'
    OR NEW.lifecycle <> 'completed'
    OR NEW.recurrence_occurrence_id IS NULL THEN
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

  SELECT count(*) INTO _occurrence_count
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = NEW.owner_id
    AND occurrence.recurrence_id = _definition.id;
  IF _revision.end_mode = 'after'
    AND _occurrence_count >= _revision.end_after_count THEN
    RETURN NEW;
  END IF;

  _scheduled_date := CASE
    WHEN NEW.recurrence_revision < _revision.revision
      THEN _revision.start_date
    ELSE tasks_private.add_recurrence_interval(
      (
        NEW.completed_at
        AT TIME ZONE _revision.planning_timezone
      )::date,
      _revision.frequency,
      _revision.interval_count,
      1
    )
  END;
  IF _revision.end_mode = 'on_date'
    AND _scheduled_date > _revision.end_on_date THEN
    RETURN NEW;
  END IF;

  PERFORM tasks_private.instantiate_recurrence_occurrence(
    NEW.owner_id,
    _definition,
    _revision,
    _scheduled_date,
    'after:' || NEW.recurrence_occurrence_id::text,
    NEW.recurrence_occurrence_id,
    _entry_channel,
    _actor_type
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.advance_after_completion_recurrence()
FROM PUBLIC, anon, authenticated;
