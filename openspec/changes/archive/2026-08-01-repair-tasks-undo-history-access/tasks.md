## 1. History Compatibility

- [x] 1.1 Align the client task mutation-channel vocabulary with the deployed database contract
- [x] 1.2 Normalize retained template-era source snapshots at the task-history decoding boundary
- [x] 1.3 Emit content-free diagnostics when task-history reconstruction still fails

## 2. Regression Coverage

- [x] 2.1 Add domain tests for widget history and template-era snapshot normalization
- [x] 2.2 Add hook coverage proving compatible retained history does not disable a newer undo and redo path

## 3. Verification

- [x] 3.1 Run focused task-history and Tasks shell tests
- [x] 3.2 Run TypeScript, lint, build, application tests, and strict OpenSpec validation
- [x] 3.3 Verify in the rendered Tasks app that the existing cursor enables Undo, Undo enables Redo, and Redo restores the original state
