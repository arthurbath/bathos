-- Adopt Supabase's explicit Data API exposure model for future objects.
-- Existing table grants are preserved; future public tables must opt in.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES FROM anon, authenticated, service_role;

-- Public/authenticated terms lookup used before and after sign-up.
GRANT SELECT ON TABLE public.bathos_terms_versions TO anon, authenticated, service_role;

-- Feedback inserts return created_at to the caller, so SELECT is intentional.
GRANT SELECT, INSERT ON TABLE public.bathos_feedback TO anon, authenticated, service_role;

-- Auth rate limiting is accessed by Edge Functions using the service role.
GRANT SELECT, INSERT, DELETE ON TABLE public.bathos_auth_rate_limits TO service_role;

-- Exercise is an authenticated, RLS-protected admin module.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.exercise_definitions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.exercise_routines TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.exercise_routine_items TO authenticated, service_role;
