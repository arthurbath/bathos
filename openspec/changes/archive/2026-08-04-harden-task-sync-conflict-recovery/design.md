## Context

Tasks writes first land in a local PowerSync database and are later uploaded as CRUD entries. A task PATCH includes only the business columns changed by that local SQL statement plus revision and mutation metadata. The connector currently submits the PATCH with `baseRevision = localRevision - 1`, records a conflict if the remote row has advanced, completes the CRUD transaction, and allows downsync to replace the optimistic local value. That behavior loses user intent whenever another device, MCP, or server automation wins the revision race.

The production failure on `Emission Factors Upgrade` demonstrated the issue. A user planning edit cleared its start while the due-task activator advanced the same task. Later local planning revisions all received `revision_conflict`, were drained, and disappeared after refresh.

## Goals / Non-Goals

**Goals:**

- Preserve queued user task PATCH intent across ordinary revision races.
- Preserve unrelated fields written by the winning client or server automation.
- Keep unresolved mutations durable and retryable rather than silently losing them.
- Retain idempotency when a remote write succeeds but its response is lost.
- Expose content-free recovered or pending conflict receipts.
- Prove the due-task-activation race and ordinary multi-client races.

**Non-Goals:**

- Merge two competing values for the same field. A later successfully replayed field value becomes authoritative.
- Rebase task creation, settings, hierarchy operations, areas, or checklist mutations in this change.
- Change PowerSync's synchronized table set or add a production database migration.
- Store task content in synchronization diagnostics or Sentry.

## Decisions

### Rebase only the columns present in the queued task PATCH

On `revision_conflict`, the connector uses the returned remote revision as the next base, replaces only `revision` and `updated_at`, preserves the original `client_mutation_id`, and resubmits the same field-level patch. Because PowerSync PATCH entries contain only columns changed by that local mutation, unrelated remote changes remain intact.

Replaying a complete stale task snapshot was rejected because it would overwrite unrelated remote edits. First-writer-wins was rejected because it is the behavior that loses legitimate offline user intent.

### Use contiguous remote revisions and stable mutation identity

Every retry writes `remoteRevision + 1` rather than preserving a stale or gapped local revision. The original mutation ID remains stable across retries. Remote idempotency classification treats that mutation ID as already applied even when the authoritative revision was rebased, covering a successful write whose response never reached the client.

### Bound in-call retries and retain exhausted work

The connector performs a small bounded number of immediate rebase attempts. If another writer keeps advancing the row, the connector records a `revision_conflict_retry_pending` receipt and throws a transient synchronization error. PowerSync therefore does not complete the CRUD transaction and retries it from durable storage later. A later successful replay updates the same receipt to `revision_conflict_recovered`.

A missing authoritative task cannot be safely reconstructed from a PATCH. That case is retained in the queue with a content-free pending receipt rather than discarded.

### Keep automatic recovery quiet and use existing degradation reporting for sustained failure

Ordinary recovered races require no toast because the user's visible intent remains in place. Pending retries keep the upload queue nonzero and surface through the existing synchronization health and Sentry degradation path if they persist. Diagnostics retain only task identifiers, revisions, operation, timestamps, and codes.

## Risks / Trade-offs

- [Two clients edit the same field] -> The replayed mutation becomes authoritative when it is accepted. This is deterministic at the server revision boundary but cannot synthesize both scalar values.
- [Continuous writers exhaust immediate retries] -> The mutation stays durable and PowerSync retries later rather than spinning or dropping data.
- [A remote task was permanently removed] -> A PATCH alone cannot reconstruct it, so the mutation remains pending and visible for diagnosis instead of creating an incomplete task.
- [Rebased remote revision differs from the optimistic local revision] -> Downsync reconciles revision metadata after the queue drains, while the business fields already match the preserved user intent.
- [Conflict receipt rows become noisy] -> One receipt ID per PowerSync CRUD entry is upserted from pending to recovered instead of appending every retry.

## Migration Plan

1. Ship connector and test changes with no database migration.
2. Existing local-only `tasks_sync_issues` rows remain readable. New uploads upsert the existing columns with recovery-specific codes.
3. Rollback restores first-writer-wins behavior but does not require schema rollback. Any mutations already retained by the hardened connector remain in PowerSync's queue until a compatible client uploads them.

## Open Questions

None.
