DROP FUNCTION IF EXISTS public.estimator_add_ticket(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.estimator_cast_vote(text, uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.estimator_clear_ticket_official_size(text, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.estimator_create_room(text, public.estimator_voting_mode);
DROP FUNCTION IF EXISTS public.estimator_get_room_snapshot(text, uuid, text);
DROP FUNCTION IF EXISTS public.estimator_is_vote_value_allowed(public.estimator_voting_mode, text);
DROP FUNCTION IF EXISTS public.estimator_join_or_resume_room(text, text, uuid, text);
DROP FUNCTION IF EXISTS public.estimator_kick_room_member(text, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.estimator_move_ticket(text, uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.estimator_normalize_join_code(text);
DROP FUNCTION IF EXISTS public.estimator_normalize_room_token(text);
DROP FUNCTION IF EXISTS public.estimator_random_join_code(integer);
DROP FUNCTION IF EXISTS public.estimator_random_numeric_token(integer);
DROP FUNCTION IF EXISTS public.estimator_remove_ticket(text, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.estimator_rename_room(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.estimator_rename_room_member(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.estimator_reopen_ticket_voting(text, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.estimator_reorder_ticket(text, uuid, text, uuid, integer);
DROP FUNCTION IF EXISTS public.estimator_reset_ticket_voting(text, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.estimator_resolve_join_code(text);
DROP FUNCTION IF EXISTS public.estimator_reveal_ticket_votes(text, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.estimator_room_heartbeat(text, uuid, text);
DROP FUNCTION IF EXISTS public.estimator_set_current_ticket(text, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.estimator_set_room_voting_mode(text, uuid, text, public.estimator_voting_mode);
DROP FUNCTION IF EXISTS public.estimator_set_ticket_official_size(text, uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.estimator_update_ticket_title(text, uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.estimator_validate_room_member(text, uuid, text);
DROP FUNCTION IF EXISTS public.estimator_vote_label_from_rank(public.estimator_voting_mode, text);
DROP FUNCTION IF EXISTS public.estimator_vote_rank_from_label(public.estimator_voting_mode, text);

DROP TABLE IF EXISTS
  public.estimator_votes,
  public.estimator_room_members,
  public.estimator_tickets,
  public.estimator_rooms
CASCADE;

DROP TYPE IF EXISTS public.estimator_voting_mode;

DROP TABLE IF EXISTS
  public.corpus_document_tags,
  public.corpus_access_tokens,
  public.corpus_documents,
  public.corpus_tags,
  public.corpus_settings
CASCADE;
