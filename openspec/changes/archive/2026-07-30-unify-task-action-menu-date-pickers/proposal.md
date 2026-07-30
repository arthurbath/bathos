## Why

Task planning actions currently diverge by entry point: the expanded editor uses compact shared pickers, while the ellipsis menu and bulk commands add modal chrome and different positioning. The task action menu also exposes obsolete Move and Do workflows instead of the direct metadata actions the user now expects.

## What Changes

- Replace the active task ellipsis menu with Start, Deadline, Area, Actionability, Repeat, and Delete actions.
- Open the same Start and Deadline picker panels used by the expanded task editor without a titled dialog or close button.
- Anchor a single-task picker beneath its task summary after aligning that summary near the top of the visible content area.
- Center Start and Deadline pickers in the viewport for nonempty selection-mode commands.
- Present Area and Actionability as nested context menus, disabling the task's current Actionability value.
- Route the focused-task Control+E and Control+D commands through the same anchored picker surfaces while retaining Start advancement and adding non-committing one-day Deadline advancement for repeated Control+D invocations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Revise the task action-menu contents and the placement and reuse contracts for single-task and selection-mode Start and Deadline commands.

## Impact

The change affects the Tasks shell, task action-menu composition, shared task Start and date-picker panels, bulk command surfaces, task keyboard-command routing, and focused Tasks interaction tests. It changes no database schema, data contract, Supabase object, or cross-module API.
