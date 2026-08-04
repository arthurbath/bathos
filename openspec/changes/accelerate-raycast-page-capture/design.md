## Context

The Raycast command already holds a delegated BathOS OAuth access token, and that token has been verified against the Supabase Data API. The existing `tasks_create_mcp_task` function performs task creation in one owner-scoped transaction, but the current command reaches it through a large general MCP Edge Function whose baseline latency dominates the BathOS stage.

## Goals / Non-Goals

**Goals:**

- Remove the general MCP Edge Function from the Raycast webpage-capture hot path.
- Keep the client payload limited to the idempotency UUID, generated title, and webpage URL.
- Preserve owner isolation, exact-retry semantics, pending-capture recovery, placement, source provenance, and Primary Link behavior.
- Leave MCP available for general-purpose and non-webpage clients.

**Non-Goals:**

- Change the general MCP `create_task` tool or its transactional implementation.
- Add a service-role or secret key to Raycast.
- Change task placement, source fields, or user-facing confirmation text.
- Deploy the migration or publish either repository as part of local implementation.

## Decisions

### Use a narrow Data API function

`public.tasks_create_raycast_page_capture` accepts only `_idempotency_key`, `_title`, and `_url`. It fixes all workflow-specific values inside Postgres and delegates to `public.tasks_create_mcp_task`, avoiding duplication of task mutation logic.

### Preserve the authenticated RLS boundary

The function runs as `SECURITY INVOKER`, sets an empty search path, accepts no owner identifier, and derives ownership through the delegated function's `auth.uid()` boundary. Execution is revoked from `PUBLIC` and `anon` and granted only to `authenticated`.

Raycast supplies the public client key in the `apikey` header and its delegated OAuth token in the `Authorization` header. It does not contain a service-role key or client secret.

### Route only webpage captures directly

The shared Raycast delivery helper selects the direct RPC only for captures whose structured source kind is `webpage`. Finder, reading-list, and other capture types continue using MCP. Pending records are replayed through the route appropriate to the stored capture, preserving crash recovery across mixed capture types.

During database-first rollout, Raycast may fall back to MCP only when PostgREST explicitly reports that the new function is absent from its schema cache. Authorization failures, validation failures, network errors, and ambiguous RPC responses do not fall back, avoiding a second mutation attempt after a function may have executed.

## Risks / Trade-offs

- [The client and database disagree about fixed fields] -> Remove fixed fields from the direct RPC signature and assert the stored values in pgTAP.
- [The public key is mistaken for authorization] -> Continue requiring the OAuth bearer token and enforce ownership through `SECURITY INVOKER`, RLS, and `auth.uid()`.
- [A pending non-webpage capture is sent to the wrong transport] -> Dispatch each stored capture by structured source kind at submission time.
- [The local Raycast script changes before the database migration is deployed] -> Fall back only on PostgREST's explicit missing-function code until the database-first rollout is complete.
- [The wrapper diverges from task mutation behavior] -> Delegate to the established transactional function and test exact retries and cross-owner reuse.

## Migration Plan

1. Deploy the database migration and verify function privileges and security mode.
2. Publish the Raycast transport change only after the RPC is available.
3. Run a normal page capture and exact replay, then independently read back the task's placement, source, Primary Link, and owner.
4. Compare new `bathos_submit_ms` samples with the current 2.69 to 3.47 second range.
5. If direct RPC errors occur, Raycast can be rolled back to the MCP transport while the unused narrow function remains inaccessible to anonymous callers.

## Open Questions

None.
