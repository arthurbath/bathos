## Why

An abandoned blank checklist draft currently remains in the editor and can claim the same drag insertion boundary as its neighboring persisted item. This leaves confusing empty rows and can render two blue placement lines for one drop position.

## What Changes

- Remove an empty or whitespace-only checklist draft immediately when its input loses focus.
- Preserve the existing blur-to-save behavior for authored checklist drafts.
- Ensure each logical checklist insertion position renders exactly one placement indicator, including while a transient draft occupies that boundary.
- Keep persisted checklist items at the insertion boundary shown during drag after the drop is saved.
- Keep legacy checklist order keys writable so preexisting and recurrence-generated checklists can be completed, extended, and reordered.
- Commit each authored draft exactly once when blur and task-close flushing overlap.
- Surface checklist write failures as task UI errors instead of unhandled promise rejections.
- Cover the draft lifecycle and drop-indicator ownership with regression tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify transient checklist draft cleanup, unique checklist drop-boundary feedback, stable persisted reordering, legacy-order compatibility, and exactly-once draft commits.

## Impact

- `src/modules/tasks/components/TaskChecklistEditor.tsx`
- `src/modules/tasks/components/TaskChecklistEditor.test.tsx`
- `src/modules/tasks/hooks/useTaskChecklist.ts`
- `src/modules/tasks/hooks/useTaskChecklist.test.tsx`
- `src/modules/tasks/sync/connector.ts`
- `src/modules/tasks/sync/connector.test.ts`
- No database, API, migration, native-companion, or dependency changes.
