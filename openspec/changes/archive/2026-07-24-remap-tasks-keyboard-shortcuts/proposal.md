## Why

The Tasks keyboard map has grown beyond its original layout and now makes frequent metadata actions uncomfortable to reach. The revised map groups Tasks-specific commands on the left side of the keyboard and moves view navigation to familiar application-modifier number shortcuts.

## What Changes

- **BREAKING**: Replace the existing Mac Control and Windows Control+Shift Tasks-specific key map with the revised left-side layout.
- **BREAKING**: Move Today, Upcoming, Anytime, Someday, Done, and Config navigation to Command+1 through Command+6 on Mac and Control+1 through Control+6 on Windows.
- Add direct task commands for clearing Start and moving work to Someday.
- Preserve standard application commands for undo, redo, selection, duplication, clipboard operations, and closing an open task while removing superseded bindings.
- Update the in-app keyboard reference, accessibility metadata, human guidance, and automated coverage for both platforms.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Replace the Tasks keyboard command map and define the new direct Start and Someday behaviors.

## Impact

The change affects the Tasks keyboard gesture resolver, Tasks shell command dispatch, keyboard-help UI, accessibility shortcut descriptions, Tasks human guidance, durable Tasks specifications, and related unit and rendered interaction tests. It does not change Supabase schema, MCP behavior, or dependencies.
