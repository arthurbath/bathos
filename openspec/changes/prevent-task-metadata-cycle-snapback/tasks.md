## 1. Optimistic Reconciliation

- [x] 1.1 Retain an accepted local task as a display high-water value while the watched query is at an older revision
- [x] 1.2 Allow a missing, newer, or equally revised divergent query row to supersede the retained task

## 2. Regression Coverage

- [x] 2.1 Cover horizon movement through accepted, stale, and newer query projections
- [x] 2.2 Cover Area and Actionability updates through accepted, stale, and newer query projections

## 3. Validation

- [x] 3.1 Run focused Tasks hook and shortcut tests
- [x] 3.2 Run type checks, lint, build, and OpenSpec validation
- [x] 3.3 Verify the shortcut interaction in the rendered local Tasks app
