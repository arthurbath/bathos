-- Trigger functions run as part of their owning table triggers and must not be
-- directly executable by clients or the PowerSync replication role through
-- PostgreSQL's default PUBLIC function privilege.
REVOKE ALL ON FUNCTION public.bathos_sync_admin_module_grants() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bathos_sync_restricted_module_admin_grants() FROM PUBLIC;
