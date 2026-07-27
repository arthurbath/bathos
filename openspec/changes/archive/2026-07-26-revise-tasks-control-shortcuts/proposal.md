## Why

The current Control-based Tasks shortcuts no longer match the user's preferred one-handed keyboard layout and require switching modifier fingerings for Undo. A revised compact cluster keeps the most frequent task actions under one Control-key scheme while preserving standard platform undo and redo expectations.

## What Changes

- **BREAKING** Replace the existing Control-based task-command assignments with the new Q/W/E/R/T, A/S/D/F/G, and Z/X/C/V/B layout.
- Add Control+Z as a Mac Tasks Undo alias without removing Command+Z.
- Preserve Control+Z as Windows Undo and Control+Shift+Z as Windows Redo.
- Map the Tasks-specific Control layer on Mac to Alt+Shift on Windows, including Alt+Shift+Z as an additional Tasks Undo chord, so the task layer cannot collide with Windows Redo.
- Remove the displaced Control assignments so each chord has one current meaning.
- Use slash-separated alternate chords in the Undo and Close Open Task rows, matching the existing Redo presentation.
- Update the Keyboard Commands dialog, human guide, durable specification, and regression coverage to the revised layout.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Revise the Tasks-specific Control shortcut contract and document the platform-specific Undo exception.

## Impact

This affects the Tasks keyboard-command mapper, shell command dispatch tests, keyboard-reference copy, human Tasks guide, and personal Tasks specification. It changes no database schema, Supabase object, synchronization behavior, production data, dependency, or public API.
