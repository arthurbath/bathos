## 1. Connector Policy

- [x] 1.1 Add a distinct superseded outcome for conflicting task PATCHes explicitly marked as system-authored maintenance
- [x] 1.2 Record a content-free supersession receipt and complete the transaction without rebasing stale system maintenance
- [x] 1.3 Preserve the existing rebase and missing-task retry behavior for user-authored and actor-absent task PATCHes

## 2. Regression Coverage

- [x] 2.1 Cover current, stale-revision, and missing-task system maintenance PATCHes
- [x] 2.2 Cover a mixed maintenance transaction that continues after a superseded row
- [x] 2.3 Re-run existing user conflict, completion, and planning-race connector coverage

## 3. Validation And Release

- [x] 3.1 Run focused Tasks sync tests, lint, TypeScript build, production build, and strict OpenSpec validation
- [ ] 3.2 Publish the repair and verify Safari drains the stale system queue without recreating missing recurrence instances
- [ ] 3.3 Verify the Mac container retains and uploads its user-authored pending changes, then record content-free release evidence
