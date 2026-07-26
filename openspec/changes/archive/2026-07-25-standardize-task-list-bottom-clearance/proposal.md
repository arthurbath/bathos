## Why

Tasks lists currently reserve different bottom space depending on whether bulk selection is active. This allows floating creation, selection, and mobile-navigation surfaces to cover the final tasks in some views, and the recently approved Title inset also needs a final two-pixel increase.

## What Changes

- Increase the expanded task editor's ordinary top padding from four to six pixels while keeping it in the existing synchronized disclosure transition.
- Replace mode-dependent page-bottom padding with one safe-area-aware clearance value used by every Tasks view in every selection state.
- Size the shared clearance for the largest floating Tasks surface so the last task can scroll completely above it.
- Add regression coverage for the shared clearance before and during bulk selection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Increase the Title inset and require uniform list-end clearance beneath floating Tasks controls.

## Impact

- Tasks shell layout and component tests
- Personal Tasks durable specification
- No database, API, dependency, or cross-module impact
