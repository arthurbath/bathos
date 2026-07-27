## 1. Operation-Grouped History

- [x] 1.1 Add and test the Tasks migration for task and history operation identifiers, trigger fallback behavior, indexes, generated types, PowerSync schema, and portability compatibility
- [x] 1.2 Group projected history events into operations while preserving legacy one-event actions
- [x] 1.3 Implement atomic repository undo and redo for every event in one operation with all-member safety validation
- [x] 1.4 Extend undo hook reservations and projection waiting for multi-task forward operations

## 2. Bulk Drop Planning And Persistence

- [x] 2.1 Implement pure visual-order bulk-drop projection for manual Today, Upcoming, Anytime, and Someday ordering
- [x] 2.2 Implement automatic Anytime and Someday subgroup projection with legal-boundary clamping
- [x] 2.3 Implement visible Today horizon, Upcoming date, and Area metadata projection
- [x] 2.4 Implement one transactional repository mutation that materializes the complete order and shares one operation identifier
- [x] 2.5 Add optimistic hook support and per-task Upcoming reminder reconciliation

## 3. Native Drag Interaction

- [x] 3.1 Enable native drag from selected tasks and carry the complete selection in current visual order
- [x] 3.2 Render and retain the last valid bulk drop indicator across legal and illegal automatic-sort regions
- [x] 3.3 Commit only accepted in-app drops, keep successful groups selected, and make dragend mutation-free
- [x] 3.4 Cancel transient drag state and selection when BathOS receives Escape without adding custom pointer or scrolling behavior

## 4. Verification

- [x] 4.1 Add domain tests for visual ordering, visible buckets, automatic subgroup clamping, and mixed selections
- [x] 4.2 Add repository and hook tests for atomic persistence, optimistic projection, grouped undo and redo, and rollback
- [x] 4.3 Add shell tests for drag initiation, drop metadata, retained selection, reminder reconciliation, and cancellation
- [x] 4.4 Run focused tests, full tests, lint, build, OpenSpec validation, migration checks, and rendered browser QA
- [x] 4.5 Report the unapplied production migration and exact deployment acceptance requirements

Rendered browser QA remains pending because the browser's local-URL safety policy blocked reloading the localhost tab after the development server started. All automated and database checks in 4.4 are complete.
