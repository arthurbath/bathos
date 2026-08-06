## Why

Several established Tasks interactions lose continuity on touch devices or at edge cases: recurrence prototypes do not receive ordinary open-task scroll alignment, scrolling can accidentally open an ellipsis menu, and an emptied Today bucket cannot accept its own dragged final task. Shared toast placement and switch-thumb geometry also need small viewport-relative corrections.

## What Changes

- Apply the ordinary best-effort scroll-to-summary behavior when opening an Upcoming recurrence prototype.
- Give recurrence-prototype metadata drawers the same staged opening and delayed closing animation as ordinary to-do drawers.
- Make a recurrence-prototype title click replace an already open recurrence prototype in one coordinated close-and-open transaction.
- Distinguish a touch scroll gesture that starts on an ellipsis trigger from an intentional tap, preventing or dismissing the menu once scrolling begins.
- Preserve a temporary drop target for the source Today bucket while its final task is being dragged so the user can return the task to its original bucket.
- Anchor desktop and tablet toast stacks to the viewport's bottom-right corner rather than the bounded content column.
- Balance the shared switch thumb's one-pixel inset in both off and on positions.
- Compact task-row metadata at mobile widths by showing reminder bells without times, numeric month-day dates, and signed day offsets with a `d` suffix.
- Show the effective Start date on every ordinary task and recurrence prototype rendered inside a generic Upcoming month bucket, including deadline-only tasks whose Start is implicit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Align recurrence-prototype opening and touch drag/menu behavior with ordinary task interactions, and preserve second-row metadata within constrained mobile widths.
- `platform-visual-foundations`: Anchor wide-screen toasts to the viewport and balance shared switch-thumb geometry.

## Impact

- Tasks list rows and their responsive metadata, Upcoming month-bucket projection, recurrence-prototype open and replacement handling, ellipsis triggers, and Today drag/drop bucket rendering.
- Shared toast viewport positioning and shared switch styling.
- Frontend interaction and component tests only; no database, API, migration, dependency, or native-bundle change is expected.
