## Context

Tasks currently persists `inbox`, `today`, `anytime`, and `someday` as mutually exclusive destinations. Today placement is further divided into `daytime` and `evening`, while completed and canceled work remains present in Logbook and deleted work uses a separate recoverable Trash projection. Those concepts are repeated in the local PowerSync schema, repository assertions, Supabase constraints and functions, MCP tools, external capture adapters, templates, backup validation, navigation, and tests.

The desired personal GTD model is smaller. Anytime is the active task inventory. Today is a focus projection of that inventory. Done is a short-lived recovery queue, not a historical archive. Existing production data and integrations must move to the new contract without task-content loss or duplicate creation.

## Goals / Non-Goals

**Goals:**

- Make `anytime` and `someday` the only persisted planning destinations for to-dos and projects
- Represent Today membership with a non-null `today_section` value of `none`, `now`, `next`, or `later`
- Send new web, MCP, Raycast, Mail, browser, native, import, recurrence, and template to-dos to Anytime and Later unless an explicit supported placement is supplied
- Render Today as the Now, Next, and Later subset of eligible Anytime work
- Render all eligible Anytime work together and mark Today members with compact section-specific Lucide iconography
- Combine completed, canceled, and deleted work into Done with restore or reopen behavior
- Purge Done work at owner-local midnight at the start of its 31st day
- Preserve local-first mutation, history, idempotency, reminder, source, recurrence, backup, and synchronization invariants
- Redirect retired routes and reject retired API vocabulary at new write boundaries

**Non-Goals:**

- Import or mutate Things data
- Add generic tags or an unstructured metadata field
- Retain a permanent user-facing completion archive
- Remove append-only content-free receipts needed for idempotency and recurrence safety
- Change Mail retirement behavior or source mailbox policy
- Add a new task table when the existing lifecycle and disposition dimensions can express Done safely

## Decisions

### Today is membership within Anytime

`destination` will accept only `anytime` and `someday`. `today_section` will remain non-null and accept `none`, `now`, `next`, or `later`. An open present record appears in Today only when its destination is Anytime, its start date is not in the future, and its section is not `none`. Anytime includes that same record, so Today never owns a separate copy or identity.

This keeps PowerSync conflict handling and stable identifiers intact. A separate join table was rejected because Today membership is single-valued, order-sensitive planning state already carried on each record.

### New capture defaults to Later

Every unqualified capture becomes `destination = 'anytime'`, `today_section = 'later'`, and no start date. Later is the least presumptive Today section while still making new work visible for triage. Explicit callers may choose Anytime with `none`, `now`, `next`, or `later`, or Someday with `none`.

### Today ordering remains section-scoped

The existing planning order key remains the ordering value. Reordering in Today is limited to the current Now, Next, or Later peer set. Reordering in Anytime applies across the complete currently available Anytime list while preserving Today membership. This avoids a second ordering column and keeps Today membership orthogonal to the active pool.

### Done is a union projection over existing terminal dimensions

No new lifecycle enum is required. Done includes root work where `lifecycle` is completed or canceled, or `disposition` is deleted. The terminal entry time is `deleted_at` for deleted work, otherwise `completed_at` or `canceled_at`. Restore applies to deleted work and reopen applies to completed or canceled work.

The interface will not expose separate Logbook, Trash, or user-triggered permanent deletion controls. Existing permanent-deletion RPCs remain server-side compatibility surfaces until a later removal can prove that no backup or integration depends on them.

### Purge is owner-local and server-authoritative

A `SECURITY DEFINER` function will calculate each owner's planning date from `tasks_user_settings.planning_timezone`, identify terminal roots whose Done entry date is at least 31 calendar days old, and permanently erase their content graph while preserving only content-free receipts required for idempotency or recurrence safety. A pg_cron job runs once per minute so every IANA time zone crosses its local midnight within one minute without one job per owner.

The function is idempotent, uses bounded batches, skips records whose terminal timestamp is absent or inconsistent, and exposes a privileged testable invocation. Clients can project the resulting deletes through the existing PowerSync tables.

### Migration normalizes legacy planning atomically

The migration drops old placement checks before rewriting rows. Existing Inbox to-dos become Anytime and Later. Existing eligible Today daytime work becomes Anytime and Next, existing Today evening work becomes Anytime and Later, and future-dated Today work becomes Anytime with no Today membership. Existing Anytime and Someday rows receive `none`. Projects use the same mapping.

Legacy history and backup snapshots remain readable through explicit normalization from `inbox`, `today`, `daytime`, and `evening` to the new values. New exports use a new schema version and never emit retired vocabulary.

### Compatibility redirects are read-only

`/tasks/inbox` redirects to `/tasks/today`. `/tasks/logbook` and `/tasks/trash` redirect to `/tasks/done`. The retired paths never render distinct views and are removed from navigation, search, keyboard help, and route declarations once the redirect boundary owns them.

## Risks / Trade-offs

- [Minute-level purge timing] → Run the owner-local due check every minute and test exact pre-midnight and midnight boundaries
- [Irreversible data removal after retention] → Keep Done recoverable for 30 full calendar days, preserve backup/export behavior, and document the boundary prominently
- [Old clients submit retired values] → Apply the production migration and web/MCP deployment together, reject retired write values clearly, and normalize only historical import data
- [PowerSync receives server deletes while a client is offline] → Use existing tombstone synchronization and verify reconnect convergence with a multi-client integration test
- [Recurring work is recreated or suppressed incorrectly] → Preserve content-free occurrence and idempotency receipts and test completion-triggered recurrence before and after purge
- [Hierarchy purge partially erases a graph] → Reuse the server-authoritative permanent-deletion scope machinery inside one transaction and test todo, project, heading, checklist, source, reminder, and history dependencies
- [External adapters continue saying Inbox] → Update and deploy BathOS first, then update Raycast and Inbox Manager contracts before production acceptance

## Migration Plan

1. Add and test the new web and local-domain contract behind the migration vocabulary.
2. Add one additive Supabase migration that normalizes existing records, replaces placement constraints and indexes, updates relevant RPC/export validation, creates the purge function, and installs the cron job.
3. Regenerate client database types and the MCP Edge Function bundle.
4. Run local database, Vitest, integration, lint, build, OpenSpec, browser, and offline synchronization validation.
5. Apply the migration and deploy the MCP bundle to production only after the destructive retention behavior is explicitly reviewed at the production gate.
6. Update Raycast and Inbox Manager, deploy their approved runtimes, and verify that new external captures appear in Today Later and Anytime exactly once.
7. Observe one synthetic Done record across the midnight boundary, reconcile PowerSync deletion, and remove the synthetic evidence.

Rollback before the first automatic purge can restore the retired destination and section constraints by mapping Anytime Later captures back to Inbox only when provenance and creation time identify post-change untriaged work. After a purge has occurred, rollback cannot recover erased content without a backup, so production rollback must disable the cron job first and preserve a pre-deployment export.

## Open Questions

None. The user supplied the active-pool, Today-section, Done-retention, and purge semantics needed to implement the change.
