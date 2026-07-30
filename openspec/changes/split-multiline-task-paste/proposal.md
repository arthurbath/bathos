## Why

Pasting a multiline list into Tasks currently produces one task with embedded line breaks, while checklist inputs retain only ordinary single-line input behavior. Treating clipboard lines as task or checklist-item boundaries makes common list capture fast and predictable from both plain-text and rich-text sources.

## What Changes

- Split ordinary multiline clipboard text into one new to-do per nonempty line when Tasks owns the paste command outside an editable field.
- Preserve the existing structured task clipboard envelope and ordinary single-line paste behavior.
- Split multiline text pasted into a checklist input across adjacent checklist items using the current selection and caret as the insertion boundary.
- Allow selected checklist items to be copied or cut as a versioned internal clipboard payload that preserves their visible order, text, and completion state.
- Allow a focused checklist input on another task to paste that structured payload into the checklist at the focused row, including in the middle of an existing checklist.
- Match task-level clipboard success and failure treatment for checklist-item Copy and Cut, preserve failure reporting for Paste, and let successful Paste remain silent because the inserted rows provide direct confirmation.
- Preserve source order, support LF, CRLF, and bare CR line endings, and leave native paste behavior unchanged in other editable controls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Expand task and checklist clipboard requirements to interpret multiline ordinary text as ordered task or checklist-item input.

## Impact

This change affects the Tasks clipboard domain, Tasks shell paste orchestration, checklist selection and editing, checklist-item creation, and their focused tests. It adds no database schema, Supabase function, managed secret, native-companion change, or cross-module dependency.
