## Why

Bulk reminder entry currently uses a native time input with stricter browser-owned formatting, while the task Start picker accepts natural shorthand and presents a two-step keyboard confirmation model. The mismatch makes the same reminder action behave differently depending on whether one task or multiple tasks are targeted.

## What Changes

- Replace the bulk reminder native time control with the same text-input presentation used by the Start picker.
- Resolve the same bounded reminder shorthand grammar into the same normalized local-time display.
- Make the first Return normalize a changed value without submitting, then make a second Return on the unchanged normalized value apply the reminder to the selected tasks.
- Keep invalid input in the dialog, restore the empty bulk value, and show the established `Not allowed.` toast.
- Correct the Start picker so its existing durable two-Return contract is reflected in implementation and tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Extend flexible reminder-time entry to the bulk reminder surface and enforce the existing two-step Return contract consistently.

## Impact

- Tasks module only.
- Affects `TaskBulkCommandDialog`, `TaskStartPicker`, their Tasks-shell integration, and focused tests.
- Reuses the existing reminder-time parser, planning time zone, reminder persistence, and toast behavior.
- No database, Supabase, PowerSync, MCP, or external API changes.
