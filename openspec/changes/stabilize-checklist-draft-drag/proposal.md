## Why

An abandoned blank checklist draft currently remains in the editor and can claim the same drag insertion boundary as its neighboring persisted item. This leaves confusing empty rows and can render two blue placement lines for one drop position.

## What Changes

- Remove an empty or whitespace-only checklist draft immediately when its input loses focus.
- Preserve the existing blur-to-save behavior for authored checklist drafts.
- Ensure each logical checklist insertion position renders exactly one placement indicator, including while a transient draft occupies that boundary.
- Cover the draft lifecycle and drop-indicator ownership with regression tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify transient checklist draft cleanup and unique checklist drop-boundary feedback.

## Impact

- `src/modules/tasks/components/TaskChecklistEditor.tsx`
- `src/modules/tasks/components/TaskChecklistEditor.test.tsx`
- No database, API, migration, native-companion, or dependency changes.
