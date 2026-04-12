CREATE OR REPLACE FUNCTION public.estimator_clear_ticket_official_size(
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
  SET official_size_rank = NULL,
      updated_at = now()
  WHERE id = _ticket_id
    AND room_id = v_room_id
    AND revealed_at IS NOT NULL
  RETURNING id INTO v_ticket_id;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  UPDATE public.estimator_rooms
  SET updated_at = now()
  WHERE id = v_room_id;

  RETURN jsonb_build_object(
    'ticketId', v_ticket_id,
    'officialSizeValue', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.estimator_clear_ticket_official_size(text, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estimator_clear_ticket_official_size(text, uuid, text, uuid) TO anon, authenticated;
