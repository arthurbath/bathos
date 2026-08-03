## Why

Task edits can currently appear successful in an offline-first client, lose a revision race to another client or server automation, and then be silently discarded when PowerSync drains the stale mutation. This makes ordinary multi-device synchronization capable of losing user intent and caused `Emission Factors Upgrade` to reappear with its old planning dates after refresh.

## What Changes

- Rebase stale task PATCH operations onto the latest authoritative revision using only the fields present in the queued mutation, preserving unrelated concurrent changes.
- Retry bounded revision races with the original mutation identity and a new contiguous revision.
- Keep an unresolved task mutation in PowerSync's durable upload queue instead of completing and losing it.
- Record content-free recovery or pending-retry receipts so synchronization diagnostics distinguish healed conflicts from unresolved ones.
- Exercise ordinary edits racing server planning activation and multi-client edits through unit and integration coverage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Replace first-writer-wins task reconciliation with field-level replay, durable retry, and explicit recovery diagnostics for stale queued task edits.

## Impact

- Tasks PowerSync upload connector and Supabase remote-store adapter.
- Local-only synchronization receipts and diagnostics semantics.
- Tasks connector and multi-client convergence tests.
- No synchronized-table, RLS, public API, dependency, native companion, or production database migration is expected.
