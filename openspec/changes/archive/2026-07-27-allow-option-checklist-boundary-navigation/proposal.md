## Why

Checklist items intentionally behave like separate lines in one continuous editing surface. On macOS, Option+Left Arrow and Option+Right Arrow should preserve that continuity when native word navigation reaches an item boundary instead of stopping at the edge of one checklist input.

## What Changes

- Allow macOS Option+Left Arrow at the beginning of a checklist item to move to the end of the preceding item.
- Allow macOS Option+Right Arrow at the end of a checklist item to move to the beginning of the following item.
- Preserve native Option word navigation inside an item and preserve Command, Control, Shift, selection, outer-boundary, and non-macOS Alt behavior.
- Cover persisted and draft checklist rows with focused keyboard regression tests and rendered macOS browser verification.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Expand checklist horizontal boundary traversal to support macOS Option-modified arrows without changing native text or browser behavior elsewhere.

## Impact

- Tasks checklist keyboard handling in `TaskChecklistEditor`.
- Tasks checklist component tests and the durable personal Tasks specification.
- No database, Supabase, API, dependency, or cross-module changes.
