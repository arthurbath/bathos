-- Atomic, idempotent creation for Inbox Manager Mail capture.

CREATE OR REPLACE FUNCTION public.tasks_create_mail_capture(
  _idempotency_key uuid,
  _task_id uuid,
  _title text,
  _notes text,
  _start_date date,
  _order_key text,
  _hierarchy_order_key text,
  _account_identifier text,
  _mailbox_identifier text,
  _message_identifier text,
  _deep_link text,
  _retirement_destination_identifier text,
  _source_title text DEFAULT NULL,
  _area_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _task public.tasks_todos;
  _source public.tasks_mail_sources;
  _event public.tasks_history_events;
  _outcome text;
  _timestamp timestamptz := clock_timestamp();
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to capture Mail tasks'
      USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(_title), '') IS NULL OR char_length(btrim(_title)) > 500 THEN
    RAISE EXCEPTION 'Mail task title is required and cannot exceed 500 characters'
      USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(_notes, '')) > 100000 THEN
    RAISE EXCEPTION 'Mail task notes cannot exceed 100000 characters'
      USING ERRCODE = '22023';
  END IF;
  IF _start_date IS NULL THEN
    RAISE EXCEPTION 'Mail capture requires the owner planning date'
      USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(_order_key), '') IS NULL OR char_length(_order_key) > 255 THEN
    RAISE EXCEPTION 'Mail capture requires a valid planning order key'
      USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(_account_identifier), '') IS NULL
    OR NULLIF(btrim(_mailbox_identifier), '') IS NULL
    OR NULLIF(btrim(_message_identifier), '') IS NULL
    OR NULLIF(btrim(_deep_link), '') IS NULL
    OR _deep_link NOT LIKE 'message://%'
    OR NULLIF(btrim(_retirement_destination_identifier), '') IS NULL THEN
    RAISE EXCEPTION 'Mail capture requires complete structured source identity'
      USING ERRCODE = '22023';
  END IF;
  IF _area_id IS NULL AND _hierarchy_order_key IS NOT NULL THEN
    RAISE EXCEPTION 'Unassigned Mail capture cannot have hierarchy order'
      USING ERRCODE = '22023';
  END IF;
  IF _area_id IS NOT NULL AND NULLIF(btrim(_hierarchy_order_key), '') IS NULL THEN
    RAISE EXCEPTION 'Area-assigned Mail capture requires hierarchy order'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      _owner_id::text || E'\x1f' || btrim(_account_identifier)
        || E'\x1f' || btrim(_message_identifier),
      0
    )
  );

  SELECT task.* INTO _task
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id
    AND task.client_mutation_id = _idempotency_key;

  IF _task.id IS NOT NULL THEN
    SELECT source.* INTO _source
    FROM public.tasks_mail_sources AS source
    WHERE source.task_id = _task.id AND source.owner_id = _owner_id;
    IF _task.title IS DISTINCT FROM btrim(_title)
      OR _task.notes IS DISTINCT FROM COALESCE(_notes, '')
      OR _task.destination IS DISTINCT FROM 'today'
      OR _task.today_section IS DISTINCT FROM 'daytime'
      OR _task.start_date IS DISTINCT FROM _start_date
      OR _task.area_id IS DISTINCT FROM _area_id
      OR _task.order_key IS DISTINCT FROM _order_key
      OR _task.hierarchy_order_key IS DISTINCT FROM _hierarchy_order_key
      OR _task.source_kind IS DISTINCT FROM 'mail_message'
      OR _task.source_url IS DISTINCT FROM _deep_link
      OR _task.source_title IS DISTINCT FROM NULLIF(btrim(_source_title), '')
      OR _task.source_external_id IS DISTINCT FROM btrim(_message_identifier)
      OR _source.account_identifier IS DISTINCT FROM btrim(_account_identifier)
      OR _source.mailbox_identifier IS DISTINCT FROM btrim(_mailbox_identifier)
      OR _source.deep_link IS DISTINCT FROM _deep_link
      OR _source.retirement_destination_identifier
        IS DISTINCT FROM btrim(_retirement_destination_identifier) THEN
      RAISE EXCEPTION 'The idempotency key belongs to a different Mail capture request'
        USING ERRCODE = '23505';
    END IF;
    _outcome := 'already_applied';
  ELSE
    SELECT source.* INTO _source
    FROM public.tasks_mail_sources AS source
    WHERE source.owner_id = _owner_id
      AND source.account_identifier = btrim(_account_identifier)
      AND source.message_identifier = btrim(_message_identifier);

    IF _source.task_id IS NOT NULL THEN
      SELECT task.* INTO _task
      FROM public.tasks_todos AS task
      WHERE task.id = _source.task_id AND task.owner_id = _owner_id;
      IF _source.mailbox_identifier IS DISTINCT FROM btrim(_mailbox_identifier)
        OR _source.deep_link IS DISTINCT FROM _deep_link
        OR _source.retirement_destination_identifier
          IS DISTINCT FROM btrim(_retirement_destination_identifier) THEN
        RAISE EXCEPTION 'The Mail message identity is already captured with different source data'
          USING ERRCODE = '23505';
      END IF;
      _outcome := 'source_already_applied';
    ELSE
      INSERT INTO public.tasks_todos (
        id, owner_id, area_id, project_id, heading_id, title, notes,
        lifecycle, completed_at, canceled_at, disposition, deleted_at,
        deletion_root_id, destination, today_section, order_key,
        hierarchy_order_key, start_date, deadline, entry_channel,
        last_mutation_channel, last_actor_type, undo_source_event_id,
        source_kind, source_url, source_title, source_external_id,
        revision, client_mutation_id, created_at, updated_at
      ) VALUES (
        _task_id, _owner_id, _area_id, NULL, NULL, btrim(_title), COALESCE(_notes, ''),
        'open', NULL, NULL, 'present', NULL,
        NULL, 'today', 'daytime', _order_key,
        _hierarchy_order_key, _start_date, NULL, 'mail_automation',
        'mail_automation', 'automation', NULL,
        'mail_message', _deep_link, NULLIF(btrim(_source_title), ''),
        btrim(_message_identifier), 1, _idempotency_key, _timestamp, _timestamp
      )
      RETURNING * INTO _task;

      INSERT INTO public.tasks_mail_sources (
        task_id, owner_id, account_identifier, mailbox_identifier,
        message_identifier, deep_link, retirement_destination_identifier,
        lifecycle, retirement_attempted_at, retired_at, last_error_code,
        revision, client_mutation_id, created_at, updated_at
      ) VALUES (
        _task_id, _owner_id, btrim(_account_identifier), btrim(_mailbox_identifier),
        btrim(_message_identifier), _deep_link,
        btrim(_retirement_destination_identifier),
        'retained', NULL, NULL, NULL, 1, _idempotency_key, _timestamp, _timestamp
      )
      RETURNING * INTO _source;
      _outcome := 'created';
    END IF;
  END IF;

  SELECT event.* INTO _event
  FROM public.tasks_history_events AS event
  WHERE event.owner_id = _owner_id
    AND event.task_id = _task.id
    AND event.transition = 'create'
  ORDER BY event.occurred_at, event.id
  LIMIT 1;

  RETURN jsonb_build_object(
    'idempotency_outcome', _outcome,
    'receipt', jsonb_build_object(
      'client_mutation_id', _event.client_mutation_id,
      'actor_type', _event.actor_type,
      'mutation_channel', _event.mutation_channel,
      'affected_ids', _event.affected_ids,
      'base_revision', _event.base_revision,
      'result_revision', _event.result_revision,
      'transition', _event.transition,
      'occurred_at', _event.occurred_at,
      'outcome', _event.outcome,
      'code', NULL
    ),
    'task', to_jsonb(_task) - 'owner_id',
    'mail_source', to_jsonb(_source) - 'owner_id'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_create_mail_capture(
  uuid, uuid, text, text, date, text, text, text, text, text, text, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_mail_capture(
  uuid, uuid, text, text, date, text, text, text, text, text, text, text, text, uuid
) TO authenticated;
