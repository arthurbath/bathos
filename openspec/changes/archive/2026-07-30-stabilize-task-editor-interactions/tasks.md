## 1. Area Stability

- [x] 1.1 Preserve active field focus and caret through Area shortcut mutations
- [x] 1.2 Verify open tasks retain visible and invisible placement until close

## 2. History and Escape

- [x] 2.1 Route undo/redo to focused task editors without also invoking global history
- [x] 2.2 Layer Escape across nested surfaces and the task editor

## 3. Verification

- [x] 3.1 Add focused regression tests for Area, history, and Escape behavior
- [x] 3.2 Run targeted and full validation plus rendered keyboard QA

## 4. Floating Creation During Editing

- [x] 4.1 Fade and disable the floating New Task action while a new or existing task drawer is open
- [x] 4.2 Add regression coverage for hidden, non-interactive, and restored floating-action states

## 5. Open Task Highlight

- [x] 5.1 Apply the established blue task-highlight background across the open task summary and metadata drawer
- [x] 5.2 Add regression coverage and rendered desktop/mobile verification for the unified open-task surface
- [x] 5.3 Deepen the open-task highlight without changing closed focus and selection styling, then verify muted-content contrast
- [x] 5.4 Further reduce the open-task highlight opacity while retaining the established blue hue and brighter closed focus/selection styling
- [x] 5.5 Match keyboard-focus and selection-mode task highlights to the approved open-task opacity across active and Done task rows

## 6. Planning-Write Recovery

- [x] 6.1 Add a bounded, exact-match retry for transient OPFS access-handle conflicts on single and bulk task-planning transactions
- [x] 6.2 Add regression coverage and run focused, full, OpenSpec, and rendered verification
