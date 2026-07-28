## 1. Selection Focus Fix

- [x] 1.1 Remove incidental task-summary DOM focus after accepted pointer selection gestures
- [x] 1.2 Preserve keyboard-established whole-task focus and all existing selection membership behavior

## 2. Regression Coverage

- [x] 2.1 Cover platform-modifier selection followed by bare Shift without visible task focus
- [x] 2.2 Cover Shift-click range selection followed by bare Shift without visible task focus
- [x] 2.3 Confirm existing keyboard traversal still establishes whole-task focus

## 3. Verification And Closeout

- [x] 3.1 Run focused tests, Tasks type checking, lint, build, and strict OpenSpec validation
- [x] 3.2 Verify the modified-click selection flow in the rendered Tasks interface
- [x] 3.3 Sync the durable specification and archive the completed change
