## Why

A Tasks client can remain open while its local PowerSync database stops accepting downloads, leaving the surface connected-looking but hours behind changes made by the web app or external services. The current runtime records the download failure but continues serving an untrustworthy stale projection and cannot recover when the local SQLite store is corrupt.

## What Changes

- Detect the narrow SQLite corruption signatures reported by PowerSync instead of treating them as ordinary transient download failures.
- Automatically rotate to a fresh local database namespace only after proving the durable upload queue is empty, preserving the damaged store for forensic recovery rather than overwriting it.
- Keep stale task rows concealed while safe recovery and a new authoritative sync are in progress.
- Bound automatic recovery attempts, report content-free recovery outcomes, and retain the existing visible retry path when local intent cannot be proven safe to discard.
- Verify healthy clients continue receiving task updates made by another web/native client or an external database writer without a reload.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Make synchronization diagnostics and online freshness behavior self-heal a confirmed corrupt disposable cache without risking queued local mutations.

## Impact

- Tasks PowerSync database construction and runtime lifecycle under `src/modules/tasks/sync/` and `src/modules/tasks/runtime/`.
- Focused runtime, database-generation, and multi-client convergence tests.
- Applies to the web app and the iOS/macOS web surfaces because all use the shared Tasks runtime.
- No Supabase schema, PowerSync publication, RLS, Edge Function, or native bridge change is required.
