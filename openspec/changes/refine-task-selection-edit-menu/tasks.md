## 1. Selection Toolbar

- [x] 1.1 Shorten the selected-count message and replace the toolbar controls with Select All, Edit, and Cancel
- [x] 1.2 Add the bulk Edit dropdown with Start, Deadline, Area, Actionability, and Delete while omitting Repeat

## 2. Bulk Editing

- [x] 2.1 Reuse the centered Start and Deadline command surfaces from the bulk Edit menu
- [x] 2.2 Apply Area and Actionability choices atomically across the eligible selection
- [x] 2.3 Apply recoverable Delete across selected active tasks without exiting selection mode

## 3. Selection Reconciliation

- [x] 3.1 Retain selected tasks after edits when they remain visible
- [x] 3.2 Prune tasks that leave the current view while retaining selection mode, including at zero tasks

## 4. Validation

- [x] 4.1 Cover toolbar labels, menu choices, selection retention, partial pruning, and empty post-edit selection with component tests
- [x] 4.2 Run rendered interaction QA, focused tests, TypeScript, lint, build, and strict OpenSpec validation
