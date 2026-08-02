## Why

Reminder metadata currently uses the same blue reserved for controls that open external destinations, incorrectly implying that the reminder is an outbound link. Reminder metadata should instead read as ordinary secondary information.

## What Changes

- Render the reminder icon and time in a task's second metadata line with the standard muted gray metadata color.
- Preserve blue for task-row Primary Link controls that navigate to an external website or application.
- Add regression coverage for reminder and external-link color semantics.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify that reminder metadata is neutral secondary information rather than an external-link affordance.

## Impact

- Tasks task-row metadata styling and focused component coverage.
- No database, API, native companion, or persistence changes.
