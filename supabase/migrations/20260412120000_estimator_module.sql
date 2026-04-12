DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'estimator_voting_mode' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.estimator_voting_mode AS ENUM ('ballpark', 'fibonacci');
  END IF;
END
$$;

CREATE TABLE public.estimator_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  room_token text NOT NULL UNIQUE,
  join_code text NOT NULL UNIQUE,
  voting_mode public.estimator_voting_mode NOT NULL,
  current_ticket_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estimator_rooms_room_token_format CHECK (room_token ~ '^[0-9]{18}$'),
  CONSTRAINT estimator_rooms_join_code_format CHECK (join_code ~ '^[A-Z0-9]{6}$')
);

CREATE TABLE public.estimator_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.estimator_rooms(id) ON DELETE CASCADE,
  member_secret_hash text NOT NULL,
  nickname text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  kicked_at timestamptz,
  kicked_by_member_id uuid REFERENCES public.estimator_room_members(id),
  CONSTRAINT estimator_room_members_id_room_unique UNIQUE (id, room_id),
  CONSTRAINT estimator_room_members_nickname_not_blank CHECK (length(btrim(nickname)) > 0),
  CONSTRAINT estimator_room_members_secret_hash_format CHECK (member_secret_hash ~ '^[0-9a-f]{32}$')
);

CREATE TABLE public.estimator_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.estimator_rooms(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL,
  revealed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estimator_tickets_id_room_unique UNIQUE (id, room_id),
  CONSTRAINT estimator_tickets_room_sort_unique UNIQUE (room_id, sort_order),
  CONSTRAINT estimator_tickets_title_not_blank CHECK (length(btrim(title)) > 0)
);

CREATE TABLE public.estimator_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.estimator_rooms(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL,
  member_id uuid NOT NULL,
  nickname_snapshot text NOT NULL,
  vote_value text NOT NULL,
  voted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estimator_votes_ticket_member_unique UNIQUE (ticket_id, member_id),
  CONSTRAINT estimator_votes_nickname_snapshot_not_blank CHECK (length(btrim(nickname_snapshot)) > 0),
  CONSTRAINT estimator_votes_vote_value_not_blank CHECK (length(btrim(vote_value)) > 0),
  CONSTRAINT estimator_votes_ticket_room_fk
    FOREIGN KEY (ticket_id, room_id)
    REFERENCES public.estimator_tickets(id, room_id)
    ON DELETE CASCADE,
  CONSTRAINT estimator_votes_member_room_fk
    FOREIGN KEY (member_id, room_id)
    REFERENCES public.estimator_room_members(id, room_id)
    ON DELETE CASCADE
);

CREATE INDEX estimator_room_members_room_active_idx
  ON public.estimator_room_members(room_id, created_at, id)
  WHERE kicked_at IS NULL;

CREATE INDEX estimator_room_members_room_last_seen_idx
  ON public.estimator_room_members(room_id, last_seen_at DESC);

CREATE INDEX estimator_tickets_room_sort_idx
  ON public.estimator_tickets(room_id, sort_order, id);

CREATE INDEX estimator_votes_room_ticket_idx
  ON public.estimator_votes(room_id, ticket_id);

CREATE INDEX estimator_votes_room_member_idx
  ON public.estimator_votes(room_id, member_id);

ALTER TABLE public.estimator_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimator_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimator_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimator_votes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.estimator_rooms FROM anon, authenticated;
REVOKE ALL ON TABLE public.estimator_room_members FROM anon, authenticated;
REVOKE ALL ON TABLE public.estimator_tickets FROM anon, authenticated;
REVOKE ALL ON TABLE public.estimator_votes FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.estimator_random_numeric_token(_length integer)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_result text := '';
  v_index integer := 0;
BEGIN
  IF _length < 1 THEN
    RAISE EXCEPTION 'Token length must be positive';
  END IF;

  FOR v_index IN 1.._length LOOP
    v_result := v_result || substr('0123456789', 1 + floor(random() * 10)::integer, 1);
  END LOOP;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_random_join_code(_length integer)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_result text := '';
  v_index integer := 0;
BEGIN
  IF _length < 1 THEN
    RAISE EXCEPTION 'Code length must be positive';
  END IF;

  FOR v_index IN 1.._length LOOP
    v_result := v_result || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
  END LOOP;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_normalize_join_code(_join_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT upper(regexp_replace(trim(coalesce(_join_code, '')), '\s+', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.estimator_normalize_room_token(_room_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT trim(coalesce(_room_token, ''));
$$;

CREATE OR REPLACE FUNCTION public.estimator_is_vote_value_allowed(
  _voting_mode public.estimator_voting_mode,
  _vote_value text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _voting_mode = 'ballpark' THEN _vote_value IN ('XS', 'S', 'M', 'L', 'XL', 'XXL')
    WHEN _voting_mode = 'fibonacci' THEN _vote_value IN ('1', '2', '3', '5', '8', '13', '21')
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_validate_room_member(
  _room_token text,
  _member_id uuid,
  _member_secret text
)
RETURNS TABLE (
  room_id uuid,
  member_id uuid,
  member_nickname text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_room_token text := public.estimator_normalize_room_token(_room_token);
  v_member_secret text := trim(coalesce(_member_secret, ''));
BEGIN
  IF v_room_token = '' THEN
    RAISE EXCEPTION 'Room token is required';
  END IF;

  IF _member_id IS NULL OR v_member_secret = '' THEN
    RAISE EXCEPTION 'Room access denied';
  END IF;

  RETURN QUERY
  SELECT r.id, m.id, m.nickname
  FROM public.estimator_rooms r
  JOIN public.estimator_room_members m
    ON m.room_id = r.id
  WHERE r.room_token = v_room_token
    AND m.id = _member_id
    AND m.member_secret_hash = md5(v_member_secret)
    AND m.kicked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room access denied';
  END IF;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.estimator_resolve_join_code(_join_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_join_code text := public.estimator_normalize_join_code(_join_code);
  v_room_token text;
BEGIN
  IF v_join_code = '' THEN
    RAISE EXCEPTION 'Join code is required';
  END IF;

  SELECT room_token
    INTO v_room_token
  FROM public.estimator_rooms
  WHERE join_code = v_join_code;

  IF v_room_token IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  RETURN v_room_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_join_or_resume_room(
  _room_token text,
  _nickname text DEFAULT NULL,
  _member_id uuid DEFAULT NULL,
  _member_secret text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_room public.estimator_rooms%ROWTYPE;
  v_member public.estimator_room_members%ROWTYPE;
  v_nickname text := NULLIF(btrim(coalesce(_nickname, '')), '');
  v_member_secret text := trim(coalesce(_member_secret, ''));
  v_new_secret text;
  v_room_token text := public.estimator_normalize_room_token(_room_token);
BEGIN
  IF v_room_token = '' THEN
    RAISE EXCEPTION 'Room token is required';
  END IF;

  SELECT *
    INTO v_room
  FROM public.estimator_rooms
  WHERE room_token = v_room_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF _member_id IS NOT NULL AND v_member_secret <> '' THEN
    UPDATE public.estimator_room_members
    SET last_seen_at = now(),
        updated_at = now()
    WHERE room_id = v_room.id
      AND id = _member_id
      AND member_secret_hash = md5(v_member_secret)
      AND kicked_at IS NULL
    RETURNING * INTO v_member;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'room', jsonb_build_object(
          'name', v_room.name,
          'roomToken', v_room.room_token,
          'joinCode', v_room.join_code,
          'votingMode', v_room.voting_mode
        ),
        'member', jsonb_build_object(
          'memberId', v_member.id,
          'nickname', v_member.nickname
        )
      );
    END IF;
  END IF;

  IF v_nickname IS NULL THEN
    RAISE EXCEPTION 'Nickname is required';
  END IF;

  v_new_secret := md5(gen_random_uuid()::text || clock_timestamp()::text || v_room.id::text || v_nickname);

  INSERT INTO public.estimator_room_members (
    room_id,
    member_secret_hash,
    nickname,
    last_seen_at
  )
  VALUES (
    v_room.id,
    md5(v_new_secret),
    v_nickname,
    now()
  )
  RETURNING * INTO v_member;

  RETURN jsonb_build_object(
    'room', jsonb_build_object(
      'name', v_room.name,
      'roomToken', v_room.room_token,
      'joinCode', v_room.join_code,
      'votingMode', v_room.voting_mode
    ),
    'member', jsonb_build_object(
      'memberId', v_member.id,
      'nickname', v_member.nickname,
      'memberSecret', v_new_secret
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_get_room_snapshot(
  _room_token text,
  _member_id uuid,
  _member_secret text
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
  v_room public.estimator_rooms%ROWTYPE;
  v_current_ticket public.estimator_tickets%ROWTYPE;
  v_tickets jsonb := '[]'::jsonb;
  v_active_members jsonb := '[]'::jsonb;
  v_historical_voters jsonb := '[]'::jsonb;
  v_current_ticket_json jsonb := 'null'::jsonb;
  v_current_member_vote_value text;
BEGIN
  SELECT room_id, member_id, member_nickname
    INTO v_room_id, v_member_id, v_member_nickname
  FROM public.estimator_validate_room_member(_room_token, _member_id, _member_secret);

  SELECT *
    INTO v_room
  FROM public.estimator_rooms
  WHERE id = v_room_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ticket_rows.id,
        'title', ticket_rows.title,
        'sortOrder', ticket_rows.sort_order,
        'isCurrent', ticket_rows.id = v_room.current_ticket_id,
        'revealedAt', ticket_rows.revealed_at,
        'isRevealed', ticket_rows.revealed_at IS NOT NULL,
        'hasVotes', ticket_rows.vote_count > 0,
        'voteCount', ticket_rows.vote_count
      )
      ORDER BY ticket_rows.sort_order, ticket_rows.id
    ),
    '[]'::jsonb
  )
    INTO v_tickets
  FROM (
    SELECT
      t.id,
      t.title,
      t.sort_order,
      t.revealed_at,
      COUNT(v.id)::integer AS vote_count
    FROM public.estimator_tickets t
    LEFT JOIN public.estimator_votes v
      ON v.ticket_id = t.id
    WHERE t.room_id = v_room_id
    GROUP BY t.id, t.title, t.sort_order, t.revealed_at
  ) AS ticket_rows;

  IF v_room.current_ticket_id IS NOT NULL THEN
    SELECT *
      INTO v_current_ticket
    FROM public.estimator_tickets
    WHERE id = v_room.current_ticket_id
      AND room_id = v_room_id;
  END IF;

  IF v_current_ticket.id IS NOT NULL THEN
    SELECT vote_value
      INTO v_current_member_vote_value
    FROM public.estimator_votes
    WHERE ticket_id = v_current_ticket.id
      AND member_id = v_member_id;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'memberId', member_rows.id,
          'nickname', member_rows.nickname,
          'isSelf', member_rows.id = v_member_id,
          'isPresent', member_rows.last_seen_at >= now() - interval '10 seconds',
          'lastSeenAt', member_rows.last_seen_at,
          'hasVoted', member_rows.vote_id IS NOT NULL,
          'voteValue', CASE
            WHEN v_current_ticket.revealed_at IS NOT NULL THEN member_rows.vote_value
            ELSE NULL
          END,
          'votedAt', member_rows.voted_at
        )
        ORDER BY lower(member_rows.nickname), member_rows.created_at, member_rows.id
      ),
      '[]'::jsonb
    )
      INTO v_active_members
    FROM (
      SELECT
        m.id,
        m.nickname,
        m.created_at,
        m.last_seen_at,
        v.id AS vote_id,
        v.vote_value,
        v.voted_at
      FROM public.estimator_room_members m
      LEFT JOIN public.estimator_votes v
        ON v.ticket_id = v_current_ticket.id
       AND v.member_id = m.id
      WHERE m.room_id = v_room_id
        AND m.kicked_at IS NULL
    ) AS member_rows;

    IF v_current_ticket.revealed_at IS NOT NULL THEN
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'memberId', history_rows.member_id,
            'nickname', history_rows.nickname_snapshot,
            'voteValue', history_rows.vote_value,
            'votedAt', history_rows.voted_at
          )
          ORDER BY lower(history_rows.nickname_snapshot), history_rows.voted_at, history_rows.member_id
        ),
        '[]'::jsonb
      )
        INTO v_historical_voters
      FROM (
        SELECT v.member_id, v.nickname_snapshot, v.vote_value, v.voted_at
        FROM public.estimator_votes v
        LEFT JOIN public.estimator_room_members m
          ON m.id = v.member_id
        WHERE v.ticket_id = v_current_ticket.id
          AND (m.id IS NULL OR m.kicked_at IS NOT NULL)
      ) AS history_rows;
    END IF;

    v_current_ticket_json := jsonb_build_object(
      'id', v_current_ticket.id,
      'title', v_current_ticket.title,
      'sortOrder', v_current_ticket.sort_order,
      'revealedAt', v_current_ticket.revealed_at,
      'isRevealed', v_current_ticket.revealed_at IS NOT NULL,
      'voteCount', (
        SELECT COUNT(*)::integer
        FROM public.estimator_votes
        WHERE ticket_id = v_current_ticket.id
      ),
      'votedCount', (
        SELECT COUNT(*)::integer
        FROM public.estimator_room_members m
        JOIN public.estimator_votes v
          ON v.member_id = m.id
         AND v.ticket_id = v_current_ticket.id
        WHERE m.room_id = v_room_id
          AND m.kicked_at IS NULL
      ),
      'currentMemberVoteValue', v_current_member_vote_value
    );
  ELSE
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'memberId', member_rows.id,
          'nickname', member_rows.nickname,
          'isSelf', member_rows.id = v_member_id,
          'isPresent', member_rows.last_seen_at >= now() - interval '10 seconds',
          'lastSeenAt', member_rows.last_seen_at,
          'hasVoted', false,
          'voteValue', NULL,
          'votedAt', NULL
        )
        ORDER BY lower(member_rows.nickname), member_rows.created_at, member_rows.id
      ),
      '[]'::jsonb
    )
      INTO v_active_members
    FROM (
      SELECT m.id, m.nickname, m.created_at, m.last_seen_at
      FROM public.estimator_room_members m
      WHERE m.room_id = v_room_id
        AND m.kicked_at IS NULL
    ) AS member_rows;
  END IF;

  RETURN jsonb_build_object(
    'room', jsonb_build_object(
      'name', v_room.name,
      'roomToken', v_room.room_token,
      'joinCode', v_room.join_code,
      'votingMode', v_room.voting_mode,
      'currentTicketId', v_room.current_ticket_id,
      'currentMemberId', v_member_id,
      'currentMemberNickname', v_member_nickname
    ),
    'tickets', v_tickets,
    'currentTicket', v_current_ticket_json,
    'activeMembers', v_active_members,
    'historicalVoters', v_historical_voters
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_room_heartbeat(
  _room_token text,
  _member_id uuid,
  _member_secret text
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
  v_last_seen_at timestamptz;
BEGIN
  SELECT room_id, member_id, member_nickname
    INTO v_room_id, v_member_id, v_member_nickname
  FROM public.estimator_validate_room_member(_room_token, _member_id, _member_secret);

  UPDATE public.estimator_room_members
  SET last_seen_at = now(),
      updated_at = now()
  WHERE id = v_member_id
  RETURNING last_seen_at INTO v_last_seen_at;

  RETURN jsonb_build_object(
    'memberId', v_member_id,
    'lastSeenAt', v_last_seen_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_rename_room_member(
  _room_token text,
  _member_id uuid,
  _member_secret text,
  _nickname text
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
  v_nickname text := NULLIF(btrim(coalesce(_nickname, '')), '');
BEGIN
  IF v_nickname IS NULL THEN
    RAISE EXCEPTION 'Nickname is required';
  END IF;

  SELECT room_id, member_id, member_nickname
    INTO v_room_id, v_member_id, v_member_nickname
  FROM public.estimator_validate_room_member(_room_token, _member_id, _member_secret);

  UPDATE public.estimator_room_members
  SET nickname = v_nickname,
      updated_at = now(),
      last_seen_at = now()
  WHERE id = v_member_id;

  RETURN jsonb_build_object(
    'memberId', v_member_id,
    'nickname', v_nickname
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_add_ticket(
  _room_token text,
  _member_id uuid,
  _member_secret text,
  _title text
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
  v_title text := NULLIF(btrim(coalesce(_title, '')), '');
  v_sort_order integer;
  v_ticket public.estimator_tickets%ROWTYPE;
  v_current_ticket_id uuid;
BEGIN
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Ticket title is required';
  END IF;

  SELECT room_id, member_id, member_nickname
    INTO v_room_id, v_member_id, v_member_nickname
  FROM public.estimator_validate_room_member(_room_token, _member_id, _member_secret);

  SELECT current_ticket_id
    INTO v_current_ticket_id
  FROM public.estimator_rooms
  WHERE id = v_room_id
  FOR UPDATE;

  SELECT COALESCE(MAX(sort_order), -1) + 1
    INTO v_sort_order
  FROM public.estimator_tickets
  WHERE room_id = v_room_id;

  INSERT INTO public.estimator_tickets (room_id, title, sort_order)
  VALUES (v_room_id, v_title, v_sort_order)
  RETURNING * INTO v_ticket;

  IF v_current_ticket_id IS NULL THEN
    UPDATE public.estimator_rooms
    SET current_ticket_id = v_ticket.id,
        updated_at = now()
    WHERE id = v_room_id;
  ELSE
    UPDATE public.estimator_rooms
    SET updated_at = now()
    WHERE id = v_room_id;
  END IF;

  RETURN jsonb_build_object(
    'ticketId', v_ticket.id,
    'title', v_ticket.title
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_update_ticket_title(
  _room_token text,
  _member_id uuid,
  _member_secret text,
  _ticket_id uuid,
  _title text
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
  v_title text := NULLIF(btrim(coalesce(_title, '')), '');
BEGIN
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Ticket title is required';
  END IF;

  SELECT room_id, member_id, member_nickname
    INTO v_room_id, v_member_id, v_member_nickname
  FROM public.estimator_validate_room_member(_room_token, _member_id, _member_secret);

  UPDATE public.estimator_tickets
  SET title = v_title,
      updated_at = now()
  WHERE id = _ticket_id
    AND room_id = v_room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  UPDATE public.estimator_rooms
  SET updated_at = now()
  WHERE id = v_room_id;

  RETURN jsonb_build_object(
    'ticketId', _ticket_id,
    'title', v_title
  );
END;
$$;

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

  DELETE FROM public.estimator_tickets
  WHERE id = v_ticket.id;

  UPDATE public.estimator_tickets
  SET sort_order = sort_order - 1,
      updated_at = now()
  WHERE room_id = v_room_id
    AND sort_order > v_ticket.sort_order;

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

CREATE OR REPLACE FUNCTION public.estimator_move_ticket(
  _room_token text,
  _member_id uuid,
  _member_secret text,
  _ticket_id uuid,
  _direction text
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
  v_direction text := lower(trim(coalesce(_direction, '')));
  v_ticket public.estimator_tickets%ROWTYPE;
  v_swap_ticket public.estimator_tickets%ROWTYPE;
  v_temp_sort integer;
BEGIN
  IF v_direction NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'Direction must be up or down';
  END IF;

  SELECT room_id, member_id, member_nickname
    INTO v_room_id, v_member_id, v_member_nickname
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

  IF v_direction = 'up' THEN
    SELECT *
      INTO v_swap_ticket
    FROM public.estimator_tickets
    WHERE room_id = v_room_id
      AND sort_order < v_ticket.sort_order
    ORDER BY sort_order DESC, id DESC
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT *
      INTO v_swap_ticket
    FROM public.estimator_tickets
    WHERE room_id = v_room_id
      AND sort_order > v_ticket.sort_order
    ORDER BY sort_order ASC, id ASC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_swap_ticket.id IS NULL THEN
    RETURN jsonb_build_object('ticketId', v_ticket.id, 'swapped', false);
  END IF;

  v_temp_sort := -1 - v_ticket.sort_order;

  UPDATE public.estimator_tickets
  SET sort_order = v_temp_sort,
      updated_at = now()
  WHERE id = v_ticket.id;

  UPDATE public.estimator_tickets
  SET sort_order = v_ticket.sort_order,
      updated_at = now()
  WHERE id = v_swap_ticket.id;

  UPDATE public.estimator_tickets
  SET sort_order = v_swap_ticket.sort_order,
      updated_at = now()
  WHERE id = v_ticket.id;

  UPDATE public.estimator_rooms
  SET updated_at = now()
  WHERE id = v_room_id;

  RETURN jsonb_build_object(
    'ticketId', v_ticket.id,
    'swapped', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_set_current_ticket(
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
BEGIN
  SELECT room_id, member_id, member_nickname
    INTO v_room_id, v_member_id, v_member_nickname
  FROM public.estimator_validate_room_member(_room_token, _member_id, _member_secret);

  IF NOT EXISTS (
    SELECT 1
    FROM public.estimator_tickets
    WHERE id = _ticket_id
      AND room_id = v_room_id
  ) THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  UPDATE public.estimator_rooms
  SET current_ticket_id = _ticket_id,
      updated_at = now()
  WHERE id = v_room_id;

  RETURN jsonb_build_object(
    'currentTicketId', _ticket_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_set_room_voting_mode(
  _room_token text,
  _member_id uuid,
  _member_secret text,
  _voting_mode public.estimator_voting_mode
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
BEGIN
  IF _voting_mode IS NULL THEN
    RAISE EXCEPTION 'Voting mode is required';
  END IF;

  SELECT room_id, member_id, member_nickname
    INTO v_room_id, v_member_id, v_member_nickname
  FROM public.estimator_validate_room_member(_room_token, _member_id, _member_secret);

  UPDATE public.estimator_rooms
  SET voting_mode = _voting_mode,
      updated_at = now()
  WHERE id = v_room_id;

  RETURN jsonb_build_object(
    'votingMode', _voting_mode
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_cast_vote(
  _room_token text,
  _member_id uuid,
  _member_secret text,
  _ticket_id uuid,
  _vote_value text
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
  v_vote_value text := NULLIF(btrim(coalesce(_vote_value, '')), '');
BEGIN
  IF v_vote_value IS NULL THEN
    RAISE EXCEPTION 'Vote value is required';
  END IF;

  SELECT room_id, member_id, member_nickname
    INTO v_room_id, v_member_id, v_member_nickname
  FROM public.estimator_validate_room_member(_room_token, _member_id, _member_secret);

  SELECT *
    INTO v_room
  FROM public.estimator_rooms
  WHERE id = v_room_id;

  SELECT *
    INTO v_ticket
  FROM public.estimator_tickets
  WHERE id = _ticket_id
    AND room_id = v_room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  IF v_ticket.revealed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Votes are already revealed for this ticket';
  END IF;

  IF NOT public.estimator_is_vote_value_allowed(v_room.voting_mode, v_vote_value) THEN
    RAISE EXCEPTION 'Vote value is not valid for the current sizing mode';
  END IF;

  INSERT INTO public.estimator_votes (
    room_id,
    ticket_id,
    member_id,
    nickname_snapshot,
    vote_value,
    voted_at,
    updated_at
  )
  VALUES (
    v_room_id,
    v_ticket.id,
    v_member_id,
    v_member_nickname,
    v_vote_value,
    now(),
    now()
  )
  ON CONFLICT (ticket_id, member_id)
  DO UPDATE SET
    nickname_snapshot = EXCLUDED.nickname_snapshot,
    vote_value = EXCLUDED.vote_value,
    voted_at = now(),
    updated_at = now();

  UPDATE public.estimator_rooms
  SET updated_at = now()
  WHERE id = v_room_id;

  RETURN jsonb_build_object(
    'ticketId', v_ticket.id,
    'memberId', v_member_id,
    'voteValue', v_vote_value
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_reveal_ticket_votes(
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
  v_revealed_at timestamptz;
BEGIN
  SELECT room_id, member_id, member_nickname
    INTO v_room_id, v_member_id, v_member_nickname
  FROM public.estimator_validate_room_member(_room_token, _member_id, _member_secret);

  UPDATE public.estimator_tickets
  SET revealed_at = COALESCE(revealed_at, now()),
      updated_at = now()
  WHERE id = _ticket_id
    AND room_id = v_room_id
  RETURNING revealed_at INTO v_revealed_at;

  IF v_revealed_at IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  UPDATE public.estimator_rooms
  SET updated_at = now()
  WHERE id = v_room_id;

  RETURN jsonb_build_object(
    'ticketId', _ticket_id,
    'revealedAt', v_revealed_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.estimator_kick_room_member(
  _room_token text,
  _member_id uuid,
  _member_secret text,
  _target_member_id uuid
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
  v_kicked_at timestamptz;
BEGIN
  SELECT room_id, member_id, member_nickname
    INTO v_room_id, v_member_id, v_member_nickname
  FROM public.estimator_validate_room_member(_room_token, _member_id, _member_secret);

  IF _target_member_id = v_member_id THEN
    RAISE EXCEPTION 'You cannot kick yourself';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.estimator_room_members
    WHERE id = _target_member_id
      AND room_id = v_room_id
      AND kicked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  DELETE FROM public.estimator_votes v
  USING public.estimator_tickets t
  WHERE v.ticket_id = t.id
    AND v.member_id = _target_member_id
    AND t.room_id = v_room_id
    AND t.revealed_at IS NULL;

  UPDATE public.estimator_room_members
  SET kicked_at = now(),
      kicked_by_member_id = v_member_id,
      updated_at = now()
  WHERE id = _target_member_id
    AND room_id = v_room_id
  RETURNING kicked_at INTO v_kicked_at;

  UPDATE public.estimator_rooms
  SET updated_at = now()
  WHERE id = v_room_id;

  RETURN jsonb_build_object(
    'memberId', _target_member_id,
    'kickedAt', v_kicked_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.estimator_random_numeric_token(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_random_join_code(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_normalize_join_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_normalize_room_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_is_vote_value_allowed(public.estimator_voting_mode, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_validate_room_member(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_create_room(text, public.estimator_voting_mode) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_resolve_join_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_join_or_resume_room(text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_get_room_snapshot(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_room_heartbeat(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_rename_room_member(text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_add_ticket(text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_update_ticket_title(text, uuid, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_remove_ticket(text, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_move_ticket(text, uuid, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_set_current_ticket(text, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_set_room_voting_mode(text, uuid, text, public.estimator_voting_mode) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_cast_vote(text, uuid, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_reveal_ticket_votes(text, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estimator_kick_room_member(text, uuid, text, uuid) FROM PUBLIC;

GRANT USAGE ON TYPE public.estimator_voting_mode TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.estimator_create_room(text, public.estimator_voting_mode) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_resolve_join_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_join_or_resume_room(text, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_get_room_snapshot(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_room_heartbeat(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_rename_room_member(text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_add_ticket(text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_update_ticket_title(text, uuid, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_remove_ticket(text, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_move_ticket(text, uuid, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_set_current_ticket(text, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_set_room_voting_mode(text, uuid, text, public.estimator_voting_mode) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_cast_vote(text, uuid, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_reveal_ticket_votes(text, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_kick_room_member(text, uuid, text, uuid) TO anon, authenticated;
