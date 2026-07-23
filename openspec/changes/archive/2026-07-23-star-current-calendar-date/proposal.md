## Why

BathOS date pickers currently distinguish today with the same numeric day label and only a subtle background treatment. A consistent star convention will make the current day and current month immediately recognizable across every shared calendar without competing with the separate selected-value highlight.

## What Changes

- Replace today’s numeric day label with Lucide’s `Star` icon when today appears in its own calendar month.
- Add the same `Star` icon to the right of today’s month name in the shared month picker.
- Preserve the existing selected-date and selected-month highlight treatments independently from the current-period star.
- Apply the convention through the shared Calendar so Start, Deadline, and all other BathOS date pickers inherit it.
- Preserve accessible date and month names for icon-marked controls.

## Capabilities

### New Capabilities

- `shared-date-picker-indicators`: Defines the global current-day and current-month visual and accessibility convention for BathOS calendars.

### Modified Capabilities

- `personal-tasks-module`: Replaces the existing Tasks today highlight contract with the shared star convention while retaining selected-value highlighting.

## Impact

- Shared UI primitive: `src/components/ui/calendar.tsx`
- Shared Calendar regression coverage
- Tasks Start and Deadline pickers inherit the change without module-specific rendering
- No dependency, API, database, migration, or production-data changes
