## Why

Quick Find retains its previous query after dismissal or result activation, so reopening it can expose stale search text rather than a fresh lookup. Every completed Quick Find session should discard its transient query.

## What Changes

- Clear the Quick Find query whenever the palette closes, regardless of dismissal method.
- Clear the query before navigating from an activated task, recurrence prototype, or See All Results action.
- Add regression coverage for dismissal and result-navigation reset behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Quick Find sessions reset their query after closing or activating a destination.

## Impact

This is a Tasks web UI behavior refinement affecting `TaskQuickFind.tsx`, Tasks shell integration coverage, and the existing personal Tasks behavior contract. It changes no database schema, synchronization behavior, native companion implementation, dependency, or public API.
