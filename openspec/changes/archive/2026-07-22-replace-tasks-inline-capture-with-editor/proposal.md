## Why

The ever-present one-line capture field creates a second, reduced task-creation workflow that does not match direct task editing. Tasks should instead use one complete autosaving editor for both creation and editing, with keyboard commands that remain available throughout the workflow.

## What Changes

- **BREAKING** Remove the persistent Add a Task field from task list views.
- Make Command+N on Mac and Control+N on Windows insert a blank local task draft at the top of the active task list and open the complete task editor.
- Persist the draft as an ordinary task once its title becomes nonblank, while preserving metadata entered before the title.
- Default Today drafts to canonical Today Now and let ordinary task commands modify new work.
- On close, let the ordinary view derivation sort the persisted task and notify the user when its saved planning no longer belongs in the current view.
- Make Command+Return and Escape close any open task editor from any focused editor control.
- Make Command+K toggle pending completion for an open task or every selected task, matching the established completion interaction.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Replace inline title capture with full-editor creation and extend the keyboard creation, close, and completion contracts.

## Impact

- Tasks list shell, task editor integration, list creation hook, keyboard-command mapping, help content, and task-view focus fallbacks.
- Tasks component, hook, command, routing, and rendered interaction tests.
- No database schema, Supabase policy, PowerSync publication, Edge Function, or external integration changes.
