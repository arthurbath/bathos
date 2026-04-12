ALTER TABLE public.estimator_tickets
  ADD COLUMN IF NOT EXISTS official_size_rank text;

ALTER TABLE public.estimator_tickets
  DROP CONSTRAINT IF EXISTS estimator_tickets_official_size_rank_value;

ALTER TABLE public.estimator_tickets
  ADD CONSTRAINT estimator_tickets_official_size_rank_value
  CHECK (official_size_rank IS NULL OR official_size_rank IN ('1', '2', '3', '4', '5', '6', '7'));

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
        'voteCount', ticket_rows.vote_count,
        'officialSizeValue', public.estimator_vote_label_from_rank(v_room.voting_mode, ticket_rows.official_size_rank)
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
      t.official_size_rank,
      COUNT(v.id)::integer AS vote_count
    FROM public.estimator_tickets t
    LEFT JOIN public.estimator_votes v
      ON v.ticket_id = t.id
    WHERE t.room_id = v_room_id
    GROUP BY t.id, t.title, t.sort_order, t.revealed_at, t.official_size_rank
  ) AS ticket_rows;

  IF v_room.current_ticket_id IS NOT NULL THEN
    SELECT *
      INTO v_current_ticket
    FROM public.estimator_tickets
    WHERE id = v_room.current_ticket_id
      AND room_id = v_room_id;
  END IF;

  IF v_current_ticket.id IS NOT NULL THEN
    SELECT public.estimator_vote_label_from_rank(v_room.voting_mode, vote_value)
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
            WHEN v_current_ticket.revealed_at IS NOT NULL THEN public.estimator_vote_label_from_rank(v_room.voting_mode, member_rows.vote_value)
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
            'voteValue', public.estimator_vote_label_from_rank(v_room.voting_mode, history_rows.vote_value),
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
      'currentMemberVoteValue', v_current_member_vote_value,
      'officialSizeValue', public.estimator_vote_label_from_rank(v_room.voting_mode, v_current_ticket.official_size_rank)
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

CREATE OR REPLACE FUNCTION public.estimator_set_ticket_official_size(
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
  v_room public.estimator_rooms%ROWTYPE;
  v_ticket public.estimator_tickets%ROWTYPE;
  v_vote_value text := NULLIF(btrim(coalesce(_vote_value, '')), '');
  v_vote_rank text;
BEGIN
  IF v_vote_value IS NULL THEN
    RAISE EXCEPTION 'Official size is required';
  END IF;

  SELECT room_id
    INTO v_room_id
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

  IF v_ticket.revealed_at IS NULL THEN
    RAISE EXCEPTION 'Votes must be revealed before selecting an official size';
  END IF;

  v_vote_rank := public.estimator_vote_rank_from_label(v_room.voting_mode, v_vote_value);
  IF v_vote_rank IS NULL THEN
    RAISE EXCEPTION 'Official size is invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.estimator_votes
    WHERE ticket_id = v_ticket.id
      AND vote_value = v_vote_rank
  ) THEN
    RAISE EXCEPTION 'Official size must match a value in the vote spread';
  END IF;

  UPDATE public.estimator_tickets
  SET official_size_rank = v_vote_rank,
      updated_at = now()
  WHERE id = v_ticket.id;

  UPDATE public.estimator_rooms
  SET updated_at = now()
  WHERE id = v_room_id;

  RETURN jsonb_build_object(
    'ticketId', v_ticket.id,
    'officialSizeValue', public.estimator_vote_label_from_rank(v_room.voting_mode, v_vote_rank)
  );
END;
$$;

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
      official_size_rank = NULL,
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
      official_size_rank = NULL,
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

REVOKE ALL ON FUNCTION public.estimator_set_ticket_official_size(text, uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estimator_set_ticket_official_size(text, uuid, text, uuid, text) TO anon, authenticated;
