## Why

Tasks now has a working production synchronization topology, but the current header can claim `Synced` before the installed client has completed its first full synchronization. The parallel-use promotion gate also needs content-free evidence when explicit PowerSync failures begin and recover, rather than relying only on a user noticing the current status.

## What Changes

- Derive one trustworthy synchronization-health state from PowerSync connection, first-sync, transfer-error, and pending-upload signals
- Withhold the `Synced` label til the current installation has completed at least one full synchronization
- Record content-free degradation and recovery episodes for the current installation without task titles, notes, source data, record identifiers, or raw provider errors
- Report persistent production degradation to Sentry once per episode with bounded state tags and timing only
- Show the active health state and latest content-free episode history in Synchronization Details
- Add deterministic tests for first-sync, transfer failure, persistence, deduplication, recovery, and privacy boundaries

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Strengthen actionable synchronization diagnostics so `Synced` requires a completed full sync and content-free degradation/recovery episodes become visible and reportable

## Impact

- **Tasks module**: Synchronization state classification, runtime observation, diagnostics UI, and focused tests
- **Shared observability**: Sentry receives sanitized Tasks sync episode events in production only
- **Local storage**: One module-local content-free reliability history retained in the Tasks database
- **Supabase and PowerSync**: No schema, publication, stream, role, RPC, secret, or production infrastructure change
- **Other modules**: No behavioral or import impact
