## 1. Shared DataGrid Behavior

- [x] 1.1 Add focused non-editing paste replacement to every shared text-like DataGrid cell primitive while preserving native editing paste.
- [x] 1.2 Route pasted replacements through existing normalization, validation, history, optimistic save, rollback, and focus-restoration behavior.
- [x] 1.3 Canonize the focused-cell paste contract in shared project and human-facing DataGrid guidance.

## 2. Regression Coverage

- [x] 2.1 Add focused paste tests for plain text, number, URL, currency, and percentage cells.
- [x] 2.2 Verify editing paste remains native and disabled or non-text controls do not receive focused replacement behavior.
- [x] 2.3 Verify pasted replacements participate in undo/redo and async save rollback behavior.

## 3. Validation

- [x] 3.1 Run targeted DataGrid tests and lint the affected source and test files.
- [x] 3.2 Run the full test, lint, build, and OpenSpec validation suites.
- [x] 3.3 Exercise the focused paste behavior in a rendered local DataGrid and inspect runtime console errors.
