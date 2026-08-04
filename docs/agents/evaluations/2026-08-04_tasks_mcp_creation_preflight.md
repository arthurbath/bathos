# Tasks MCP Creation Performance Preflight

Date: 2026-08-04

## Outcome

The `accelerate-mcp-task-creation` change is implemented and locally validated. Generic MCP task creation now performs one authenticated Supabase RPC instead of five sequential Data API operations. The RPC keeps validation, owner isolation, idempotency, rank allocation, insertion, trigger-authored history receipt lookup, and current-task readback in one database transaction.

Production has not been changed. The migration and matching MCP Edge Function bundle must be deployed database first before live timing can confirm the improvement.

## Baseline

The four most recent Raycast timing samples before this change were:

| Sample | Total | OpenAI | BathOS |
| --- | ---: | ---: | ---: |
| 1 | 5,978.8 ms | 3,108.7 ms | 2,601.7 ms |
| 2 | 7,421.9 ms | 4,226.6 ms | 3,036.9 ms |
| 3 | 6,350.2 ms | 2,640.2 ms | 3,474.5 ms |
| 4 | 12,476.4 ms | 9,502.9 ms | 2,688.1 ms |

BathOS therefore contributed a stable 2.69 to 3.47 seconds. OpenAI remained more variable at 2.64 to 9.50 seconds. This change targets only the stable BathOS portion.

## Implementation Evidence

- `public.tasks_create_mcp_task` is `SECURITY INVOKER`, derives its owner from `auth.uid()`, uses an empty search path, and grants execution only to `authenticated`.
- Transaction-scoped advisory locks serialize owner-scoped idempotency and planning or hierarchy tail allocation.
- An exact retry returns the original creation receipt and the current task state. Changed reuse is rejected.
- The MCP handler issues one `.rpc('tasks_create_mcp_task', ...)` call and has no sequential table-query fallback.
- The generated MCP Edge Function bundle includes the one-RPC handler.
- Primary Link remains distinct from Notes, and owner identity is omitted from the result.

## Local Validation

- Clean local migration rebuild passed.
- Focused pgTAP: 30 of 30 passed.
- Focused MCP unit tests: 7 of 7 passed.
- TypeScript Tasks typecheck passed.
- Production build and Edge bundle verification passed.
- Strict OpenSpec validation passed for all 47 items.
- Database lint reported no errors and no warning for the new function. Existing warnings remain outside this change.
- Current production advisors were captured as a pre-deployment baseline. They contain 64 security and 136 performance notices, with no reference to the not-yet-deployed function.
- The full application suite passed 1,418 tests with 15 skipped. One unrelated checklist-persistence integration test could not load `better-sqlite3` because its native module was built for Node ABI 137 while the active Node runtime requires ABI 147.
- The complete database suite passed 757 of 759 assertions. Two unrelated existing tests expect scheduled rollover and deadline activation history to use actor type `system`, while the current database records `automation`.

## Deployment and Timing Verification

1. Confirm the production migration ledger and current MCP Edge Function version have not drifted from this preflight.
2. Take the standard private production backup and record its checksum.
3. Apply `20260804141107_accelerate_mcp_task_creation.sql`.
4. Read back the function security mode, grants, and definition before changing the caller.
5. Deploy the generated `mcp` Edge Function bundle.
6. Run one owner-scoped synthetic creation, exact retry, and changed-retry rejection, then independently verify the task, Primary Link, and single creation receipt.
7. Clean up the synthetic task and verify no fixture residue.
8. Rerun security and performance advisors and compare them with the pre-deployment baseline.
9. Invoke the Raycast webpage command several times and compare the `bathos_ms` distribution with the 2.69 to 3.47 second baseline.

The expected improvement comes from removing four network round trips, but no production latency claim should be made until step 9 is complete. If the MCP deployment regresses, restore the previous Edge Function version first. The additive RPC can remain unused until a later cleanup migration removes it.
