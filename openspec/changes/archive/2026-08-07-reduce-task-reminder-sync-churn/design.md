## Context

`useTaskReminders` checks the authoritative in-app reminder claim RPC when a connected fallback surface mounts, once per minute while visible, and when visibility returns. The current `tasks_claim_due_reminders_v2` implementation performs two durable writes even when no reminder is due: it refreshes the in-app delivery target and inserts an immutable claim receipt. The receipt table is also part of the PowerSync publication, owner stream, replication-role grants, and local schema even though no application code reads it.

A read-only production inspection on 2026 Aug 7 found 18,966 receipts occupying 5,312 kB, of which 18,810 were empty. The live publication contains the same 17 tables represented by the committed deployment topology, including `tasks_reminder_claims`.

The existing minute check remains valuable for prompt fallback reminders, recovery from browser sleep, and cross-surface Web Push acceptance. The optimization must therefore remove unnecessary durable and synchronized work without weakening the delivery contract.

## Goals / Non-Goals

**Goals:**

- Make a claim check with no eligible reminder produce no persistent database row and no synchronized change.
- Preserve request-id idempotency whenever a request actually leases reminder deliveries.
- Bound retained successful claim receipts to 24 hours.
- Remove the server-only receipt table from the PowerSync source publication, stream, replication-role grants, and client schema.
- Preserve fallback timing, surface isolation, delivery leases, acknowledgement, and Web Push coexistence.

**Non-Goals:**

- Do not change the once-per-minute visible-client check cadence in this change.
- Do not remove delivery targets or delivery attempts from PowerSync because current clients use those rows to understand delivery and fallback state.
- Do not alter reminder times, task content, existing reminder occurrences, or delivery records.
- Do not drop the receipt table or remove its owner RLS policy because the current RPC continues to use it for bounded idempotency.

## Decisions

### Preflight eligibility before durable writes

The v2 RPC will first test whether at least one occurrence could be delivered to the requesting surface. When none exists, it returns the established accepted response with an empty `items` array and performs neither target upsert nor receipt insert. This preserves the client API while eliminating the dominant write path.

The eligibility predicate will remain identical to the predicate used to create per-target deliveries: active reminder occurrences qualify, and canceled reminders qualify only when Web Push was provider-accepted and the occurrence remains unacknowledged. Reusing the same predicate avoids making the fast path behaviorally different from the authoritative claim.

Alternative considered: let the client infer due work from its local cache and stop polling. That could reduce RPC traffic further, but it would make delivery timing depend on synchronized projection freshness and recreate complex server predicates in SQLite. The server-side empty fast path is safer and removes the PowerSync churn that motivated this change.

### Persist receipts only when at least one delivery is leased

After the target-specific claim transaction runs, the RPC will insert the request receipt only if `items` is nonempty. Empty responses have no side effect to deduplicate, so replaying them is harmless. A nonempty result retains the existing immutable response and request-parameter reuse guard.

### Retain successful receipts for 24 hours

A private, service-role-only cleanup function will delete receipts older than 24 hours. When `pg_cron` is installed, one named hourly job will invoke it. The migration will also remove already-expired receipts once, reducing the current table immediately while leaving the most recent retry window intact.

Twenty-four hours is much longer than the bounded client request timeout and expected ambiguous retry window while keeping the operational table permanently small. The cleanup function accepts a cutoff for deterministic pgTAP coverage.

### Keep claim receipts server-only

The migration and deployment manifests will remove `tasks_reminder_claims` from the `powersync` publication and revoke the PowerSync role's table grant. The owner stream and local PowerSync schema will remove the table as well. Authenticated RPC access remains unchanged, and the public table retains RLS plus its existing narrow owner read grant for compatibility even though current clients do not query it.

This contracts the approved Tasks publication from 17 to 16 tables. Removing the unused local table is safe because no runtime query or upload path references it.

## Risks / Trade-offs

- [Eligibility predicates drift between the fast path and delivery creation] -> Keep the predicates adjacent in one function and cover active, Web Push fallback, acknowledged, and empty cases in pgTAP.
- [An empty request ID is later reused with different parameters] -> Permit it because the first request had no side effect; retain strict reuse rejection for every persisted nonempty receipt.
- [Cleanup runs while a delayed retry is in flight] -> Retain 24 hours, far beyond the bounded request timeout, and delete only rows strictly older than the cutoff.
- [A deployment updates the client stream before the source publication] -> Removing an unused table is backward-compatible in either order; deploy the database and PowerSync topology before publishing a client that omits the local table.
- [Older clients still declare the local receipt table] -> They receive no rows after the stream removal and never query it, so reminder behavior remains intact.

## Migration Plan

1. Capture a fresh production manifest: receipt totals and ages, empty/nonempty counts, table size, RPC definition, publication membership, cron availability, and existing reminder-delivery status counts.
2. Apply the database migration that installs the empty fast path, conditional receipt insert, private retention function, optional hourly cron job, one-time 24-hour cleanup, publication contraction, and replication-role grant revocation.
3. Read back the function definition, retained receipt counts, cron job, publication membership, role privilege, and unchanged reminder/delivery counts.
4. Deploy the 16-table PowerSync owner stream and verify a fresh client connects without the claim table while reminder checks and acknowledgement still work.
5. Publish the web client after database and PowerSync verification. No native rebuild is required because this is web/database behavior inside the shared companion content.

Rollback restores the prior RPC and PowerSync table membership. Purged operational receipts are intentionally not recoverable, but their only purpose is bounded retry deduplication and they contain no task content beyond returned reminder titles already present in the task domain.

## Open Questions

None.
