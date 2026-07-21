## Context

Inbox Manager stages one accepted Mail task with a stable idempotency UUID and retries after ambiguous delivery. The production canary created the task and structured source, but the identical UUID was rejected on replay because `tasks_create_mail_capture` compared the stored row with fresh values generated inside the MCP service. Those values include the task identifier, owner-local planning date, planning order, and optional hierarchy order. They are not part of the caller's logical request and can change between attempts.

The database function already serializes each owner, account, and message identity through an advisory transaction lock. It remains the correct authority for both concurrent first attempts and later retries.

## Goals / Non-Goals

**Goals:**

- Return the original task, source, and creation receipt for an exact retry
- Keep caller-controlled title, notes, area, and structured Mail identity checks strict
- Preserve one task, one source, and one creation event under concurrent or delayed retries
- Correct production with one forward-only function migration and no data rewrite

**Non-Goals:**

- Do not change the MCP tool schema or database function signature
- Do not change task ordering for new Mail captures
- Do not synchronize Mail-retirement lifecycle
- Do not enable general Inbox Manager dual writing

## Decisions

### Define request identity from caller-controlled fields

When the idempotency UUID already owns a task, the function compares the stored title, notes, optional area, source title, account, mailbox, message identifier, deep link, and retirement destination with the normalized caller values. A difference remains a unique-violation error.

The function does not compare the fresh task identifier, planning date, planning order, or hierarchy order supplied by the MCP service. Those values were selected by the first accepted execution and are returned from the stored row on every retry.

Alternative considered: Read the existing task in the Edge Function before generating values. Rejected because two concurrent first attempts can still pass that preflight before either inserts. The transaction-locked database function must own the final decision.

### Preserve the existing function boundary

The migration replaces the function body without changing its arguments, return envelope, grants, invoker security, search path, advisory lock, or insertion path. Existing clients require no deployment or configuration change.

Alternative considered: Add all generated values to the public MCP input so callers can replay them. Rejected because callers should not own BathOS task identifiers or internal ordering.

### Prove the missing case in pgTAP

The existing database test retries with a different generated task ID but repeats the original planning date and order. The regression will also vary the planning date and order while preserving every caller-controlled field, then require `already_applied`, one task, one source, and one create event. Existing changed-title coverage remains the negative contract.

## Risks / Trade-offs

- [Risk] Removing comparisons could allow a materially different request to reuse an idempotency UUID -> Mitigation: Retain comparisons for every caller-controlled task and source field
- [Risk] A function replacement could alter permissions or execution context -> Mitigation: Preserve the signature, `SECURITY INVOKER`, empty search path, revokes, and authenticated grant, then run database tests and lint
- [Trade-off] A retry after midnight returns the original Today date rather than moving the task to the new date -> Mitigation: Treat replay as retrieval of the first accepted logical request, not a new scheduling decision

## Migration Plan

1. Add the failing pgTAP case with changed generated values.
2. Create a Supabase migration that replaces only the existing function body.
3. Run the Mail-capture database test, full database tests, lint, Tasks tests, typecheck, build, and strict OpenSpec validation.
4. Apply the migration to production with approval.
5. Replay the accepted canary UUID and require `already_applied` for the same task with unchanged row and history counts.

Rollback restores the prior function body. No row migration or cleanup is required.

## Production Acceptance

Production migration `20260721172658_fix_tasks_mail_capture_retry.sql` was applied on 2026 Jul 21 after the focused and complete validation gates passed. Replaying the accepted canary UUID through the installed Inbox Manager OAuth and MCP path returned `already_applied` with the original task identifier.

An authoritative database read found exactly one task, one structured Mail source, and one `create` history event. A fresh disposable PowerSync client authenticated as the owner completed its first synchronization and received the same open, present task at revision 1. The disposable client database and private canary verification files were removed after the proof.

The production PowerSync boundary remained `ready` with exactly 22 synchronized tables. The reminder schedule remained active at one-minute cadence with three consecutive successful runs. No RLS, PowerSync, reminder, Edge Function, Mail rule, or existing row changed as part of this migration.

## Open Questions

None
