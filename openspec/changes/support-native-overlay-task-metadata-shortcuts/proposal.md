## Why

Global Quick Entry reuses the ordinary Tasks editor, but macOS can consume Control-based editing chords such as Control+E before WebKit delivers them to the task command handler. The overlay therefore loses the metadata shortcuts users rely on in an open task even though it presents the same metadata controls.

## What Changes

- Forward the supported Control-based task metadata shortcuts from the native quick-entry panel into its hosted Tasks editor.
- Restrict the overlay command set to Start, horizon, Reminder, Deadline, actionability, Someday, checklist, and Area operations.
- Keep task and list navigation, capture, completion, selection, close-task, and unrelated application commands inactive in Global Quick Entry.
- Add web and macOS regression coverage for both the supported and excluded command sets.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Define which task metadata commands the native quick-entry draft accepts and which ambiguous task/list commands it ignores.
- `tasks-macos-companion`: Require the native panel to forward the supported Control chords before AppKit text editing consumes them.

## Impact

This affects the Tasks keyboard-command policy, the quick-entry branch of the shared task shell, the macOS quick-entry panel event bridge, and focused React and Swift tests. It requires no database, migration, dependency, or public API change.
