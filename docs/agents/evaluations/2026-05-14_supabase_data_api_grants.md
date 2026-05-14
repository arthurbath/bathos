# Supabase Data API Grant Change

**Date:** 2026-05-14
**Category:** Technology / Security

## Supabase Notice

Supabase announced that new tables in the `public` schema will no longer be exposed to the Data API automatically. The May 13, 2026 email says:

- New projects get the new default on May 30, 2026.
- Existing projects get the new default on October 30, 2026.
- Existing tables keep current grants.
- New `public` tables need explicit `GRANT` statements before `supabase-js`, PostgREST, or GraphQL can access them.

The public Supabase discussion is:
https://github.com/orgs/supabase/discussions/45329

## BathOS Exposure

BathOS is affected in principle because it uses `@supabase/supabase-js` from the browser and Edge Functions:

- Browser client: `src/integrations/supabase/client.ts`
- Direct table calls: Budget, Drawers, Garage, Exercise, Wardrobe, terms, feedback, profile/settings/admin surfaces
- RPC calls: Budget, Drawers, Estimator, Garage import, household management
- Edge Functions with service-role Supabase clients: feedback submission, auth rate limiting, user deletion, admin deletion

## Live Project Check

The linked Supabase project `rsqfokyqntmtdejfwmjs` currently has grants for all existing public tables. That means the current production database should not break merely because of the October 30, 2026 existing-project rollout, assuming Supabase preserves existing object grants as stated.

Estimator tables intentionally do not grant `anon` or `authenticated` direct table access. The module uses explicit RPC grants instead, which matches the module design.

## Migration Replay Gap

Several migrations create tables that are used through the Data API but do not contain explicit table grants in the same migration. They currently rely on earlier default-privilege migrations or the old Supabase project default:

- `bathos_terms_versions`
- `bathos_feedback`
- `bathos_auth_rate_limits`
- `exercise_definitions`
- `exercise_routines`
- `exercise_routine_items`

This is the real compliance/update gap. A fresh project or reset under the new Supabase default could replay these migrations without the expected API role grants unless a later migration explicitly grants them.

## Recommendation

Add a new idempotent migration that opts out of future default public-table exposure and makes intended API exposure explicit for current tables:

- Revoke default table and sequence privileges for future objects in `public` from `anon`, `authenticated`, and `service_role`.
- `GRANT SELECT ON public.bathos_terms_versions TO anon, authenticated, service_role;`
- `GRANT SELECT, INSERT ON public.bathos_feedback TO anon, authenticated, service_role;`
- `GRANT SELECT, INSERT, DELETE ON public.bathos_auth_rate_limits TO service_role;`
- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_definitions TO authenticated, service_role;`
- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_routines TO authenticated, service_role;`
- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_routine_items TO authenticated, service_role;`

Do not grant direct `anon` or `authenticated` access to Estimator tables; those are intentionally RPC-only.

For all future table-creating migrations, put the intended `GRANT` statements next to `ENABLE ROW LEVEL SECURITY` and the RLS policies instead of relying on default privileges.

## Changes Made

Created and applied migration `supabase/migrations/20260514210027_explicit_data_api_grants.sql` with the explicit grants and default-privilege revokes above. No runtime code was changed.

## Verification

- `supabase db push --dry-run` showed one pending migration: `20260514210027_explicit_data_api_grants.sql`.
- `supabase db push --yes` applied the migration to linked project `rsqfokyqntmtdejfwmjs`.
- `supabase migration list` showed local and remote migration `20260514210027` aligned.
- A rollback-only probe table confirmed future public tables no longer receive `SELECT`, `INSERT`, `UPDATE`, or `DELETE` privileges for `anon`, `authenticated`, or `service_role` by default.
