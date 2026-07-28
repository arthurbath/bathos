## Why

Collapsed task rows should surface actionability near the reminder and deadline signals that most directly govern whether and when work can be acted upon. The current placement after Deadline and Checklist separates that state from the reminder indicator and no longer matches the desired scanning order.

## What Changes

- Move the optional non-Ready actionability indicator to immediately after Reminder and before Deadline in collapsed task-row secondary metadata.
- Preserve the relative order and conditional visibility of Area, Anytime horizon, Reminder, Deadline, and Checklist.
- Update focused regression coverage and the durable Tasks metadata-order contract.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Change the canonical secondary metadata order for collapsed task rows.

## Impact

- `src/modules/tasks/components/TasksShell.tsx`
- `src/modules/tasks/components/TasksShell.test.tsx`
- `openspec/specs/personal-tasks-module/spec.md`
- No database, Supabase, PowerSync, synchronization, or persistence impact.
