## 1. Checklist Forward History

- [x] 1.1 Emit structured action identifiers and timestamps after every accepted checklist insertion, edit, completion, deletion, clipboard mutation, and reorder
- [x] 1.2 Register accepted checklist actions in the checklist undo hook until their matching hierarchy-history operations project
- [x] 1.3 Add bounded exact-action waiting for checklist undo and redo while preserving grouped history operations

## 2. Unified History Routing

- [x] 2.1 Route accepted-pending checklist actions through checklist history before older projected task actions
- [x] 2.2 Preserve cross-stream redo routing and invalidate redo when a new checklist action is accepted
- [x] 2.3 Keep undo and redo controls responsive while exact checklist history is awaiting projection

## 3. Verification

- [x] 3.1 Add hook regression tests for immediate insertion, edit, completion, deletion, and grouped reorder undo and redo
- [x] 3.2 Add shell regression tests for delayed checklist projection and chronological task/checklist routing
- [x] 3.3 Run targeted tests, full tests, lint, build, and OpenSpec validation
