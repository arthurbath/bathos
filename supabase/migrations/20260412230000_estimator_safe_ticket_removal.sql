CREATE OR REPLACE FUNCTION public.estimator_remove_ticket(
  _room_token text,
  _member_id uuid,
  _member_secret text,
  _ticket_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_room_id uuid;
  v_member_id uuid;
  v_member_nickname text;
  v_ticket public.estimator_tickets%ROWTYPE;
  v_room public.estimator_rooms%ROWTYPE;
  v_next_current_ticket_id uuid;
  v_remaining_ticket_ids uuid[];
BEGIN
  SELECT room_id, member_id, member_nickname
    INTO v_room_id, v_member_id, v_member_nickname
  FROM public.estimator_validate_room_member(_room_token, _member_id, _member_secret);

  SELECT *
    INTO v_room
  FROM public.estimator_rooms
  WHERE id = v_room_id
  FOR UPDATE;

  SELECT *
    INTO v_ticket
  FROM public.estimator_tickets
  WHERE id = _ticket_id
    AND room_id = v_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  SELECT id
    INTO v_next_current_ticket_id
  FROM public.estimator_tickets
  WHERE room_id = v_room_id
    AND id <> v_ticket.id
    AND sort_order > v_ticket.sort_order
  ORDER BY sort_order ASC, id ASC
  LIMIT 1;

  IF v_next_current_ticket_id IS NULL THEN
    SELECT id
      INTO v_next_current_ticket_id
    FROM public.estimator_tickets
    WHERE room_id = v_room_id
      AND id <> v_ticket.id
      AND sort_order < v_ticket.sort_order
    ORDER BY sort_order DESC, id DESC
    LIMIT 1;
  END IF;

  SELECT coalesce(array_agg(id ORDER BY sort_order, id), ARRAY[]::uuid[])
    INTO v_remaining_ticket_ids
  FROM (
    SELECT id, sort_order
    FROM public.estimator_tickets
    WHERE room_id = v_room_id
      AND id <> v_ticket.id
    ORDER BY sort_order, id
    FOR UPDATE
  ) ordered_tickets;

  DELETE FROM public.estimator_tickets
  WHERE id = v_ticket.id;

  WITH ordered AS (
    SELECT ticket_id, ordinality - 1 AS next_sort_order
    FROM unnest(v_remaining_ticket_ids) WITH ORDINALITY AS ordered_ids(ticket_id, ordinality)
  )
  UPDATE public.estimator_tickets AS tickets
  SET sort_order = -1000 - ordered.next_sort_order
  FROM ordered
  WHERE tickets.id = ordered.ticket_id;

  WITH ordered AS (
    SELECT ticket_id, ordinality - 1 AS next_sort_order
    FROM unnest(v_remaining_ticket_ids) WITH ORDINALITY AS ordered_ids(ticket_id, ordinality)
  )
  UPDATE public.estimator_tickets AS tickets
  SET sort_order = ordered.next_sort_order,
      updated_at = now()
  FROM ordered
  WHERE tickets.id = ordered.ticket_id;

  UPDATE public.estimator_rooms
  SET current_ticket_id = CASE
        WHEN v_room.current_ticket_id = v_ticket.id THEN v_next_current_ticket_id
        ELSE v_room.current_ticket_id
      END,
      updated_at = now()
  WHERE id = v_room_id;

  RETURN jsonb_build_object(
    'ticketId', v_ticket.id,
    'currentTicketId', CASE
      WHEN v_room.current_ticket_id = v_ticket.id THEN v_next_current_ticket_id
      ELSE v_room.current_ticket_id
    END
  );
END;
$$;
