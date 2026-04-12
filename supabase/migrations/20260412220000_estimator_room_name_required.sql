CREATE OR REPLACE FUNCTION public.estimator_create_room(
  _name text,
  _voting_mode public.estimator_voting_mode
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_room public.estimator_rooms%ROWTYPE;
  v_name text := NULLIF(btrim(coalesce(_name, '')), '');
  v_attempt integer := 0;
BEGIN
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Room name is required';
  END IF;

  IF _voting_mode IS NULL THEN
    RAISE EXCEPTION 'Voting mode is required';
  END IF;

  LOOP
    v_attempt := v_attempt + 1;

    BEGIN
      INSERT INTO public.estimator_rooms (name, room_token, join_code, voting_mode)
      VALUES (
        v_name,
        public.estimator_random_numeric_token(18),
        public.estimator_random_join_code(6),
        _voting_mode
      )
      RETURNING * INTO v_room;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 20 THEN
        RAISE EXCEPTION 'Failed to create room';
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'roomToken', v_room.room_token,
    'joinCode', v_room.join_code,
    'name', v_room.name,
    'votingMode', v_room.voting_mode
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_rename_room(
  _room_token text,
  _member_id uuid,
  _member_secret text,
  _name text
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
  v_name text := NULLIF(btrim(coalesce(_name, '')), '');
BEGIN
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Room name is required';
  END IF;

  SELECT room_id, member_id, member_nickname
    INTO v_room_id, v_member_id, v_member_nickname
  FROM public.estimator_validate_room_member(_room_token, _member_id, _member_secret);

  UPDATE public.estimator_rooms
  SET name = v_name,
      updated_at = now()
  WHERE id = v_room_id;

  RETURN jsonb_build_object(
    'roomId', v_room_id,
    'name', v_name
  );
END;
$$;
