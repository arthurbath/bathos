-- The Snake membership helper is used by authenticated RLS policies and
-- internal owner-checked services. Keep those explicit callers while removing
-- PostgreSQL's default PUBLIC execution path from the replication login.

REVOKE EXECUTE ON FUNCTION public.is_snake_household_member(uuid, uuid)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_snake_household_member(uuid, uuid)
TO authenticated, service_role;
