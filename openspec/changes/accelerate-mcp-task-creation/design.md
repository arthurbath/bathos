## Context

An ordinary unassigned webpage capture currently crosses from the MCP Edge Function to PostgREST five times. Each call is correct independently, but together they add a stable multi-second submission stage and leave ordering decisions outside the database transaction that accepts the insert. Existing Mail and Watch capture services demonstrate that BathOS can perform narrow task creation atomically in Postgres and return one structured receipt.

## Goals / Non-Goals

**Goals:**

- Reduce generic MCP task creation to one Edge Function-to-Postgres RPC.
- Preserve current normalized request, placement, provenance, idempotency, and response semantics.
- Keep the authenticated user's RLS boundary authoritative.
- Serialize concurrent exact retries and tail-order allocation without duplicate rows or receipts.
- Roll back all task effects when validation, insertion, or receipt generation fails.

**Non-Goals:**

- Change the public MCP tool schema or Raycast capture payload.
- Change Tasks table structure, PowerSync synchronization, or user-facing placement behavior.
- Deploy the migration or Edge Function as part of local implementation.
- Optimize the independent OpenAI webpage-title request.

## Decisions

### Keep the MCP Edge Function as the protocol boundary

The generated Supabase MCP Edge Function remains responsible for OAuth, Zod validation, input normalization, and MCP response shaping. The canonical `tasks-create.ts` handler sends one normalized RPC request with the authenticated user's bearer token. The Edge Function does not gain a service-role secret and does not accept an owner identifier.

### Use one SECURITY INVOKER RPC

`public.tasks_create_mcp_task` executes as `SECURITY INVOKER`, sets an empty search path, derives the owner from `auth.uid()`, and relies on the existing task RLS policies. Execution is revoked from `PUBLIC` and `anon` and granted explicitly to `authenticated`. This avoids a privileged public function while accommodating Supabase's explicit Data API exposure model.

The procedure may use the established pure fractional-index helper through the narrowest required privilege or equivalent in-procedure logic. It does not expose or bypass owner-scoped table access.

### Make idempotency and ordering transactional

The procedure first acquires a transaction-scoped advisory lock for the authenticated owner and idempotency UUID. It resolves an existing immutable creation event and compares only normalized caller-controlled fields. An exact retry returns the original receipt and current owner-safe task. Changed reuse is rejected.

A new creation then acquires owner-scoped planning and optional hierarchy ordering locks, validates the selected present Area, derives any owner-local planning date, allocates tail order keys, inserts the task, reads the trigger-authored creation event, and returns both records. All work occurs in one database transaction.

### Preserve later-edit retry behavior

Idempotency comparison uses the immutable creation event's `after_state`, not the task's current mutable values. A retry after later edits therefore returns the current task with the original creation receipt, matching the existing MCP contract.

## Risks / Trade-offs

- [RPC input and TypeScript normalization diverge] -> Keep validation in both layers where it protects direct callers, share focused contract fixtures, and assert every normalized field passed to RPC.
- [Concurrent tail inserts choose the same rank] -> Serialize each owner/destination planning tail and owner/Area hierarchy tail with advisory transaction locks before reading the maximum key.
- [A privileged function weakens RLS] -> Use `SECURITY INVOKER`, derive ownership from `auth.uid()`, omit owner input, keep explicit owner predicates, and verify cross-owner denial in pgTAP.
- [A migration failure leaves a partial task] -> Let uncaught validation, insert, trigger, or receipt failures abort the RPC transaction and prove rollback in database tests.
- [Generated MCP bundle drifts from canonical source] -> Rebuild through the existing MCP build path and verify the generated bundle contains the RPC call.

## Migration Plan

1. Add the RPC, explicit privileges, and generated Supabase type.
2. Deploy the database migration before deploying the MCP Edge Function so the old handler remains compatible during rollout.
3. Deploy the rebuilt MCP Edge Function after the RPC is available.
4. Run one synthetic authenticated creation and exact replay, then read back the task and history independently.
5. Compare `bathos_submit_ms` p50 and p95 against the existing 2.69 to 3.47 second samples.
6. Roll back the Edge Function first if needed. The unused RPC can remain safely in place until a later migration revokes and drops it.

## Open Questions

None.
