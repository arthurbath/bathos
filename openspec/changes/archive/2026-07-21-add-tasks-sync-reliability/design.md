## Context

The Tasks header currently derives `Synced` from connection state and queue depth. The installed PowerSync SDK separately exposes `hasSynced`, `lastSyncedAt`, upload/download activity, and explicit transfer errors. `hasSynced` is the authoritative signal that one complete synchronization has finished, while transfer errors persist til the next successful transfer.

The production app already sends unhandled exceptions to Sentry with default PII disabled. Tasks needs narrower operational reporting because synchronization failures are usually represented as status values rather than thrown exceptions. Any new reporting must remain content-free and must not add Supabase or PowerSync collections.

## Goals / Non-Goals

**Goals:**

- Make the visible status truthful before the first full synchronization
- Persist bounded, content-free degradation and recovery evidence in the installation's local Tasks database
- Report a degradation that remains active for 2 minutes to Sentry once per episode
- Keep raw PowerSync errors, task content, record identifiers, owner identifiers, and source metadata out of local reliability rows and Sentry events
- Preserve current offline-first task operation and conflict-receipt behavior

**Non-Goals:**

- Monitor PowerSync Cloud, Supabase, Cron, or Web Push from an external uptime service
- Add a synchronized or server-side observability table
- Treat local evidence as proof that the current free topology is replacement-ready
- Add automatic backup, paid PowerSync promotion, self-hosting, Inbox Manager activation, or migration from Things
- Change another BathOS module's status or Sentry behavior

## Decisions

### Derive One Health State from Installed SDK Signals

The Tasks module will derive a health state with this priority: Local-only, upload error, download error, offline, connecting, first synchronization pending, active synchronization, and healthy. `Synced` will require connected mode, `hasSynced === true`, no transfer error, no pending upload, and no active transfer.

This uses the SDK's explicit contract rather than calculating staleness from wall-clock time. A quiet but healthy client can retain an older `lastSyncedAt`, so age alone will remain diagnostic context rather than an error condition.

**Alternative considered:** Mark the client stale when `lastSyncedAt` exceeds a fixed age. This was rejected because an idle synchronized stream does not guarantee a new completed-sync timestamp on a schedule suitable for a product alarm.

### Keep Reliability Episodes Local and Content-Free

A new local-only `tasks_sync_health_events` table will store one row per upload-error, download-error, or offline episode. Rows contain only the bounded state, start time, optional resolution time, queue-count bucket, whether a full sync had completed, last successful sync time, and optional report time. The table will retain the 50 most recent rows.

The observer will serialize writes so one state transition cannot create duplicate open episodes. A changed degradation category closes the prior episode and opens another. Healthy, connecting, first-sync, and active-transfer states close an open degradation episode without creating a new one.

**Alternative considered:** Reuse `tasks_sync_issues`. This was rejected because that table describes record-level upload outcomes and requires task, operation, and revision fields that reliability episodes deliberately exclude.

### Delay and Deduplicate Sentry Reporting

An upload-error, download-error, or offline episode must remain active for 2 minutes before reporting. The timer runs only while the Tasks runtime is mounted. Reloading reads the open local episode, subtracts elapsed time, and reports immediately only when the same degradation remains active past the threshold.

The event uses a fixed message and allowlisted tags for category, queue-count bucket, prior full-sync completion, and duration bucket. It never passes the raw PowerSync error object or database row. `reported_at` makes reporting once-per-episode durable across reloads. Recovery is stored locally and added as a Sentry breadcrumb only when the SDK is initialized.

**Alternative considered:** Capture every status error immediately. This was rejected because transient reconnects and automatic retries would generate noisy incidents without improving diagnosis.

### Mount Observation with the Tasks Runtime

The observer will live inside `TasksRuntimeProvider`, below both the PowerSync and Tasks runtime contexts. It remains active whenever Tasks is mounted, independent from whether Synchronization Details is open. The existing diagnostics hook will read the local episode table and expose the current full-sync signal to the dialog.

This keeps the behavior module-local and avoids changing shared BathOS observability conventions.

## Risks / Trade-offs

- **A tab must remain mounted for the 2-minute report threshold** -> The local episode persists, so a later Tasks load can finish the same threshold calculation
- **Multiple Tasks tabs may observe the same episode** -> Serialized, idempotent database operations and persisted `reported_at` prevent duplicate reports after both tabs refresh their local view
- **Local history disappears on owner change or explicit local reset** -> This matches the existing owner-bound privacy boundary and Sentry retains any reported persistent incident
- **Offline can be an ordinary network transition** -> The delay suppresses short transitions, and the report uses warning severity rather than an unhandled exception
- **Sentry may be unavailable** -> The episode remains visible locally, and the observer does not mark it reported til capture succeeds synchronously with an event identifier

## Migration Plan

1. Add the local-only table to the PowerSync client schema
2. Deploy the web bundle without a Supabase migration or production secret change
3. Existing installations let PowerSync apply the additive local schema update on open
4. Verify healthy production Safari reports a completed full sync and no open degradation episode
5. Roll back by removing the observer and UI while leaving the inert local table declaration for one compatibility release if needed

## Open Questions

None.
