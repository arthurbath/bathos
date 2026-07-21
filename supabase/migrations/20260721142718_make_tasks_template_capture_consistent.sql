-- Keep template source provenance and hierarchy content on one statement snapshot.

CREATE OR REPLACE FUNCTION tasks_private.capture_template_source(
  _owner_id uuid,
  _source_type text,
  _source_id uuid,
  _anchor_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _source_revision bigint;
  _snapshot jsonb;
BEGIN
  IF _source_type = 'todo' THEN
    SELECT task.revision INTO _source_revision
    FROM public.tasks_todos AS task
    WHERE task.id = _source_id
      AND task.owner_id = _owner_id
      AND task.disposition = 'present';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The template source to-do is unavailable'
        USING ERRCODE = '22023';
    END IF;
    _snapshot := tasks_private.template_snapshot_from_todo(
      _owner_id, _source_id, _anchor_date
    );
  ELSIF _source_type = 'project' THEN
    SELECT project.revision INTO _source_revision
    FROM public.tasks_projects AS project
    WHERE project.id = _source_id
      AND project.owner_id = _owner_id
      AND project.disposition = 'present';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The template source project is unavailable'
        USING ERRCODE = '22023';
    END IF;
    _snapshot := tasks_private.template_snapshot_from_project(
      _owner_id, _source_id, _anchor_date
    );
  ELSE
    RAISE EXCEPTION 'Template capture input is invalid' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'source_revision', _source_revision,
    'snapshot', _snapshot
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.capture_template_source(
  uuid, text, uuid, date
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_capture_template(
  _template_id uuid,
  _source_type text,
  _source_id uuid,
  _name text,
  _anchor_date date,
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
  _revision public.tasks_template_revisions;
  _source_capture jsonb;
  _source_revision bigint;
  _next_revision bigint;
  _snapshot jsonb;
  _normalized_name text := btrim(_name);
  _timestamp timestamptz := clock_timestamp();
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to save templates'
      USING ERRCODE = '42501';
  END IF;
  IF _source_type NOT IN ('todo', 'project')
    OR _source_id IS NULL
    OR _mutation_id IS NULL
    OR _anchor_date IS NULL
    OR NULLIF(_normalized_name, '') IS NULL
    OR char_length(_normalized_name) > 500
    OR _mutation_channel NOT IN (
      'web', 'raycast', 'mcp', 'mail_automation',
      'browser_capture', 'native', 'import'
    )
    OR _actor_type NOT IN ('user', 'automation', 'system', 'import') THEN
    RAISE EXCEPTION 'Template capture input is invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_owner_id::text || E'\x1f' || _mutation_id::text, 0)
  );
  SELECT revision.* INTO _revision
  FROM public.tasks_template_revisions AS revision
  WHERE revision.owner_id = _owner_id
    AND revision.client_mutation_id = _mutation_id;
  IF FOUND THEN
    IF _revision.source_type IS DISTINCT FROM _source_type
      OR _revision.source_id IS DISTINCT FROM _source_id
      OR _revision.name IS DISTINCT FROM _normalized_name
      OR _revision.anchor_date IS DISTINCT FROM _anchor_date
      OR (_template_id IS NOT NULL AND _revision.template_id IS DISTINCT FROM _template_id) THEN
      RAISE EXCEPTION 'The mutation identifier belongs to a different template capture'
        USING ERRCODE = '23505';
    END IF;
    SELECT template.* INTO _template
    FROM public.tasks_templates AS template
    WHERE template.id = _revision.template_id AND template.owner_id = _owner_id;
    RETURN jsonb_build_object(
      'outcome', 'already_applied',
      'template', to_jsonb(_template) - 'owner_id',
      'revision', to_jsonb(_revision) - 'owner_id'
    );
  END IF;

  _source_capture := tasks_private.capture_template_source(
    _owner_id, _source_type, _source_id, _anchor_date
  );
  _source_revision := (_source_capture ->> 'source_revision')::bigint;
  _snapshot := _source_capture -> 'snapshot';

  IF _template_id IS NULL THEN
    INSERT INTO public.tasks_templates (
      owner_id, kind, name, current_revision, record_revision,
      last_mutation_channel, last_actor_type, client_mutation_id,
      created_at, updated_at
    ) VALUES (
      _owner_id, _source_type, _normalized_name, 1, 1,
      _mutation_channel, _actor_type, _mutation_id, _timestamp, _timestamp
    ) RETURNING * INTO _template;
    _next_revision := 1;
  ELSE
    SELECT template.* INTO _template
    FROM public.tasks_templates AS template
    WHERE template.id = _template_id AND template.owner_id = _owner_id
    FOR UPDATE;
    IF NOT FOUND OR _template.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'The template is unavailable' USING ERRCODE = '22023';
    END IF;
    IF _template.kind IS DISTINCT FROM _source_type THEN
      RAISE EXCEPTION 'The template source type cannot change'
        USING ERRCODE = '22023';
    END IF;
    _next_revision := _template.current_revision + 1;
    UPDATE public.tasks_templates
    SET name = _normalized_name,
        current_revision = _next_revision,
        record_revision = record_revision + 1,
        last_mutation_channel = _mutation_channel,
        last_actor_type = _actor_type,
        client_mutation_id = _mutation_id
    WHERE id = _template.id AND owner_id = _owner_id
    RETURNING * INTO _template;
  END IF;

  INSERT INTO public.tasks_template_revisions (
    owner_id, template_id, revision, name, source_type, source_id,
    source_revision, anchor_date, snapshot, client_mutation_id, created_at
  ) VALUES (
    _owner_id, _template.id, _next_revision, _normalized_name,
    _source_type, _source_id, _source_revision, _anchor_date,
    _snapshot, _mutation_id, _timestamp
  ) RETURNING * INTO _revision;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'template', to_jsonb(_template) - 'owner_id',
    'revision', to_jsonb(_revision) - 'owner_id'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_capture_template(
  uuid, text, uuid, text, date, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_capture_template(
  uuid, text, uuid, text, date, uuid, text, text
) TO authenticated;
