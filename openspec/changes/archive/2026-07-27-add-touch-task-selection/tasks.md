## 1. Touch Selection Gesture

- [x] 1.1 Add touch-pointer-only left-swipe tracking to task summary rows with the approved distance, directional, cancellation, and viewport-edge boundaries
- [x] 1.2 Enter the existing selection state with the swiped task selected and suppress the gesture's synthetic click
- [x] 1.3 Preserve native vertical scrolling and the existing native grouped drag path

## 2. Selection Interaction Revision

- [x] 2.1 Make ordinary task-summary activation toggle task membership whenever selection mode is active
- [x] 2.2 Preserve automatic selection-mode exit after the final selected task is deselected
- [x] 2.3 Rename the selection toolbar action from Select None to Cancel

## 3. Regression Coverage

- [x] 3.1 Cover qualifying touch swipe, non-touch input, short and vertical movement, viewport-edge starts, pointer cancellation, and post-swipe click suppression
- [x] 3.2 Cover full-row selection toggling for Lasso, modified-click, and swipe entry, including final-task deselection
- [x] 3.3 Cover Cancel labeling and the unchanged native grouped-drag selection contract

## 4. Verification And Closeout

- [x] 4.1 Run focused tests, Tasks type checking, lint, build, and strict OpenSpec validation
- [x] 4.2 Verify the touch-pointer gesture in rendered component integration and the revised selection flow in a mobile rendered browser
- [x] 4.3 Sync the durable specification and archive the completed change
