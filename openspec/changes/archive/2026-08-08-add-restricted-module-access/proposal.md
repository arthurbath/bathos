# Change: Add Restricted Module Access

## Why

Some BathOS modules incur per-user infrastructure costs and must not be available to every signed-in account. Tasks currently appears for every user and its PowerSync stream downloads owner data without a module-level entitlement check.

## What Changes

- Add a platform-level restricted-module registry and per-user access grants.
- Treat administrators as entitled to every restricted module.
- Mark Tasks restricted by default and grant current administrators access during migration.
- Hide inaccessible restricted modules from the launcher and reject direct routes.
- Label restricted modules with a purple access badge for non-admin users who have an explicit grant.
- Add administration controls for module restriction and user grants.
- Require the Tasks PowerSync stream and Tasks database policies to honor the same entitlement.

## Impact

- Affected platform: launcher, route authorization, Administration.
- Affected module: Tasks.
- Affected infrastructure: Supabase schema, RLS, RPCs, generated types, PowerSync Sync Streams.
- Existing Tasks data is preserved. Access is seeded for every current administrator before Tasks becomes restricted.
