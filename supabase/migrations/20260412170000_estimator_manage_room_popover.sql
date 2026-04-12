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

REVOKE ALL ON FUNCTION public.estimator_rename_room(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estimator_rename_room(text, uuid, text, text) TO anon, authenticated;
