## Why

The task editor's paint-only vertical translation keeps disclosure height stable, but it allows the clipping boundary to cut off the focused Title input's ring. The editor needs ordinary layout space for focus decoration while retaining a single fluid opening motion.

## What Changes

- Remove the translated task-editor form.
- Reserve the Title inset with ordinary top padding.
- Animate that padding concurrently with the disclosure row so spacing and content finish in one motion.
- Remove the redundant inner clipping boundary so the Title focus ring can paint into the reserved inset.
- Add regression coverage for the layout, animation, and focus-ring clearance contracts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Require ordinary layout spacing and complete Title focus decoration within the continuous editor disclosure.

## Impact

- Task editor disclosure and form layout in `src/modules/tasks/components/TasksShell.tsx`
- Tasks shell component regression tests
- No database, API, dependency, or cross-module impact
