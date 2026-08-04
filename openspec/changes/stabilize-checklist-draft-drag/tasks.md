## 1. Checklist Draft Lifecycle

- [x] 1.1 Remove empty or whitespace-only checklist drafts when their input loses focus.
- [x] 1.2 Preserve authored draft autosave and active draft reordering behavior.

## 2. Drag Feedback

- [x] 2.1 Assign each checklist insertion boundary to one rendered drop indicator.
- [x] 2.2 Add regression coverage for blank-draft cleanup and single-indicator rendering.

## 3. Validation

- [x] 3.1 Run the targeted checklist editor tests and static checks.
- [x] 3.2 Verify the blank-draft and drag-indicator behavior in the rendered Tasks UI.

## 4. Persisted Checklist Reordering Regression

- [x] 4.1 Add a regression test that exercises the real checklist controller through a completed reorder save.
- [x] 4.2 Keep the dropped checklist order stable while persistence and query synchronization settle.
- [x] 4.3 Run targeted automated tests and rendered component QA for persisted checklist reordering.

## 5. Authoritative Checklist Reorder Convergence

- [x] 5.1 Add sync regression coverage for a checklist reorder that encounters a newer remote revision.
- [x] 5.2 Rebase and retry stale checklist hierarchy patches without widening their field-level mutation scope.
- [x] 5.3 Run the focused controller, editor, and sync tests plus rendered Tasks QA.

## 6. Checklist Lifecycle Robustness

- [x] 6.1 Add regression coverage for create, completion, and reorder operations against legacy numeric checklist ranks.
- [x] 6.2 Make task-close flushing and draft blur commit one logical checklist item exactly once.
- [x] 6.3 Consume interactive checklist mutation failures with user-facing error feedback.
- [x] 6.4 Verify a preexisting checklist and a newly created checklist through create, complete, reorder, close, and reopen flows.
