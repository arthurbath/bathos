## Why

The Raycast webpage workflow spends 2.69 to 3.47 seconds in the BathOS submission stage even when OAuth is served from the local cache. The generic `create_task` MCP handler currently performs five sequential Supabase Data API requests for an ordinary unassigned webpage capture: creation-history preflight, planning-order lookup, task insert, creation-event readback, and current-task readback. The database already provides atomic single-RPC capture services for Mail and Watch workflows, so generic MCP creation should use the same boundary.

## What Changes

- Add one authenticated transactional database procedure for generic MCP task creation.
- Move owner-scoped idempotency resolution, area validation, planning-date validation, order allocation, task insertion, and receipt readback into that procedure.
- Serialize concurrent exact retries and planning-tail allocation with transaction-scoped advisory locks.
- Preserve the existing `create_task` schema, normalization rules, owner-safe result, immutable creation receipt, provenance, and exact-retry behavior.
- Replace the MCP handler's sequential Data API operations with one Supabase RPC call.
- Add database and TypeScript coverage for privileges, ownership, exact retries, changed retries, rollback, order allocation, and the single-call boundary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mcp-module-actions`: Require generic Tasks MCP creation to execute through one owner-scoped transactional database procedure while preserving the existing mutation-safety contract.

## Impact

- Tasks MCP creation handler and tests under `src/lib/mcp/tools/`.
- Supabase generated database types.
- One new authenticated Postgres RPC and its migration/database tests.
- Generated `supabase/functions/mcp/index.ts` bundle after the canonical handler changes.
- No MCP request-schema, Tasks table, RLS-policy, native-client, PowerSync, or Raycast payload change.
