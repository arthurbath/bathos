## Why

Tasks lists can become visually dense when the user needs to concentrate on work with a particular actionability state. A small fixed set of durable quick filters can reduce that cognitive load without introducing tags, advanced query builders, or user-defined filter management.

## What Changes

- Add one Quick Filters control to the top-right action row of every primary Tasks list.
- Offer only All Tasks, Only Ready, Only Not Ready, Only Rechecking, and Only Waiting.
- Filter task rows through their structured actionability value while leaving non-task project cards intact.
- Show the active filter by name in the top action row and let the same control replace or clear it.
- Persist the active filter as an owner-scoped BathOS user preference so the same value applies across Tasks lists, browser sessions, and devices.
- Keep All Tasks as the default for owners without a saved preference.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Add fixed actionability quick-filter behavior and durable cross-device preference requirements.

## Impact

- Tasks shell list derivation, top action controls, selection reconciliation, and empty-state presentation.
- A small Tasks actionability-filter domain helper and focused unit/integration coverage.
- A shared `bathos_user_settings` preference column, timestamp, generated Supabase types, and an owner-scoped client preference hook.
- No new table, PowerSync publication entry, tag system, arbitrary filtering grammar, or public API.
