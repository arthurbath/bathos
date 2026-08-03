## 1. Completion State

- [x] 1.1 Apply checklist completion and final order optimistically before awaiting repository persistence.
- [x] 1.2 Roll back the optimistic checklist completion projection when persistence fails.

## 2. Completion Motion

- [x] 2.1 Replace rolling row-position history with one completion-scoped before/after layout snapshot.
- [x] 2.2 Prevent reconciliation renders from replaying the motion and honor reduced-motion preferences.

## 3. Verification

- [x] 3.1 Add hook tests for immediate optimistic completion, stable persistence reconciliation, and rollback.
- [x] 3.2 Add editor tests for one consumed completion animation transaction and reduced-motion behavior.
- [x] 3.3 Run focused Tasks tests, lint, build, OpenSpec validation, and rendered QA when the preview connection is available.
