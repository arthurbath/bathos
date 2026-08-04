## Why

Raycast webpage capture still spends about 2.7 seconds traversing the general-purpose BathOS MCP Edge Function even after task creation was consolidated into one database transaction. Read-only measurements show that the authenticated MCP path averages about 2.19 seconds while the authenticated Data API path averages about 0.22 seconds. The first-party Raycast workflow should use a narrow direct RPC without changing the general MCP service.

## What Changes

- Add a three-parameter authenticated database function for Raycast webpage capture.
- Fix Anytime placement, Today Inbox horizon, actionable state, browser-capture provenance, empty Notes, and Primary Link behavior inside the database function.
- Delegate task creation to the existing transactional task-creation function so idempotency, ordering, RLS, and receipt semantics remain unchanged.
- Grant execution only to authenticated callers and keep the function under `SECURITY INVOKER`.
- Route Raycast webpage capture directly through the Supabase Data API while preserving the existing OAuth access token and pending-capture recovery.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Add a narrow authenticated direct-RPC path for first-party Raycast webpage capture.

## Impact

- One new public Postgres function, migration, generated type, and database test.
- Raycast page-capture transport and unit coverage in the separate Raycast repository.
- No table, RLS policy, general MCP tool, native client, or PowerSync change.
