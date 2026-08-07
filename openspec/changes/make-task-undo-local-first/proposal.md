## Why

Tasks currently makes immediate undo depend on synchronized server-history projections. A missing PowerSync hierarchy-history column causes every checklist undo query to fail, wait for the full 30-second projection timeout, and then misreport the infrastructure failure as Nothing to Undo even though the authoritative reversible event exists.

## What Changes

- Repair the PowerSync hierarchy-history schema contract by exposing the action identifier required by checklist history queries and safely replacing incompatible existing local caches.
- Replace the split task/checklist projection-wait coordinators with one device-local chronological action journal that records complete task and checklist actions before their local-first mutations are accepted.
- Make undo and redo respond from the local journal immediately, including while offline, while continuing to synchronize inverse mutations and retain server-authored history for audit, recovery, and conflict validation.
- Persist the bounded local journal for 30 minutes on the current installation, group multi-row gestures atomically, and invalidate redo only when a new forward action is accepted.
- Detect local schema incompatibility at startup and report history-query failures as actionable errors rather than history boundaries.
- Add real-schema and legacy-cache integration coverage so mocked history rows cannot conceal a missing runtime column again.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Make the unified task action history device-local and immediate while preserving guarded synchronization, atomic grouped actions, a bounded 30-minute journal, and explicit conflict or infrastructure failures.

## Impact

- Tasks PowerSync schema, database-generation compatibility handling, and local-only storage
- Task and checklist mutation coordination, undo/redo hooks, shell routing, keyboard commands, iOS shake integration, and feedback
- Existing Supabase task and hierarchy history remain authoritative and unchanged; no production database migration or new dependency is expected
- Focused hook, repository, runtime, schema, legacy-cache, shell, offline, and end-to-end regression coverage
