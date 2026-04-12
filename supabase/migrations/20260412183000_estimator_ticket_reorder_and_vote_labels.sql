CREATE OR REPLACE FUNCTION public.estimator_vote_rank_from_label(
  _voting_mode public.estimator_voting_mode,
  _vote_value text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _voting_mode = 'ballpark' THEN CASE upper(trim(coalesce(_vote_value, '')))
      WHEN 'XXS' THEN '1'
      WHEN 'XXXS' THEN '1'
      WHEN 'XS' THEN '2'
      WHEN 'S' THEN '3'
      WHEN 'M' THEN '4'
      WHEN 'L' THEN '5'
      WHEN 'XL' THEN '6'
      WHEN 'XXL+' THEN '7'
      WHEN 'XXL' THEN '7'
      ELSE NULL
    END
    WHEN _voting_mode = 'fibonacci' THEN CASE trim(coalesce(_vote_value, ''))
      WHEN '1' THEN '1'
      WHEN '2' THEN '2'
      WHEN '3' THEN '3'
      WHEN '5' THEN '4'
      WHEN '8' THEN '5'
      WHEN '13' THEN '6'
      WHEN '21+' THEN '7'
      WHEN '21' THEN '7'
      ELSE NULL
    END
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_vote_label_from_rank(
  _voting_mode public.estimator_voting_mode,
  _vote_rank text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _voting_mode = 'ballpark' THEN CASE trim(coalesce(_vote_rank, ''))
      WHEN '1' THEN 'XXS'
      WHEN '2' THEN 'XS'
      WHEN '3' THEN 'S'
      WHEN '4' THEN 'M'
      WHEN '5' THEN 'L'
      WHEN '6' THEN 'XL'
      WHEN '7' THEN 'XXL+'
      ELSE NULL
    END
    WHEN _voting_mode = 'fibonacci' THEN CASE trim(coalesce(_vote_rank, ''))
      WHEN '1' THEN '1'
      WHEN '2' THEN '2'
      WHEN '3' THEN '3'
      WHEN '4' THEN '5'
      WHEN '5' THEN '8'
      WHEN '6' THEN '13'
      WHEN '7' THEN '21+'
      ELSE NULL
    END
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_reorder_ticket(
  _room_token text,
  _member_id uuid,
  _member_secret text,
  _ticket_id uuid,
  _target_sort_order integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_room_id uuid;
  v_ticket public.estimator_tickets%ROWTYPE;
  v_ticket_ids uuid[];
  v_remaining_ticket_ids uuid[];
  v_prefix uuid[] := ARRAY[]::uuid[];
  v_suffix uuid[] := ARRAY[]::uuid[];
  v_total_tickets integer;
  v_target_sort integer;
BEGIN
  SELECT room_id
    INTO v_room_id
  FROM public.estimator_validate_room_member(_room_token, _member_id, _member_secret);

  SELECT *
    INTO v_ticket
  FROM public.estimator_tickets
  WHERE id = _ticket_id
    AND room_id = v_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  SELECT coalesce(array_agg(id ORDER BY sort_order, id), ARRAY[]::uuid[])
    INTO v_ticket_ids
  FROM (
    SELECT id, sort_order
    FROM public.estimator_tickets
    WHERE room_id = v_room_id
    ORDER BY sort_order, id
    FOR UPDATE
  ) ordered_tickets;

  v_total_tickets := coalesce(array_length(v_ticket_ids, 1), 0);
  IF v_total_tickets = 0 THEN
    RETURN jsonb_build_object('ticketId', v_ticket.id, 'moved', false, 'sortOrder', v_ticket.sort_order);
  END IF;

  v_target_sort := greatest(0, least(coalesce(_target_sort_order, v_ticket.sort_order), v_total_tickets - 1));
  IF v_target_sort = v_ticket.sort_order THEN
    RETURN jsonb_build_object('ticketId', v_ticket.id, 'moved', false, 'sortOrder', v_ticket.sort_order);
  END IF;

  v_remaining_ticket_ids := array_remove(v_ticket_ids, v_ticket.id);
  v_prefix := coalesce(v_remaining_ticket_ids[1:v_target_sort], ARRAY[]::uuid[]);
  v_suffix := coalesce(
    v_remaining_ticket_ids[v_target_sort + 1:coalesce(array_length(v_remaining_ticket_ids, 1), 0)],
    ARRAY[]::uuid[]
  );
  v_ticket_ids := v_prefix || ARRAY[v_ticket.id] || v_suffix;

  WITH ordered AS (
    SELECT ticket_id, ordinality - 1 AS next_sort_order
    FROM unnest(v_ticket_ids) WITH ORDINALITY AS ordered_ids(ticket_id, ordinality)
  )
  UPDATE public.estimator_tickets AS tickets
  SET sort_order = -1000 - ordered.next_sort_order
  FROM ordered
  WHERE tickets.id = ordered.ticket_id;

  WITH ordered AS (
    SELECT ticket_id, ordinality - 1 AS next_sort_order
    FROM unnest(v_ticket_ids) WITH ORDINALITY AS ordered_ids(ticket_id, ordinality)
  )
  UPDATE public.estimator_tickets AS tickets
  SET sort_order = ordered.next_sort_order,
      updated_at = now()
  FROM ordered
  WHERE tickets.id = ordered.ticket_id;

  RETURN jsonb_build_object('ticketId', v_ticket.id, 'moved', true, 'sortOrder', v_target_sort);
END;
$$;

REVOKE ALL ON FUNCTION public.estimator_reorder_ticket(text, uuid, text, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estimator_reorder_ticket(text, uuid, text, uuid, integer) TO anon, authenticated;
