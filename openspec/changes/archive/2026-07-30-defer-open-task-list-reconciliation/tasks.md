## 1. Projection Retention

- [x] 1.1 Extend close-settling detection to every current projection determinant, including actionability-driven filtering and automatic sorting.
- [x] 1.2 Keep the accepted task metadata visible while retaining the original list, bucket, and ordering slot through the completed drawer-close lifecycle.

## 2. Regression Coverage

- [x] 2.1 Cover editor-control changes that would move an open task between visible buckets or out of the current filter.
- [x] 2.2 Cover keyboard-shortcut metadata changes with the same stable open-task placement and post-close reconciliation.
- [x] 2.3 Verify existing close animation, reduced-motion, autosave, and current departure-toast behavior remain intact.

## 3. Validation

- [x] 3.1 Run focused Tasks tests, Tasks TypeScript validation, lint, build, and strict OpenSpec validation.
- [x] 3.2 Verify the rendered open-edit-close flow in the local Tasks app without leaving test data behind.
