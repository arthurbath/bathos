# Design

## Authorization model

`bathos_modules` stores whether a module is restricted. `bathos_module_access_grants` stores explicit grants and administrator-derived grants separately, so removing an administrator role cannot accidentally remove a manual grant.

`bathos_can_access_module(module_id, user_id)` is the shared database authority. It returns true for unrestricted modules, administrators, or users with an explicit grant. Client reads use a narrow current-user RPC. Administration uses security-definer RPCs that verify the caller's administrator role.

Tasks table policies are recreated with a module-access predicate. The PowerSync stream independently filters every Tasks table through `bathos_module_access_grants`, using the supported Sync Streams subquery authorization pattern. Administrator-derived grant rows are maintained by triggers so PowerSync does not need to evaluate PostgreSQL functions.

## Migration and compatibility

The migration registers all launchable non-admin modules, marks Tasks restricted, and inserts administrator-derived Tasks grants before restrictive policies become active. Existing ordinary module behavior is unchanged. Existing Tasks rows are not rewritten.

Old clients remain unable to download Tasks through PowerSync without a grant. Direct PostgREST table access is rejected by RLS. Existing Tasks security-definer functions continue their existing owner checks; the client and synchronized table boundaries prevent module use, while server-only service-role jobs remain operational.

## Revocation

Revocation removes the explicit grant. PowerSync reevaluates its stream and removes synchronized Tasks rows from that user's local database. The route gate also removes access on the next entitlement refresh. Administrators retain access through their administrator-derived grants.

## Rollback

An administrator can mark Tasks unrestricted before reverting the client or stream configuration. No user content needs to be migrated or restored.
