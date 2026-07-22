## Why

An already synchronized online Tasks client can briefly emit disconnected and transfer-error states while PowerSync reconnects, producing a burst of immediately recovered reliability events during an otherwise healthy reload. These entries make Synchronization Details noisy and untrustworthy even though the durable queue remains empty and the client converges normally.

## What Changes

- Require a short confirmation interval before persisting a new synchronization degradation episode.
- Continue to expose the current connection and transfer state immediately in the visible synchronization status.
- Preserve existing open episodes across reloads and report any confirmed episode that remains active for two minutes.
- Add focused observer coverage for transient startup blips, sustained degradation, recovery, and reload behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Make recent synchronization reliability history exclude transient startup states that clear before the confirmation interval while preserving immediate status and persistent-degradation reporting.

## Impact

- Tasks synchronization reliability observer and its unit tests.
- The durable `personal-tasks-module` synchronization diagnostics contract.
- No database schema, Supabase object, PowerSync configuration, API, dependency, or cross-module change.
