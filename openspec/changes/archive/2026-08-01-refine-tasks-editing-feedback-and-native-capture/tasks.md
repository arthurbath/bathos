## 1. Task Row And Selection Entry

- [x] 1.1 Restore rendered summary content as the open task drag handle while retaining the Summary input in the metadata drawer.
- [x] 1.2 Make initial Command-click and Shift-click close and clear a different open or focused task and select only the clicked task.
- [x] 1.3 Add task-list regression coverage for open-row drag initiation and modified-click selection entry.

## 2. Shared Input Visual Convention

- [x] 2.1 Inventory ordinary shared form primitives and introduce one solid muted-gray input-outline token and class treatment.
- [x] 2.2 Preserve brighter focus indication and explicit DataGrid border exceptions.
- [x] 2.3 Update visual-foundation documentation and add focused shared-control regression coverage.

## 3. Undo And Redo Feedback

- [x] 3.1 Add one operation-owned busy state around every accepted task undo and redo path.
- [x] 3.2 Render an immediate centered spinner overlay that blocks duplicate history traversal until settlement.
- [x] 3.3 Test success, boundary, and failure cleanup for both undo and redo.

## 4. iOS Landscape And Software Keyboard

- [x] 4.1 Enable the supported iPhone landscape orientations in the iOS companion target.
- [x] 4.2 Detect software-keyboard viewport contraction around editable focus and hide mobile navigation until it ends.
- [x] 4.3 Add native metadata and web responsive-behavior tests for landscape and keyboard visibility.

## 5. macOS Global Quick Entry

- [x] 5.1 Resize the quick-entry panel around the compact Start picker with balanced padding and unclipped focus outlines.
- [x] 5.2 Present a native loading spinner until one stable ready-editor reveal and eliminate intermediate flashing.
- [x] 5.3 Add explicit Save and submit-key commit semantics to the quick-entry web editor and bridge.
- [x] 5.4 Make Escape, panel dismissal, and a second global shortcut cancel the quick-entry draft and close the panel.
- [x] 5.5 Add web and native tests for loading, toggle close, explicit commit, and persisted-draft cancellation.

## 6. Validation

- [x] 6.1 Run focused Tasks, shared-control, platform, iOS, and macOS tests.
- [x] 6.2 Run the full test suite, lint, production build, strict OpenSpec validation, and diff checks.
- [x] 6.3 Perform rendered desktop and mobile QA for the web behaviors and build the iOS and macOS companions without installing or publishing them.
