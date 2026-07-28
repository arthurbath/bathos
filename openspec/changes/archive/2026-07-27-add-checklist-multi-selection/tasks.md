## 1. Selection Model

- [x] 1.1 Add checklist-local selected-ID and anchor state with focused-item, additive Command-click, and anchored Shift-click behavior
- [x] 1.2 Add semantic selected-row presentation, ordinary-click deselection, and reconciliation when checklist rows disappear

## 2. Group Actions

- [x] 2.1 Extend the native checklist handle drag path to move selected persisted items as one visual-order group and retain their selection after drop
- [x] 2.2 Add grouped Delete and Backspace handling without changing ordinary single-item text editing or checkbox behavior
- [x] 2.3 Add optimistic hook helpers for deterministic grouped reorder and deletion through existing Tasks repositories

## 3. Verification

- [x] 3.1 Add focused tests for selection ranges, additive toggles, deselection, grouped drag order, post-drop selection, grouped deletion, and unchanged ordinary interactions
- [x] 3.2 Run targeted tests, TypeScript, lint, full tests, build, rendered frontend checks, and strict OpenSpec validation
