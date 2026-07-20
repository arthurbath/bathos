-- Revisioned task recurrence definitions, idempotent occurrence generation,
-- completion-driven advancement, and owner-scoped recurrence provenance.

CREATE TABLE public.tasks_recurrence_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_revision bigint NOT NULL DEFAULT 1,
  record_revision bigint NOT NULL DEFAULT 1,
  evaluated_through_date date,
  archived_at timestamptz,
  last_mutation_channel text NOT NULL DEFAULT 'web',
  last_actor_type text NOT NULL DEFAULT 'user',
  client_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_recurrence_definitions_id_owner_key UNIQUE (id, owner_id),
  CONSTRAINT tasks_recurrence_definitions_name_valid CHECK (
    btrim(name) <> '' AND char_length(name) <= 500
  ),
  CONSTRAINT tasks_recurrence_definitions_status_valid CHECK (
    status IN ('active', 'paused', 'archived')
  ),
  CONSTRAINT tasks_recurrence_definitions_archive_valid CHECK (
    (status = 'archived' AND archived_at IS NOT NULL)
    OR (status <> 'archived' AND archived_at IS NULL)
  ),
  CONSTRAINT tasks_recurrence_definitions_revisions_valid CHECK (
    current_revision > 0 AND record_revision > 0
  ),
  CONSTRAINT tasks_recurrence_definitions_channel_valid CHECK (
    last_mutation_channel IN (
      'web', 'raycast', 'mcp', 'mail_automation',
      'browser_capture', 'native', 'import'
    )
  ),
  CONSTRAINT tasks_recurrence_definitions_actor_valid CHECK (
    last_actor_type IN ('user', 'automation', 'system', 'import')
  )
);

CREATE TABLE public.tasks_recurrence_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurrence_id uuid NOT NULL,
  revision bigint NOT NULL,
  name text NOT NULL,
  template_id uuid NOT NULL,
  template_revision bigint NOT NULL,
  rule_mode text NOT NULL,
  frequency text NOT NULL,
  interval_count integer NOT NULL DEFAULT 1,
  start_date date NOT NULL,
  planning_timezone text NOT NULL,
  missed_policy text NOT NULL DEFAULT 'latest',
  catch_up_limit integer NOT NULL DEFAULT 50,
  target_area_id uuid,
  client_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_recurrence_revisions_definition_owner_fkey
    FOREIGN KEY (recurrence_id, owner_id)
    REFERENCES public.tasks_recurrence_definitions(id, owner_id) ON DELETE CASCADE,
  CONSTRAINT tasks_recurrence_revisions_template_owner_fkey
    FOREIGN KEY (template_id, template_revision, owner_id)
    REFERENCES public.tasks_template_revisions(template_id, revision, owner_id),
  CONSTRAINT tasks_recurrence_revisions_target_area_owner_fkey
    FOREIGN KEY (target_area_id, owner_id)
    REFERENCES public.tasks_areas(id, owner_id)
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT tasks_recurrence_revisions_definition_revision_key
    UNIQUE (recurrence_id, revision),
  CONSTRAINT tasks_recurrence_revisions_definition_revision_owner_key
    UNIQUE (recurrence_id, revision, owner_id),
  CONSTRAINT tasks_recurrence_revisions_revision_valid CHECK (revision > 0),
  CONSTRAINT tasks_recurrence_revisions_name_valid CHECK (
    btrim(name) <> '' AND char_length(name) <= 500
  ),
  CONSTRAINT tasks_recurrence_revisions_rule_mode_valid CHECK (
    rule_mode IN ('calendar', 'after_completion')
  ),
  CONSTRAINT tasks_recurrence_revisions_frequency_valid CHECK (
    frequency IN ('daily', 'weekly', 'monthly', 'yearly')
  ),
  CONSTRAINT tasks_recurrence_revisions_interval_valid CHECK (
    interval_count BETWEEN 1 AND 1000
  ),
  CONSTRAINT tasks_recurrence_revisions_missed_policy_valid CHECK (
    missed_policy IN ('skip', 'latest', 'all')
  ),
  CONSTRAINT tasks_recurrence_revisions_catch_up_limit_valid CHECK (
    catch_up_limit BETWEEN 1 AND 100
  )
);

CREATE TABLE public.tasks_recurrence_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurrence_id uuid NOT NULL,
  recurrence_revision bigint NOT NULL,
  logical_key text NOT NULL,
  scheduled_date date NOT NULL,
  predecessor_occurrence_id uuid,
  template_instantiation_id uuid NOT NULL,
  root_type text NOT NULL,
  root_id uuid NOT NULL,
  client_mutation_id uuid NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_recurrence_occurrences_id_owner_key UNIQUE (id, owner_id),
  CONSTRAINT tasks_recurrence_occurrences_definition_revision_owner_fkey
    FOREIGN KEY (recurrence_id, recurrence_revision, owner_id)
    REFERENCES public.tasks_recurrence_revisions(recurrence_id, revision, owner_id),
  CONSTRAINT tasks_recurrence_occurrences_predecessor_owner_fkey
    FOREIGN KEY (predecessor_occurrence_id, owner_id)
    REFERENCES public.tasks_recurrence_occurrences(id, owner_id),
  CONSTRAINT tasks_recurrence_occurrences_instantiation_owner_fkey
    FOREIGN KEY (template_instantiation_id, owner_id)
    REFERENCES public.tasks_template_instantiations(id, owner_id),
  CONSTRAINT tasks_recurrence_occurrences_logical_key_valid CHECK (
    btrim(logical_key) <> '' AND char_length(logical_key) <= 200
  ),
  CONSTRAINT tasks_recurrence_occurrences_root_type_valid CHECK (
    root_type IN ('todo', 'project')
  ),
  CONSTRAINT tasks_recurrence_occurrences_predecessor_valid CHECK (
    (logical_key LIKE 'after:%' AND predecessor_occurrence_id IS NOT NULL)
    OR (logical_key NOT LIKE 'after:%' AND predecessor_occurrence_id IS NULL)
  )
);

CREATE TABLE public.tasks_recurrence_evaluations (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurrence_id uuid NOT NULL,
  through_date date NOT NULL,
  result jsonb NOT NULL,
  client_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_recurrence_evaluations_definition_owner_fkey
    FOREIGN KEY (recurrence_id, owner_id)
    REFERENCES public.tasks_recurrence_definitions(id, owner_id),
  CONSTRAINT tasks_recurrence_evaluations_result_valid CHECK (
    jsonb_typeof(result) = 'object'
    AND jsonb_typeof(result -> 'occurrence_ids') = 'array'
  )
);

CREATE TABLE public.tasks_recurrence_status_events (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurrence_id uuid NOT NULL,
  requested_status text NOT NULL,
  base_record_revision bigint NOT NULL,
  result_record_revision bigint NOT NULL,
  result jsonb NOT NULL,
  client_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_recurrence_status_events_definition_owner_fkey
    FOREIGN KEY (recurrence_id, owner_id)
    REFERENCES public.tasks_recurrence_definitions(id, owner_id),
  CONSTRAINT tasks_recurrence_status_events_status_valid CHECK (
    requested_status IN ('active', 'paused', 'archived')
  ),
  CONSTRAINT tasks_recurrence_status_events_revisions_valid CHECK (
    base_record_revision > 0
    AND result_record_revision = base_record_revision + 1
  ),
  CONSTRAINT tasks_recurrence_status_events_result_valid CHECK (
    jsonb_typeof(result) = 'object'
    AND result #>> '{definition,status}' = requested_status
    AND (result #>> '{definition,record_revision}')::bigint = result_record_revision
  )
);

CREATE UNIQUE INDEX tasks_recurrence_definitions_owner_client_mutation_key
ON public.tasks_recurrence_definitions (owner_id, client_mutation_id);
CREATE INDEX tasks_recurrence_definitions_owner_status_idx
ON public.tasks_recurrence_definitions (owner_id, status, updated_at, id);
CREATE UNIQUE INDEX tasks_recurrence_revisions_owner_client_mutation_key
ON public.tasks_recurrence_revisions (owner_id, client_mutation_id);
CREATE INDEX tasks_recurrence_revisions_owner_definition_idx
ON public.tasks_recurrence_revisions (owner_id, recurrence_id, revision DESC);
CREATE UNIQUE INDEX tasks_recurrence_occurrences_logical_event_key
ON public.tasks_recurrence_occurrences (owner_id, recurrence_id, logical_key);
CREATE UNIQUE INDEX tasks_recurrence_occurrences_owner_client_mutation_key
ON public.tasks_recurrence_occurrences (owner_id, client_mutation_id);
CREATE INDEX tasks_recurrence_occurrences_owner_schedule_idx
ON public.tasks_recurrence_occurrences (
  owner_id, recurrence_id, scheduled_date DESC, generated_at DESC
);
CREATE INDEX tasks_recurrence_occurrences_owner_root_idx
ON public.tasks_recurrence_occurrences (owner_id, root_type, root_id);
CREATE INDEX tasks_recurrence_evaluations_owner_definition_idx
ON public.tasks_recurrence_evaluations (owner_id, recurrence_id, created_at DESC);
CREATE UNIQUE INDEX tasks_recurrence_evaluations_owner_client_mutation_key
ON public.tasks_recurrence_evaluations (owner_id, client_mutation_id);
CREATE INDEX tasks_recurrence_status_events_owner_definition_idx
ON public.tasks_recurrence_status_events (owner_id, recurrence_id, created_at DESC);
CREATE UNIQUE INDEX tasks_recurrence_status_events_owner_client_mutation_key
ON public.tasks_recurrence_status_events (owner_id, client_mutation_id);

ALTER TABLE public.tasks_recurrence_definitions REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_recurrence_revisions REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_recurrence_occurrences REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_recurrence_evaluations REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_recurrence_status_events REPLICA IDENTITY FULL;

ALTER TABLE public.tasks_recurrence_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_recurrence_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_recurrence_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_recurrence_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_recurrence_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Task owners can view their recurrence definitions"
ON public.tasks_recurrence_definitions FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Task owners can view their recurrence revisions"
ON public.tasks_recurrence_revisions FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Task owners can view their recurrence occurrences"
ON public.tasks_recurrence_occurrences FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Task owners can view their recurrence evaluations"
ON public.tasks_recurrence_evaluations FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Task owners can view their recurrence status events"
ON public.tasks_recurrence_status_events FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);

REVOKE ALL ON TABLE public.tasks_recurrence_definitions
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.tasks_recurrence_revisions
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.tasks_recurrence_occurrences
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.tasks_recurrence_evaluations
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.tasks_recurrence_status_events
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tasks_recurrence_definitions TO authenticated;
GRANT SELECT ON TABLE public.tasks_recurrence_revisions TO authenticated;
GRANT SELECT ON TABLE public.tasks_recurrence_occurrences TO authenticated;
GRANT SELECT ON TABLE public.tasks_recurrence_evaluations TO authenticated;
GRANT SELECT ON TABLE public.tasks_recurrence_status_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.tasks_recurrence_definitions,
  public.tasks_recurrence_revisions,
  public.tasks_recurrence_occurrences,
  public.tasks_recurrence_evaluations,
  public.tasks_recurrence_status_events
TO service_role;

CREATE TABLE tasks_private.recurrence_contexts (
  backend_pid integer NOT NULL,
  transaction_id bigint NOT NULL,
  owner_id uuid NOT NULL,
  PRIMARY KEY (backend_pid, transaction_id, owner_id)
);
REVOKE ALL ON TABLE tasks_private.recurrence_contexts
FROM PUBLIC, anon, authenticated;

ALTER TABLE public.tasks_todos
  ADD COLUMN recurrence_definition_id uuid,
  ADD COLUMN recurrence_revision bigint,
  ADD COLUMN recurrence_occurrence_id uuid,
  ADD COLUMN recurrence_logical_key text;
ALTER TABLE public.tasks_projects
  ADD COLUMN recurrence_definition_id uuid,
  ADD COLUMN recurrence_revision bigint,
  ADD COLUMN recurrence_occurrence_id uuid,
  ADD COLUMN recurrence_logical_key text;

ALTER TABLE public.tasks_todos
  ADD CONSTRAINT tasks_todos_recurrence_provenance_complete CHECK (
    (recurrence_definition_id IS NULL AND recurrence_revision IS NULL
      AND recurrence_occurrence_id IS NULL AND recurrence_logical_key IS NULL)
    OR (recurrence_definition_id IS NOT NULL AND recurrence_revision IS NOT NULL
      AND recurrence_occurrence_id IS NOT NULL AND recurrence_logical_key IS NOT NULL)
  ),
  ADD CONSTRAINT tasks_todos_recurrence_revision_owner_fkey
    FOREIGN KEY (recurrence_definition_id, recurrence_revision, owner_id)
    REFERENCES public.tasks_recurrence_revisions(recurrence_id, revision, owner_id),
  ADD CONSTRAINT tasks_todos_recurrence_occurrence_owner_fkey
    FOREIGN KEY (recurrence_occurrence_id, owner_id)
    REFERENCES public.tasks_recurrence_occurrences(id, owner_id);
ALTER TABLE public.tasks_projects
  ADD CONSTRAINT tasks_projects_recurrence_provenance_complete CHECK (
    (recurrence_definition_id IS NULL AND recurrence_revision IS NULL
      AND recurrence_occurrence_id IS NULL AND recurrence_logical_key IS NULL)
    OR (recurrence_definition_id IS NOT NULL AND recurrence_revision IS NOT NULL
      AND recurrence_occurrence_id IS NOT NULL AND recurrence_logical_key IS NOT NULL)
  ),
  ADD CONSTRAINT tasks_projects_recurrence_revision_owner_fkey
    FOREIGN KEY (recurrence_definition_id, recurrence_revision, owner_id)
    REFERENCES public.tasks_recurrence_revisions(recurrence_id, revision, owner_id),
  ADD CONSTRAINT tasks_projects_recurrence_occurrence_owner_fkey
    FOREIGN KEY (recurrence_occurrence_id, owner_id)
    REFERENCES public.tasks_recurrence_occurrences(id, owner_id);

CREATE INDEX tasks_todos_owner_recurrence_idx
ON public.tasks_todos (owner_id, recurrence_definition_id, recurrence_occurrence_id)
WHERE recurrence_definition_id IS NOT NULL;
CREATE INDEX tasks_projects_owner_recurrence_idx
ON public.tasks_projects (owner_id, recurrence_definition_id, recurrence_occurrence_id)
WHERE recurrence_definition_id IS NOT NULL;

CREATE OR REPLACE FUNCTION tasks_private.prepare_recurrence_definition_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Recurrence identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'archived' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Archived recurrence definitions are immutable'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.record_revision <> OLD.record_revision + 1 THEN
    RAISE EXCEPTION 'Recurrence record revision must increment by exactly one'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.current_revision NOT IN (OLD.current_revision, OLD.current_revision + 1) THEN
    RAISE EXCEPTION 'Recurrence content revision is invalid' USING ERRCODE = '23514';
  END IF;
  IF NEW.client_mutation_id = OLD.client_mutation_id THEN
    RAISE EXCEPTION 'Recurrence updates require a new mutation identifier'
      USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.prepare_recurrence_definition_update()
FROM PUBLIC, anon, authenticated;
CREATE TRIGGER tasks_recurrence_definitions_prepare_update
BEFORE UPDATE ON public.tasks_recurrence_definitions
FOR EACH ROW EXECUTE FUNCTION tasks_private.prepare_recurrence_definition_update();

CREATE OR REPLACE FUNCTION tasks_private.reject_recurrence_immutable_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND (SELECT auth.uid()) IS NULL THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Recurrence revisions, occurrences, and evaluations are immutable'
    USING ERRCODE = '23514';
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.reject_recurrence_immutable_write()
FROM PUBLIC, anon, authenticated;
CREATE TRIGGER tasks_recurrence_revisions_immutable
BEFORE UPDATE OR DELETE ON public.tasks_recurrence_revisions
FOR EACH ROW EXECUTE FUNCTION tasks_private.reject_recurrence_immutable_write();
CREATE TRIGGER tasks_recurrence_occurrences_immutable
BEFORE UPDATE OR DELETE ON public.tasks_recurrence_occurrences
FOR EACH ROW EXECUTE FUNCTION tasks_private.reject_recurrence_immutable_write();
CREATE TRIGGER tasks_recurrence_evaluations_immutable
BEFORE UPDATE OR DELETE ON public.tasks_recurrence_evaluations
FOR EACH ROW EXECUTE FUNCTION tasks_private.reject_recurrence_immutable_write();
CREATE TRIGGER tasks_recurrence_status_events_immutable
BEFORE UPDATE OR DELETE ON public.tasks_recurrence_status_events
FOR EACH ROW EXECUTE FUNCTION tasks_private.reject_recurrence_immutable_write();

CREATE OR REPLACE FUNCTION tasks_private.guard_recurrence_provenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _requires_context boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _requires_context := NEW.recurrence_definition_id IS NOT NULL;
  ELSE
    _requires_context := (
      NEW.recurrence_definition_id IS DISTINCT FROM OLD.recurrence_definition_id
      OR NEW.recurrence_revision IS DISTINCT FROM OLD.recurrence_revision
      OR NEW.recurrence_occurrence_id IS DISTINCT FROM OLD.recurrence_occurrence_id
      OR NEW.recurrence_logical_key IS DISTINCT FROM OLD.recurrence_logical_key
    );
  END IF;
  IF TG_OP = 'UPDATE' AND _requires_context THEN
    IF OLD.recurrence_definition_id IS NOT NULL THEN
      RAISE EXCEPTION 'Recurrence provenance is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF _requires_context THEN
    IF NOT EXISTS (
      SELECT 1 FROM tasks_private.recurrence_contexts AS context
      WHERE context.backend_pid = pg_backend_pid()
        AND context.transaction_id = txid_current()
        AND context.owner_id = NEW.owner_id
    ) AND NOT EXISTS (
      SELECT 1 FROM tasks_private.restore_contexts AS context
      WHERE context.backend_pid = pg_backend_pid()
        AND context.transaction_id = txid_current()
        AND context.owner_id = NEW.owner_id
    ) THEN
      RAISE EXCEPTION 'Recurrence provenance can be assigned only by generation or restore'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.guard_recurrence_provenance()
FROM PUBLIC, anon, authenticated;
CREATE TRIGGER tasks_todos_guard_recurrence_provenance
BEFORE INSERT OR UPDATE ON public.tasks_todos
FOR EACH ROW EXECUTE FUNCTION tasks_private.guard_recurrence_provenance();
CREATE TRIGGER tasks_projects_guard_recurrence_provenance
BEFORE INSERT OR UPDATE ON public.tasks_projects
FOR EACH ROW EXECUTE FUNCTION tasks_private.guard_recurrence_provenance();

CREATE OR REPLACE FUNCTION tasks_private.add_recurrence_interval(
  _anchor date,
  _frequency text,
  _interval_count integer,
  _steps integer DEFAULT 1
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _months integer;
  _target_month date;
  _last_day integer;
BEGIN
  IF _anchor IS NULL OR _interval_count < 1 OR _steps < 0
    OR _frequency NOT IN ('daily', 'weekly', 'monthly', 'yearly') THEN
    RAISE EXCEPTION 'Recurrence interval input is invalid' USING ERRCODE = '22023';
  END IF;
  IF _frequency = 'daily' THEN
    RETURN _anchor + (_interval_count * _steps);
  ELSIF _frequency = 'weekly' THEN
    RETURN _anchor + (_interval_count * _steps * 7);
  END IF;
  _months := _interval_count * _steps * CASE WHEN _frequency = 'yearly' THEN 12 ELSE 1 END;
  _target_month := (date_trunc('month', _anchor)::date + make_interval(months => _months))::date;
  _last_day := extract(day FROM (_target_month + interval '1 month - 1 day'))::integer;
  RETURN _target_month + (least(extract(day FROM _anchor)::integer, _last_day) - 1);
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.add_recurrence_interval(date, text, integer, integer)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_save_recurrence(
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
  _revision public.tasks_recurrence_revisions;
  _template public.tasks_templates;
  _next_revision bigint;
  _normalized_name text := btrim(_name);
  _timestamp timestamptz := clock_timestamp();
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to save recurrence'
      USING ERRCODE = '42501';
  END IF;
  IF _mutation_id IS NULL OR NULLIF(_normalized_name, '') IS NULL
    OR char_length(_normalized_name) > 500 OR _template_id IS NULL
    OR _rule_mode NOT IN ('calendar', 'after_completion')
    OR _frequency NOT IN ('daily', 'weekly', 'monthly', 'yearly')
    OR _interval_count NOT BETWEEN 1 AND 1000 OR _start_date IS NULL
    OR _missed_policy NOT IN ('skip', 'latest', 'all')
    OR _catch_up_limit NOT BETWEEN 1 AND 100
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_timezone_names
      WHERE name = _planning_timezone
    )
    OR _mutation_channel NOT IN (
      'web', 'raycast', 'mcp', 'mail_automation',
      'browser_capture', 'native', 'import'
    )
    OR _actor_type NOT IN ('user', 'automation', 'system', 'import') THEN
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
    IF (_recurrence_id IS NOT NULL AND _revision.recurrence_id IS DISTINCT FROM _recurrence_id)
      OR _revision.name IS DISTINCT FROM _normalized_name
      OR _revision.template_id IS DISTINCT FROM _template_id
      OR (_template_revision IS NOT NULL
        AND _revision.template_revision IS DISTINCT FROM _template_revision)
      OR _revision.rule_mode IS DISTINCT FROM _rule_mode
      OR _revision.frequency IS DISTINCT FROM _frequency
      OR _revision.interval_count IS DISTINCT FROM _interval_count
      OR _revision.start_date IS DISTINCT FROM _start_date
      OR _revision.planning_timezone IS DISTINCT FROM _planning_timezone
      OR _revision.missed_policy IS DISTINCT FROM _missed_policy
      OR _revision.catch_up_limit IS DISTINCT FROM _catch_up_limit
      OR _revision.target_area_id IS DISTINCT FROM _target_area_id THEN
      RAISE EXCEPTION 'The mutation identifier belongs to a different recurrence revision'
        USING ERRCODE = '23505';
    END IF;
    SELECT definition.* INTO _definition
    FROM public.tasks_recurrence_definitions AS definition
    WHERE definition.id = _revision.recurrence_id AND definition.owner_id = _owner_id;
    RETURN jsonb_build_object(
      'outcome', 'already_applied',
      'definition', to_jsonb(_definition) - 'owner_id',
      'revision', to_jsonb(_revision) - 'owner_id'
    );
  END IF;

  SELECT template.* INTO _template
  FROM public.tasks_templates AS template
  WHERE template.id = _template_id AND template.owner_id = _owner_id
  FOR SHARE;
  IF NOT FOUND OR _template.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'The recurrence template is unavailable' USING ERRCODE = '22023';
  END IF;
  IF _template_revision IS NULL THEN
    _template_revision := _template.current_revision;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks_template_revisions AS revision
    WHERE revision.owner_id = _owner_id
      AND revision.template_id = _template_id
      AND revision.revision = _template_revision
  ) THEN
    RAISE EXCEPTION 'The recurrence template revision is unavailable'
      USING ERRCODE = '22023';
  END IF;
  IF _target_area_id IS NOT NULL AND (
    _template.kind <> 'project' OR NOT EXISTS (
      SELECT 1 FROM public.tasks_areas AS area
      WHERE area.id = _target_area_id AND area.owner_id = _owner_id
        AND area.disposition = 'present'
    )
  ) THEN
    RAISE EXCEPTION 'The recurrence target area is unavailable'
      USING ERRCODE = '22023';
  END IF;

  IF _recurrence_id IS NULL THEN
    INSERT INTO public.tasks_recurrence_definitions (
      owner_id, name, status, current_revision, record_revision,
      last_mutation_channel, last_actor_type, client_mutation_id,
      created_at, updated_at
    ) VALUES (
      _owner_id, _normalized_name, 'active', 1, 1,
      _mutation_channel, _actor_type, _mutation_id, _timestamp, _timestamp
    ) RETURNING * INTO _definition;
    _next_revision := 1;
  ELSE
    SELECT definition.* INTO _definition
    FROM public.tasks_recurrence_definitions AS definition
    WHERE definition.id = _recurrence_id AND definition.owner_id = _owner_id
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
    _next_revision := _definition.current_revision + 1;
    UPDATE public.tasks_recurrence_definitions
    SET name = _normalized_name,
        current_revision = _next_revision,
        record_revision = record_revision + 1,
        last_mutation_channel = _mutation_channel,
        last_actor_type = _actor_type,
        client_mutation_id = _mutation_id
    WHERE id = _definition.id AND owner_id = _owner_id
    RETURNING * INTO _definition;
  END IF;

  INSERT INTO public.tasks_recurrence_revisions (
    owner_id, recurrence_id, revision, name, template_id, template_revision,
    rule_mode, frequency, interval_count, start_date, planning_timezone,
    missed_policy, catch_up_limit, target_area_id, client_mutation_id, created_at
  ) VALUES (
    _owner_id, _definition.id, _next_revision, _normalized_name,
    _template_id, _template_revision, _rule_mode, _frequency, _interval_count,
    _start_date, _planning_timezone, _missed_policy, _catch_up_limit,
    _target_area_id, _mutation_id, _timestamp
  ) RETURNING * INTO _revision;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'definition', to_jsonb(_definition) - 'owner_id',
    'revision', to_jsonb(_revision) - 'owner_id'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_save_recurrence(
  uuid, bigint, text, uuid, bigint, text, text, integer, date, text,
  text, integer, uuid, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_save_recurrence(
  uuid, bigint, text, uuid, bigint, text, text, integer, date, text,
  text, integer, uuid, uuid, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_set_recurrence_status(
  _recurrence_id uuid,
  _expected_record_revision bigint,
  _status text,
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
  _event public.tasks_recurrence_status_events;
  _result jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to change recurrence status'
      USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('active', 'paused', 'archived') OR _mutation_id IS NULL
    OR _mutation_channel NOT IN (
      'web', 'raycast', 'mcp', 'mail_automation',
      'browser_capture', 'native', 'import'
    ) OR _actor_type NOT IN ('user', 'automation', 'system', 'import') THEN
    RAISE EXCEPTION 'Recurrence status input is invalid' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(_owner_id::text || E'\x1f' || _mutation_id::text, 0)
  );
  SELECT event.* INTO _event
  FROM public.tasks_recurrence_status_events AS event
  WHERE event.id = _mutation_id AND event.owner_id = _owner_id;
  IF FOUND THEN
    IF _event.recurrence_id IS DISTINCT FROM _recurrence_id
      OR _event.requested_status IS DISTINCT FROM _status
      OR _event.base_record_revision IS DISTINCT FROM _expected_record_revision THEN
      RAISE EXCEPTION 'The mutation identifier belongs to a different recurrence status change'
        USING ERRCODE = '23505';
    END IF;
    RETURN _event.result || jsonb_build_object('outcome', 'already_applied');
  END IF;
  SELECT definition.* INTO _definition
  FROM public.tasks_recurrence_definitions AS definition
  WHERE definition.id = _recurrence_id AND definition.owner_id = _owner_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The recurrence definition is unavailable' USING ERRCODE = '22023';
  END IF;
  IF _definition.status = 'archived' THEN
    RAISE EXCEPTION 'Archived recurrence definitions are immutable'
      USING ERRCODE = '23514';
  END IF;
  IF _definition.record_revision <> _expected_record_revision THEN
    RETURN jsonb_build_object(
      'outcome', 'conflict',
      'definition', to_jsonb(_definition) - 'owner_id'
    );
  END IF;
  UPDATE public.tasks_recurrence_definitions
  SET status = _status,
      archived_at = CASE WHEN _status = 'archived' THEN clock_timestamp() ELSE NULL END,
      record_revision = record_revision + 1,
      last_mutation_channel = _mutation_channel,
      last_actor_type = _actor_type,
      client_mutation_id = _mutation_id
  WHERE id = _recurrence_id AND owner_id = _owner_id
  RETURNING * INTO _definition;
  _result := jsonb_build_object(
    'outcome', 'accepted',
    'definition', to_jsonb(_definition) - 'owner_id'
  );
  INSERT INTO public.tasks_recurrence_status_events (
    id, owner_id, recurrence_id, requested_status, base_record_revision,
    result_record_revision, result, client_mutation_id
  ) VALUES (
    _mutation_id, _owner_id, _recurrence_id, _status,
    _expected_record_revision, _definition.record_revision, _result, _mutation_id
  );
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_set_recurrence_status(
  uuid, bigint, text, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_set_recurrence_status(
  uuid, bigint, text, uuid, text, text
) TO authenticated;

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
  _instantiation_result jsonb;
  _instantiation_id uuid;
  _root_type text;
  _root_id uuid;
  _occurrence_id uuid := gen_random_uuid();
BEGIN
  SELECT occurrence.* INTO _existing
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.recurrence_id = _definition.id
    AND occurrence.logical_key = _logical_key;
  IF FOUND THEN
    RETURN _existing;
  END IF;

  _instantiation_result := public.tasks_instantiate_template(
    _revision.template_id,
    _revision.template_revision,
    _scheduled_date,
    _occurrence_id,
    _entry_channel,
    _actor_type,
    _revision.target_area_id
  );
  _instantiation_id := (_instantiation_result #>> '{instantiation,id}')::uuid;
  _root_type := _instantiation_result #>> '{result,root_type}';
  _root_id := (_instantiation_result #>> '{result,root_id}')::uuid;

  INSERT INTO public.tasks_recurrence_occurrences (
    id, owner_id, recurrence_id, recurrence_revision, logical_key,
    scheduled_date, predecessor_occurrence_id, template_instantiation_id,
    root_type, root_id, client_mutation_id, generated_at
  ) VALUES (
    _occurrence_id, _owner_id, _definition.id, _revision.revision, _logical_key,
    _scheduled_date, _predecessor_occurrence_id, _instantiation_id,
    _root_type, _root_id, _occurrence_id, clock_timestamp()
  ) RETURNING * INTO _occurrence;

  INSERT INTO tasks_private.recurrence_contexts (
    backend_pid, transaction_id, owner_id
  ) VALUES (pg_backend_pid(), txid_current(), _owner_id)
  ON CONFLICT DO NOTHING;
  IF _root_type = 'todo' THEN
    UPDATE public.tasks_todos
    SET recurrence_definition_id = _definition.id,
        recurrence_revision = _revision.revision,
        recurrence_occurrence_id = _occurrence.id,
        recurrence_logical_key = _logical_key,
        revision = revision + 1,
        client_mutation_id = gen_random_uuid(),
        last_mutation_channel = _entry_channel,
        last_actor_type = _actor_type
    WHERE id = _root_id AND owner_id = _owner_id;
  ELSE
    UPDATE public.tasks_projects
    SET recurrence_definition_id = _definition.id,
        recurrence_revision = _revision.revision,
        recurrence_occurrence_id = _occurrence.id,
        recurrence_logical_key = _logical_key,
        revision = revision + 1,
        client_mutation_id = gen_random_uuid(),
        last_mutation_channel = _entry_channel,
        last_actor_type = _actor_type
    WHERE id = _root_id AND owner_id = _owner_id;
  END IF;
  DELETE FROM tasks_private.recurrence_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current()
    AND owner_id = _owner_id;
  RETURN _occurrence;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.instantiate_recurrence_occurrence(
  uuid, public.tasks_recurrence_definitions, public.tasks_recurrence_revisions,
  date, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;

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
  _latest date;
  _selected_dates date[] := ARRAY[]::date[];
  _occurrence_ids jsonb := '[]'::jsonb;
  _result jsonb;
  _step integer := 0;
  _due_count integer := 0;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to evaluate recurrence'
      USING ERRCODE = '42501';
  END IF;
  IF _through_date IS NULL OR _request_id IS NULL
    OR _entry_channel NOT IN (
      'web', 'raycast', 'mcp', 'mail_automation',
      'browser_capture', 'native', 'import'
    ) OR _actor_type NOT IN ('user', 'automation', 'system', 'import') THEN
    RAISE EXCEPTION 'Recurrence evaluation input is invalid' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(_owner_id::text || E'\x1f' || _request_id::text, 0)
  );
  SELECT evaluation.* INTO _existing
  FROM public.tasks_recurrence_evaluations AS evaluation
  WHERE evaluation.id = _request_id AND evaluation.owner_id = _owner_id;
  IF FOUND THEN
    IF _existing.recurrence_id IS DISTINCT FROM _recurrence_id
      OR _existing.through_date IS DISTINCT FROM _through_date THEN
      RAISE EXCEPTION 'The request identifier belongs to a different recurrence evaluation'
        USING ERRCODE = '23505';
    END IF;
    RETURN _existing.result || jsonb_build_object('outcome', 'already_applied');
  END IF;

  SELECT definition.* INTO _definition
  FROM public.tasks_recurrence_definitions AS definition
  WHERE definition.id = _recurrence_id AND definition.owner_id = _owner_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The recurrence definition is unavailable' USING ERRCODE = '22023';
  END IF;
  SELECT revision.* INTO _revision
  FROM public.tasks_recurrence_revisions AS revision
  WHERE revision.owner_id = _owner_id
    AND revision.recurrence_id = _definition.id
    AND revision.revision = _definition.current_revision;

  IF _definition.status = 'active' THEN
    IF _revision.rule_mode = 'after_completion' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.tasks_recurrence_occurrences AS occurrence
        WHERE occurrence.owner_id = _owner_id
          AND occurrence.recurrence_id = _definition.id
      ) AND _revision.start_date <= _through_date THEN
        _candidate := CASE
          WHEN _revision.missed_policy = 'skip'
            AND _revision.start_date < _through_date THEN NULL
          WHEN _revision.missed_policy = 'latest' THEN _through_date
          ELSE _revision.start_date
        END;
        IF _candidate IS NOT NULL THEN
          _selected_dates := ARRAY[_candidate];
        END IF;
      END IF;
    ELSE
      LOOP
        _candidate := tasks_private.add_recurrence_interval(
          _revision.start_date, _revision.frequency,
          _revision.interval_count, _step
        );
        EXIT WHEN _candidate > _through_date;
        IF _definition.evaluated_through_date IS NULL
          OR _candidate > _definition.evaluated_through_date THEN
          _due_count := _due_count + 1;
          _latest := _candidate;
          IF _revision.missed_policy = 'all' THEN
            IF _due_count > _revision.catch_up_limit THEN
              RAISE EXCEPTION 'Recurrence catch-up exceeds its safety limit'
                USING ERRCODE = '54000';
            END IF;
            _selected_dates := array_append(_selected_dates, _candidate);
          END IF;
        END IF;
        _step := _step + 1;
        IF _step > 100000 THEN
          RAISE EXCEPTION 'Recurrence evaluation range is too large'
            USING ERRCODE = '54000';
        END IF;
      END LOOP;
      IF _revision.missed_policy = 'latest' AND _latest IS NOT NULL THEN
        _selected_dates := ARRAY[_latest];
      ELSIF _revision.missed_policy = 'skip'
        AND _latest = _through_date THEN
        _selected_dates := ARRAY[_latest];
      END IF;
    END IF;

    FOREACH _candidate IN ARRAY _selected_dates LOOP
      _occurrence := tasks_private.instantiate_recurrence_occurrence(
        _owner_id, _definition, _revision, _candidate,
        CASE WHEN _revision.rule_mode = 'calendar'
          THEN 'calendar:' || _candidate::text
          ELSE 'initial:' || _candidate::text END,
        NULL, _entry_channel, _actor_type
      );
      _occurrence_ids := _occurrence_ids || jsonb_build_array(_occurrence.id);
    END LOOP;
    UPDATE public.tasks_recurrence_definitions
    SET evaluated_through_date = greatest(
          COALESCE(evaluated_through_date, _through_date), _through_date
        ),
        record_revision = record_revision + 1,
        last_mutation_channel = _entry_channel,
        last_actor_type = _actor_type,
        client_mutation_id = _request_id
    WHERE id = _definition.id AND owner_id = _owner_id
    RETURNING * INTO _definition;
  END IF;

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
END;
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
  _scheduled_date date;
  _entry_channel text := COALESCE(NEW.last_mutation_channel, 'web');
  _actor_type text := COALESCE(NEW.last_actor_type, 'user');
BEGIN
  IF OLD.lifecycle <> 'open' OR NEW.lifecycle <> 'completed'
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
  _scheduled_date := tasks_private.add_recurrence_interval(
    (NEW.completed_at AT TIME ZONE _revision.planning_timezone)::date,
    _revision.frequency, _revision.interval_count, 1
  );
  PERFORM tasks_private.instantiate_recurrence_occurrence(
    NEW.owner_id, _definition, _revision, _scheduled_date,
    'after:' || NEW.recurrence_occurrence_id::text,
    NEW.recurrence_occurrence_id, _entry_channel, _actor_type
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.advance_after_completion_recurrence()
FROM PUBLIC, anon, authenticated;
CREATE TRIGGER tasks_todos_advance_after_completion_recurrence
AFTER UPDATE OF lifecycle ON public.tasks_todos
FOR EACH ROW EXECUTE FUNCTION tasks_private.advance_after_completion_recurrence();
CREATE TRIGGER tasks_projects_advance_after_completion_recurrence
AFTER UPDATE OF lifecycle ON public.tasks_projects
FOR EACH ROW EXECUTE FUNCTION tasks_private.advance_after_completion_recurrence();

-- A template revision is the immutable future-work snapshot for recurrence.
-- Keep a live or paused definition from losing that snapshot unexpectedly.
CREATE OR REPLACE FUNCTION public.tasks_archive_template(
  _template_id uuid,
  _expected_record_revision bigint,
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
  _template public.tasks_templates;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to archive templates'
      USING ERRCODE = '42501';
  END IF;
  SELECT template.* INTO _template
  FROM public.tasks_templates AS template
  WHERE template.id = _template_id AND template.owner_id = _owner_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The template is unavailable' USING ERRCODE = '22023';
  END IF;
  IF _template.archived_at IS NOT NULL THEN
    IF _template.client_mutation_id = _mutation_id THEN
      RETURN jsonb_build_object(
        'outcome', 'already_applied',
        'template', to_jsonb(_template) - 'owner_id'
      );
    END IF;
    RAISE EXCEPTION 'The template is already archived' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.tasks_recurrence_revisions AS revision
    JOIN public.tasks_recurrence_definitions AS definition
      ON definition.id = revision.recurrence_id
     AND definition.owner_id = revision.owner_id
    WHERE revision.owner_id = _owner_id
      AND revision.template_id = _template_id
      AND definition.status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'Archive linked recurrence definitions before archiving this template'
      USING ERRCODE = '23514';
  END IF;
  IF _template.record_revision <> _expected_record_revision THEN
    RETURN jsonb_build_object(
      'outcome', 'conflict',
      'template', to_jsonb(_template) - 'owner_id'
    );
  END IF;
  UPDATE public.tasks_templates
  SET archived_at = clock_timestamp(),
      record_revision = record_revision + 1,
      last_mutation_channel = _mutation_channel,
      last_actor_type = _actor_type,
      client_mutation_id = _mutation_id
  WHERE id = _template_id AND owner_id = _owner_id
  RETURNING * INTO _template;
  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'template', to_jsonb(_template) - 'owner_id'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_archive_template(uuid, bigint, uuid, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_archive_template(uuid, bigint, uuid, text, text)
TO authenticated;

ALTER TABLE public.tasks_todos
  ALTER CONSTRAINT tasks_todos_recurrence_revision_owner_fkey
    DEFERRABLE INITIALLY DEFERRED,
  ALTER CONSTRAINT tasks_todos_recurrence_occurrence_owner_fkey
    DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.tasks_projects
  ALTER CONSTRAINT tasks_projects_recurrence_revision_owner_fkey
    DEFERRABLE INITIALLY DEFERRED,
  ALTER CONSTRAINT tasks_projects_recurrence_occurrence_owner_fkey
    DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION tasks_private.export_v9_as_v8(_envelope jsonb)
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
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations'
  ];
  _collection text;
  _data jsonb := '{}'::jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
BEGIN
  FOREACH _collection IN ARRAY _collections LOOP
    _data := _data || jsonb_build_object(
      _collection, _envelope #> ARRAY['data', _collection]
    );
    _counts := _counts || jsonb_build_object(
      _collection, _envelope #> ARRAY['manifest', 'counts', _collection]
    );
    _checksums := _checksums || jsonb_build_object(
      _collection, _envelope #> ARRAY['manifest', 'checksums', _collection]
    );
  END LOOP;
  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 8,
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

REVOKE ALL ON FUNCTION tasks_private.export_v9_as_v8(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v9(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _collection text;
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events'
  ];
  _records jsonb;
BEGIN
  IF jsonb_typeof(_envelope) IS DISTINCT FROM 'object'
    OR _envelope ->> 'format' IS DISTINCT FROM 'garden.bath.tasks.export'
    OR COALESCE(_envelope ->> 'schema_version', '') !~ '^[0-9]+$'
    OR (_envelope ->> 'schema_version')::integer <> 9
    OR _envelope #> '{manifest,collections}' IS DISTINCT FROM to_jsonb(_collections)
    OR _envelope #>> '{manifest,checksums,algorithm}' IS DISTINCT FROM 'sha256' THEN
    RAISE EXCEPTION 'Invalid task export v9 envelope' USING ERRCODE = '22023';
  END IF;
  FOREACH _collection IN ARRAY _collections LOOP
    _records := _envelope #> ARRAY['data', _collection];
    IF jsonb_typeof(_records) IS DISTINCT FROM 'array'
      OR COALESCE(_envelope #>> ARRAY['manifest', 'counts', _collection], '')
        !~ '^[0-9]+$'
      OR (_envelope #>> ARRAY['manifest', 'counts', _collection])::integer
        <> jsonb_array_length(_records)
      OR _envelope #>> ARRAY['manifest', 'checksums', _collection]
        IS DISTINCT FROM tasks_private.export_checksum(_records)
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(_records) AS record(value)
        WHERE jsonb_typeof(record.value) IS DISTINCT FROM 'object'
          OR NOT (record.value ? 'id') OR record.value ? 'owner_id'
      ) THEN
      RAISE EXCEPTION 'Task export v9 collection % is invalid', _collection
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  PERFORM tasks_private.validate_export_v8(
    tasks_private.export_v9_as_v8(_envelope)
  );

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      _envelope #> '{data,tasks_recurrence_definitions}'
    ) AS definition(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        _envelope #> '{data,tasks_recurrence_revisions}'
      ) AS revision(value)
      WHERE revision.value ->> 'recurrence_id' = definition.value ->> 'id'
        AND revision.value ->> 'revision' = definition.value ->> 'current_revision'
    )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      _envelope #> '{data,tasks_recurrence_revisions}'
    ) AS revision(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        _envelope #> '{data,tasks_recurrence_definitions}'
      ) AS definition(value)
      WHERE definition.value ->> 'id' = revision.value ->> 'recurrence_id'
    ) OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        _envelope #> '{data,tasks_template_revisions}'
      ) AS template_revision(value)
      WHERE template_revision.value ->> 'template_id' = revision.value ->> 'template_id'
        AND template_revision.value ->> 'revision' = revision.value ->> 'template_revision'
    )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      _envelope #> '{data,tasks_recurrence_occurrences}'
    ) AS occurrence(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        _envelope #> '{data,tasks_recurrence_revisions}'
      ) AS revision(value)
      WHERE revision.value ->> 'recurrence_id' = occurrence.value ->> 'recurrence_id'
        AND revision.value ->> 'revision' = occurrence.value ->> 'recurrence_revision'
    ) OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        _envelope #> '{data,tasks_template_instantiations}'
      ) AS instance(value)
      WHERE instance.value ->> 'id' = occurrence.value ->> 'template_instantiation_id'
        AND instance.value ->> 'root_type' = occurrence.value ->> 'root_type'
        AND instance.value ->> 'root_id' = occurrence.value ->> 'root_id'
    )
  ) THEN
    RAISE EXCEPTION 'Task export v9 contains an invalid recurrence graph'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT value FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}')
      UNION ALL
      SELECT value FROM jsonb_array_elements(_envelope #> '{data,tasks_projects}')
    ) AS root(value)
    WHERE (
      root.value ->> 'recurrence_definition_id' IS NULL
      AND (
        root.value ->> 'recurrence_revision' IS NOT NULL
        OR root.value ->> 'recurrence_occurrence_id' IS NOT NULL
        OR root.value ->> 'recurrence_logical_key' IS NOT NULL
      )
    ) OR (
      root.value ->> 'recurrence_definition_id' IS NOT NULL
      AND (
        root.value ->> 'recurrence_revision' IS NULL
        OR root.value ->> 'recurrence_occurrence_id' IS NULL
        OR root.value ->> 'recurrence_logical_key' IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            _envelope #> '{data,tasks_recurrence_occurrences}'
          ) AS occurrence(value)
          WHERE occurrence.value ->> 'id' = root.value ->> 'recurrence_occurrence_id'
            AND occurrence.value ->> 'recurrence_id'
              = root.value ->> 'recurrence_definition_id'
            AND occurrence.value ->> 'recurrence_revision'
              = root.value ->> 'recurrence_revision'
            AND occurrence.value ->> 'logical_key'
              = root.value ->> 'recurrence_logical_key'
            AND occurrence.value ->> 'root_id' = root.value ->> 'id'
        )
      )
    )
  ) THEN
    RAISE EXCEPTION 'Task export v9 contains invalid recurrence provenance'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v9(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v9()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _base jsonb;
  _data jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
  _records jsonb;
  _collection text;
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events'
  ];
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to export task data'
      USING ERRCODE = '42501';
  END IF;
  _base := public.tasks_create_export_v8();
  _data := _base -> 'data';

  SELECT COALESCE(jsonb_agg(
    to_jsonb(row_data) - 'owner_id' ORDER BY row_data.created_at, row_data.id
  ), '[]'::jsonb) INTO _records
  FROM public.tasks_recurrence_definitions AS row_data
  WHERE row_data.owner_id = _owner_id;
  _data := _data || jsonb_build_object('tasks_recurrence_definitions', _records);

  SELECT COALESCE(jsonb_agg(
    to_jsonb(row_data) - 'owner_id'
    ORDER BY row_data.recurrence_id, row_data.revision
  ), '[]'::jsonb) INTO _records
  FROM public.tasks_recurrence_revisions AS row_data
  WHERE row_data.owner_id = _owner_id;
  _data := _data || jsonb_build_object('tasks_recurrence_revisions', _records);

  SELECT COALESCE(jsonb_agg(
    to_jsonb(row_data) - 'owner_id'
    ORDER BY row_data.scheduled_date, row_data.generated_at, row_data.id
  ), '[]'::jsonb) INTO _records
  FROM public.tasks_recurrence_occurrences AS row_data
  WHERE row_data.owner_id = _owner_id;
  _data := _data || jsonb_build_object('tasks_recurrence_occurrences', _records);

  SELECT COALESCE(jsonb_agg(
    to_jsonb(row_data) - 'owner_id' ORDER BY row_data.created_at, row_data.id
  ), '[]'::jsonb) INTO _records
  FROM public.tasks_recurrence_evaluations AS row_data
  WHERE row_data.owner_id = _owner_id;
  _data := _data || jsonb_build_object('tasks_recurrence_evaluations', _records);

  SELECT COALESCE(jsonb_agg(
    to_jsonb(row_data) - 'owner_id' ORDER BY row_data.created_at, row_data.id
  ), '[]'::jsonb) INTO _records
  FROM public.tasks_recurrence_status_events AS row_data
  WHERE row_data.owner_id = _owner_id;
  _data := _data || jsonb_build_object('tasks_recurrence_status_events', _records);

  FOREACH _collection IN ARRAY _collections LOOP
    _records := _data -> _collection;
    _counts := _counts || jsonb_build_object(
      _collection, jsonb_array_length(_records)
    );
    _checksums := _checksums || jsonb_build_object(
      _collection, tasks_private.export_checksum(_records)
    );
  END LOOP;
  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 9,
    'created_at', _base -> 'created_at',
    'manifest', jsonb_build_object(
      'collections', to_jsonb(_collections),
      'counts', _counts,
      'checksums', _checksums
    ),
    'data', _data
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_create_export_v9() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v9() TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v9(
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
  _v8 jsonb;
  _report jsonb;
  _collection text;
  _table regclass;
  _collection_report jsonb;
  _recurrence_collections constant text[] := ARRAY[
    'tasks_recurrence_definitions', 'tasks_recurrence_revisions',
    'tasks_recurrence_occurrences', 'tasks_recurrence_evaluations',
    'tasks_recurrence_status_events'
  ];
  _recurrence_conflicts bigint := 0;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v9(_envelope);
  _v8 := tasks_private.export_v9_as_v8(_envelope);
  _report := public.tasks_restore_export_v8(_v8, true)
    || jsonb_build_object('schema_version', 9, 'dry_run', _dry_run);

  FOREACH _collection IN ARRAY _recurrence_collections LOOP
    _table := ('public.' || _collection)::regclass;
    _collection_report := tasks_private.classify_restore_v4_collection(
      _owner_id, _table, _envelope #> ARRAY['data', _collection], true
    );
    _report := _report || jsonb_build_object(_collection, _collection_report);
    _recurrence_conflicts := _recurrence_conflicts
      + (_collection_report ->> 'conflicts')::bigint;
  END LOOP;

  IF NOT _dry_run AND _recurrence_conflicts = 0 THEN
    _report := public.tasks_restore_export_v8(_v8, false)
      || (_report - 'schema_version' - 'dry_run');
    FOREACH _collection IN ARRAY _recurrence_collections LOOP
      _table := ('public.' || _collection)::regclass;
      PERFORM tasks_private.insert_restore_v4_collection(
        _owner_id, _table, _envelope #> ARRAY['data', _collection],
        _report -> _collection
      );
    END LOOP;
    _report := _report || jsonb_build_object(
      'schema_version', 9, 'dry_run', false, 'applied', true
    );
  ELSE
    _report := _report || jsonb_build_object(
      'applied', false,
      'code', CASE WHEN _recurrence_conflicts > 0
        THEN 'recurrence_conflict' ELSE NULL END
    );
  END IF;
  RETURN _report;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v9(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v9(jsonb, boolean)
TO authenticated;
