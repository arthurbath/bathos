## Why

The Tasks command reference still uses verbose key names, obsolete keyboard-reordering guidance, and inconsistent item and date terminology. The module needs a concise reference and one stable vocabulary that matches the product's name and the user's mental model.

## What Changes

- Render modifier keys with compact symbols in the keyboard command reference and capitalize written key or pointer names.
- Rename and trim pointer-selection guidance, and remove keyboard task reordering from both the reference and task-row behavior while preserving pointer drag reordering.
- Use "task" instead of "to-do" in user-facing Tasks copy.
- Use "Deadline" instead of "Due Date" and "Task's Start" instead of "Start Date" or a bare "Start" label in user-facing Tasks controls and reference material.
- Rename the checklist command to "Edit Checklist" without presenting its implementation status.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine the Tasks keyboard reference, remove keyboard reordering, and establish canonical user-facing task and planning terminology.

## Impact

- Tasks command-reference content and task-row keyboard behavior
- User-facing Tasks labels, placeholders, accessible names, tests, and human documentation
- No database, Supabase, PowerSync, API, routing, dependency, or cross-module changes
