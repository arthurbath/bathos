## 1. Selection Model

- [x] 1.1 Add dated recurrence prototypes to the rendered Upcoming selection order and reconciliation logic.
- [x] 1.2 Add prototype pointer, modifier, range, and circular-control selection behavior.
- [x] 1.3 Include prototypes in Select All and counts while preventing partial ordinary-task bulk edits.

## 2. Selection Presentation

- [x] 2.1 Apply canonical prototype selection controls and highlight styling and hide prototype ellipsis controls in selection mode.
- [x] 2.2 Keep the lasso visible as an accessible active toggle and cancel selection on its second activation.

## 3. Upcoming Group Reordering

- [x] 3.1 Carry selected ordinary task IDs and recurrence definition IDs through native drag state.
- [x] 3.2 Persist mixed same-day group ordering while preserving visible relative order.
- [x] 3.3 Keep schedule-ineligible prototypes in their source buckets during cross-day mixed drops.

## 4. Validation

- [x] 4.1 Add regression coverage for prototype selection gestures, lasso toggling, trailing-control suppression, and Select All.
- [x] 4.2 Add regression coverage for mixed same-day and cross-day prototype group drops.
- [x] 4.3 Run targeted tests, lint, strict OpenSpec validation, production build, and rendered Upcoming browser QA.

## 5. Shared Mixed-Selection Editing

- [x] 5.1 Keep Edit enabled for mixed and prototype-only Upcoming selections while limiting the menu to Area, Actionability, and Delete.
- [x] 5.2 Apply Area and Actionability to selected ordinary tasks and recurrence prototypes through their respective guarded mutation paths.
- [x] 5.3 Delete any mixed Upcoming selection by transitioning ordinary tasks and instances and archiving recurrence prototypes.
- [x] 5.4 Add focused mixed-selection menu, submenu, mutation, and deletion regression coverage.
- [x] 5.5 Run targeted and full Tasks tests, lint, strict OpenSpec validation, production build, and rendered Upcoming browser QA.
