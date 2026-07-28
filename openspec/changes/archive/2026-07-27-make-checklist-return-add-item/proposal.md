## Why

Checklist rows currently expose an overly verbose placeholder and allow unmodified Return to reach the surrounding task form, which closes the task instead of continuing checklist entry. Checklist entry should behave like a lightweight list editor so a user can type consecutive items without leaving the task.

## What Changes

- Change every empty checklist-item input placeholder to `Item`.
- Make unmodified Return inside a checklist-item input create and focus the next checklist row.
- Keep Return field-owned so it cannot submit or close the surrounding task editor.
- Preserve composition, autosave, and existing checklist cleanup behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Define the checklist-item placeholder and Return-created next-row behavior.
- `form-control-interactions`: Establish the checklist row as a specialized single-line control that owns Return instead of submitting its surrounding form.

## Impact

The change is limited to the Tasks checklist editor, its component tests, and the two affected durable specifications. It requires no database, Supabase, PowerSync, MCP, dependency, or cross-module change.
