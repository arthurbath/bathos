# Tasks Synchronization Reliability

**Date:** 2026 Jul 21  
**Status:** Accepted for publication and continued parallel use  
**Scope:** Installed-client synchronization truthfulness, local reliability evidence, and privacy-bounded production warning behavior

## Decision

Tasks now derives one synchronization-health state from the installed PowerSync SDK's connection, first-full-sync, transfer-error, active-transfer, and pending-upload signals. The header may show `Synced` only after one full synchronization has completed and no transfer is active, failing, or queued.

The client records upload-error, download-error, and offline episodes in a local-only table. It retains 50 content-free events. A production episode that remains active for 2 minutes sends one fixed Sentry warning with bounded tags, then records that the episode was reported. Transaction-serialized reconciliation prevents two Tasks tabs from opening or reporting duplicate events.

No Supabase table, PowerSync stream, publication, role, RPC, Edge Function, secret, or Cron change is part of this decision.

## Production Evidence Before Publication

The production Safari surface was inspected read-only on 2026 Jul 21 at approximately 8:46 AM PDT:

- Header status: `Synced`
- Connection: Connected
- Pending changes: 0
- Last successful synchronization: 2026 Jul 21 at 8:39 AM PDT
- Upload: Idle
- Download: Idle
- Recent conflict receipts: None

This is a healthy point-in-time observation. It is not proof of sustained replacement readiness.

## Historical Reminder Incident

Sentry issue `BATHOS-M` contains three production Safari events from 2026 Jul 20 between 8:52 PM and 8:56 PM PDT for fractional-second reminder timestamps rejected by an older Tasks bundle. Commit `188778c` expanded accepted reminder-time precision at 9:02 PM PDT. The currently published Tasks chunk contains the expanded one-to-nine-digit fractional-second matcher.

The code incident is closed and requires no task-row repair. The Sentry record was inspected read-only and was not externally resolved as part of this work. It is distinct from synchronization-health evidence and does not indicate a current PowerSync failure.

## Privacy Boundary

The local health table stores only:

- A bounded degradation state
- Start and optional resolution times
- A bounded pending-upload-count bucket
- Whether a full synchronization had completed
- The last successful synchronization time, when available
- An optional report time

The Sentry warning receives only fixed copy and allowlisted tags for the module, degradation category, queue-count bucket, prior full-sync completion, and duration bucket. It receives no raw error object, task content, record identifier, owner identifier, source metadata, exact large queue count, or local event identifier.

## Verification

- Deterministic classifier tests cover all eight health states and priority order.
- Transactional store tests cover concurrent-tab deduplication, category changes, recovery, the 2-minute threshold, once-per-episode reporting, and 50-row retention.
- Reporting tests prove private extra fields cannot cross the allowlist boundary.
- Observer tests cover initial-status loading, reload continuation, delayed reporting, and recovery breadcrumbs.
- Diagnostics and schema tests cover first-full-sync truthfulness, content-free parsing, local-only storage, and visible recovery evidence.

Prepublication validation passed with 683 enabled tests, 9 intentionally skipped opt-in tests, a successful Tasks typecheck, a successful production build, clean lint, and strict OpenSpec validation. Post-publication Safari evidence will be recorded during change closeout.

## Remaining Boundary

This watchdog improves installed-client evidence. It does not monitor PowerSync Cloud, Supabase, Cron, or Web Push from outside the active Tasks runtime. Parallel use should continue until ordinary operation and the existing sustained tests provide enough evidence for a separate replacement decision.
