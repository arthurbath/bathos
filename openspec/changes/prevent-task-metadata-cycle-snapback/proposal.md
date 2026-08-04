## Why

Keyboard shortcuts that cycle a task's Today horizon, Area, or Actionability currently render the requested value immediately, briefly revert to the prior synchronized value, and then render the accepted value again. This stale-value snapback makes a successful command look unreliable and can cause repeated shortcuts to calculate from the wrong apparent state.

## What Changes

- Preserve the newest accepted local task revision while the reactive synchronization query briefly emits an older revision.
- Let a genuinely newer authoritative revision replace the retained local value normally.
- Cover Today horizon, Area, and Actionability cycling with regression tests that exercise a local write echo followed by an older synchronized projection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Require successful shortcut-driven metadata changes to remain visually stable while local and remote projections converge.

## Impact

- Tasks optimistic projection and reactive query reconciliation in `src/modules/tasks/hooks/useTaskList.ts`.
- Tasks hook and shell regression tests for metadata shortcut rendering.
- No database, Supabase, native-companion, or external API changes.
