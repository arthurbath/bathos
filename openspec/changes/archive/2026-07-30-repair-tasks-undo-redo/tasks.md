## 1. Command Reliability

- [x] 1.1 Route documented undo and redo chords to Tasks history from editable controls while preserving active composition
- [x] 1.2 Flush pending task-editor autosaves before choosing a history action
- [x] 1.3 Add focused tests for input-owned commands and pending autosave traversal

## 2. Visible Diagnostics

- [x] 2.1 Add accessible Undo and Redo icon controls to every list header in the specified order
- [x] 2.2 Connect disabled and pending states to the combined task and checklist cursors
- [x] 2.3 Test pointer invocation, ordering, and non-list absence

## 3. Complete History Coverage

- [x] 3.1 Make task creation safely undoable through recoverable deletion and redoable through exact restoration
- [x] 3.2 Group multi-task cut and paste mutations under one atomic history operation
- [x] 3.3 Group multi-item checklist cut, paste, delete, and reorder gestures under one atomic history operation
- [x] 3.4 Reconcile redo invalidation and chronological arbitration across task and checklist history streams
- [x] 3.5 Add database and application tests for text, checklist, metadata, ordering, lifecycle, clipboard, and creation traversal

## 4. Verification

- [x] 4.1 Run focused Tasks history and shell tests
- [x] 4.2 Run database tests, full application tests, TypeScript, lint, build, and strict OpenSpec validation
- [x] 4.3 Verify rendered keyboard and button behavior on representative Tasks lists
- [x] 4.4 Document any production migration or publication approval still required
