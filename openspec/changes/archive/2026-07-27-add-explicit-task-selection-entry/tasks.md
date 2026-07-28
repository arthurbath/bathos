## 1. Selection Entry

- [x] 1.1 Add the canonical Select Tasks action to selection-capable list headers only
- [x] 1.2 Enter the existing bulk mode with an intentionally empty selection after safely closing open work
- [x] 1.3 Preserve explicit empty mode while retaining automatic exit after last-task deselection
- [x] 1.4 Keep zero-selection toolbar actions disabled and make Select All work for one visible task

## 2. Regression Coverage

- [x] 2.1 Cover header action availability across task lists and exclusion from Config
- [x] 2.2 Cover empty entry, disabled Plan Selected, task selection, final deselection, and one-task Select All

## 3. Verification

- [x] 3.1 Run focused tests, Tasks type checking, lint, build, and strict OpenSpec validation
- [x] 3.2 Verify the rendered point-and-click flow in the local Tasks app
- [x] 3.3 Sync the durable specification and archive the completed change
