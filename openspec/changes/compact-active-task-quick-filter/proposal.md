## Why

The compact Quick Filters trigger now fits the Tasks toolbar, but its mutually exclusive presets make the user reason about overlapping actionability concepts such as Not Ready. Because Tasks has exactly three actionability states, the control should expose those states directly as a small multi-select while retaining the compact active presentation.

## What Changes

- Keep the Quick Filters trigger icon-sized whether the list is filtered or unfiltered.
- Reuse the Select Tasks active-button treatment to indicate that a quick filter is active.
- Replace the radio menu with checked Ready, Rechecking, and Waiting options in that order.
- Treat all three checked as the unfiltered default and reset an attempted empty selection to that default.
- Show the remaining checked actionability states directly beneath the current list title when fewer than three remain.
- Preserve owner-wide cross-device persistence and native widget parity through a compatible seven-value scalar encoding.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Change Tasks quick filtering to an actionability multi-select while retaining its compact presentation and durable preference.

## Impact

- Tasks list toolbar and heading markup in `src/modules/tasks/components/TasksShell.tsx`.
- Shared Tasks quick-filter domain mapping, preference tests, and native widget projections.
- A compatible database constraint and background widget projection migration for the two newly expressible actionability combinations.
