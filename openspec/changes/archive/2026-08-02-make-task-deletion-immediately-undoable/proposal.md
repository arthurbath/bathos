## Why

Recoverably deleting a task moves it to Done, but the Tasks client can still report “Nothing to Undo” immediately afterward even though the authoritative delete event was accepted and synchronized. Deletion must enter the same guarded application history as every other task mutation so users can reliably restore an accidentally deleted task.

## What Changes

- Make an accepted task deletion immediately reserve and expose its exact undo intent.
- Keep that undo request bound to the deletion mutation while its task and history projections converge, rather than falling through to “Nothing to Undo” or an older event.
- Restore the deleted task hierarchy and prior planning state when the deletion is undone.
- Add regression coverage for delete, projection lag, and successful restoration.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify that an accepted recoverable task deletion must become the newest undoable action immediately and remain addressable while its authoritative projections settle.

## Impact

- Tasks module undo cursor and pending forward-mutation coordination.
- Recoverable task deletion from row menus, keyboard commands, and bulk-edit surfaces that use the shared transition path.
- Tasks history regression tests and the existing personal Tasks OpenSpec capability.
- No Supabase schema, migration, PowerSync table, or API change is expected.
