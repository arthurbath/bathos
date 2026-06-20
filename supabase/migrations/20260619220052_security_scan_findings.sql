-- Tighten Lovable security-scan findings around household joins and RPC access.

-- Household joins must go through the invite-code RPCs. A direct INSERT policy
-- lets any authenticated user add themselves to a known household UUID.
DROP POLICY IF EXISTS "Users can join households" ON public.budget_household_members;
DROP POLICY IF EXISTS "Authenticated users can join drawers households" ON public.drawers_household_members;

REVOKE INSERT ON TABLE public.budget_household_members FROM authenticated;
REVOKE INSERT ON TABLE public.drawers_household_members FROM authenticated;

-- Supabase/PostgREST functions are executable by PUBLIC by default unless
-- revoked. Remove that implicit execute path and grant only intended API RPCs.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;

-- RLS helper functions used by authenticated table policies.
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_drawers_household_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Budget RPCs.
GRANT EXECUTE ON FUNCTION public.budget_reassign_category_and_delete(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_reassign_linked_account_and_delete(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_create_household_for_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_join_household_for_current_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_update_partner_names(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_update_partner_settings(uuid, text, text, boolean, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_restore_household_snapshot(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_list_household_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_rotate_household_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_remove_household_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_leave_household(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_delete_household(uuid) TO authenticated;

-- Drawers RPCs.
GRANT EXECUTE ON FUNCTION public.drawers_save_unit(uuid, uuid, text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_drawers_drawer(uuid, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_drawers_drawer_to_limbo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_drawers_insert(uuid, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_drawers_insert_to_limbo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_drawers_unit_drawers_to_limbo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resize_drawers_unit(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.drawers_create_household_for_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.drawers_join_household_for_current_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.drawers_list_household_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.drawers_rotate_household_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.drawers_remove_household_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.drawers_leave_household(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.drawers_delete_household(uuid) TO authenticated;

-- Garage import RPC.
GRANT EXECUTE ON FUNCTION public.garage_import_services_csv(uuid, jsonb) TO authenticated;

-- Estimator is a deliberately public, token-gated module.
GRANT EXECUTE ON FUNCTION public.estimator_create_room(text, public.estimator_voting_mode) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_resolve_join_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_join_or_resume_room(text, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_get_room_snapshot(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_room_heartbeat(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_rename_room_member(text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_rename_room(text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_add_ticket(text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_update_ticket_title(text, uuid, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_remove_ticket(text, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_move_ticket(text, uuid, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_reorder_ticket(text, uuid, text, uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_set_current_ticket(text, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_set_room_voting_mode(text, uuid, text, public.estimator_voting_mode) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_cast_vote(text, uuid, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_reveal_ticket_votes(text, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_reopen_ticket_voting(text, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_reset_ticket_voting(text, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_kick_room_member(text, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_set_ticket_official_size(text, uuid, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimator_clear_ticket_official_size(text, uuid, text, uuid) TO anon, authenticated;

-- Invite-code lookup helpers are private implementation details of join RPCs.
REVOKE EXECUTE ON FUNCTION public.lookup_household_by_invite_code(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lookup_drawers_household_by_invite_code(text) FROM PUBLIC, anon, authenticated;
