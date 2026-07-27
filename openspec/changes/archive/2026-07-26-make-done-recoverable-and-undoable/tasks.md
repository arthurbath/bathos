## 1. History Coordination

- [x] 1.1 Add a synchronous forward-mutation reservation API that settles with the accepted task mutation identifier or cancellation
- [x] 1.2 Integrate reservations with task update, move, reorder, lifecycle, and bulk mutation paths before asynchronous persistence begins
- [x] 1.3 Make undo wait for the newest reservation, exact history event, and matching task projection without substituting older history
- [x] 1.4 Preserve redo cursor behavior and safely cancel failed or timed-out reservations

## 2. Recoverable Done Interface

- [x] 2.1 Replace completed-task archive actions with checked leading controls that reopen tasks
- [x] 2.2 Replace deleted-task restore buttons with leading trash controls that reveal restore iconography on hover or keyboard focus
- [x] 2.3 Preserve Done task focus, selection, source links, terminal dates, hierarchy-safe restoration, and absence of permanent deletion
- [x] 2.4 Align Done task rows with the dense rounded task-card presentation

## 3. Regression Coverage

- [x] 3.1 Test completion undo before the forward write returns and during delayed history/task projection
- [x] 3.2 Test completion undo and redo through repository and history snapshot boundaries
- [x] 3.3 Test failed-reservation cancellation and rejection of older or unrelated history substitution
- [x] 3.4 Test completed, canceled, and deleted Done controls through pointer and keyboard interaction
- [x] 3.5 Test completion undo when the synchronized PostgreSQL history snapshot and local task projection encode the same terminal instant differently
- [x] 3.6 Test Command-Shift-Z and Control-Shift-Z as captured redo aliases
- [x] 3.7 Test neutral history-boundary messages for exhausted cursors and currently invalid historical targets

## 4. Validation and Documentation

- [x] 4.1 Update the durable Tasks specification and human Tasks guide with recoverable Done and exact immediate undo behavior
- [x] 4.2 Run focused Tasks tests, the full Vitest suite, lint, task typecheck, build, and strict OpenSpec validation
- [x] 4.3 Verify rendered Tasks and Done surfaces plus Command-Z capture in the local browser without mutating personal production task data
- [x] 4.4 Audit every change requirement against implementation and evidence
- [x] 4.5 Reproduce complete to Done to Command-Z against the synchronized runtime and verify an authoritative undo event plus restored open task
