CREATE OR REPLACE FUNCTION public.estimator_reopen_ticket_voting(
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
  v_ticket_id uuid;
BEGIN
  SELECT room_id
    INTO v_room_id
  FROM public.estimator_validate_room_member(_room_token, _member_id, _member_secret);

  UPDATE public.estimator_tickets
  SET revealed_at = NULL,
      updated_at = now()
  WHERE id = _ticket_id
    AND room_id = v_room_id
  RETURNING id INTO v_ticket_id;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  UPDATE public.estimator_rooms
  SET updated_at = now()
  WHERE id = v_room_id;

  RETURN jsonb_build_object(
    'ticketId', v_ticket_id,
    'revealedAt', NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_reset_ticket_voting(
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
  v_ticket_id uuid;
  v_deleted_votes integer := 0;
BEGIN
  SELECT room_id
    INTO v_room_id
  FROM public.estimator_validate_room_member(_room_token, _member_id, _member_secret);

  UPDATE public.estimator_tickets
  SET revealed_at = NULL,
      updated_at = now()
  WHERE id = _ticket_id
    AND room_id = v_room_id
  RETURNING id INTO v_ticket_id;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  DELETE FROM public.estimator_votes
  WHERE room_id = v_room_id
    AND ticket_id = v_ticket_id;

  GET DIAGNOSTICS v_deleted_votes = ROW_COUNT;

  UPDATE public.estimator_rooms
  SET updated_at = now()
  WHERE id = v_room_id;

  RETURN jsonb_build_object(
    'ticketId', v_ticket_id,
    'deletedVotes', v_deleted_votes,
    'revealedAt', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.estimator_reopen_ticket_voting(text, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_reset_ticket_voting(text, uuid, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.estimator_reopen_ticket_voting(text, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_reset_ticket_voting(text, uuid, text, uuid) TO anon, authenticated;
