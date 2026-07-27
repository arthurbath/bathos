# Tasks Checklists, Recurrence, And Terminal Editing Release

**Date:** 2026 Jul 27
**Category:** Product / Production / Trust
**Status:** Accepted

## Outcome

The expanded checklist, recurrence, terminal editing, deletion, and Done release is accepted in production. Tasks now provides directly editable and reorderable task checklists, revisioned calendar and after-completion recurrence, repeating-task presentation in Upcoming, recoverable task deletion, editable terminal tasks, owner-local Done buckets, canonical task-state iconography, and ordinary single-line Return form submission while retaining field-owned composite behavior.

Migration `20260727064241_expand_tasks_recurrence_rules_and_terminal_editing.sql` is recorded locally and remotely. It added the approved recurrence rule and terminal-editing schema without rewriting personal task content. The matching web release is deployed, the disposable production fixture passed, and independent cleanup returned every content-free Tasks count to its predeployment value.

## Recovery Boundary

The owner-only data backup is:

`2026-07-27T054307-0700-pre-expand-tasks-recurrence-terminal-editing.sql`

It is 4,055,625 bytes, contains the complete public Tasks and private recovery data sections, ends with PostgreSQL's completion marker, and produced the same SHA-256 digest on both verification reads:

`1577e5e0e770058cf8a20e699929e8f94c0c8230b2acbda733a29dd1ab7ab795`

The data-only dump reports the expected circular foreign-key warning for recurrence occurrences. A controlled replacement restore must therefore recreate or defer the affected constraints before loading that section. The warning did not interrupt or invalidate the dump.

## Production Acceptance

- The preflight baseline contained 28 tasks, 19 present open tasks, 3 completed tasks, 0 trashed tasks, 3 checklist items, 0 recurrence definitions, 0 recurrence revisions, 0 recurrence occurrences, and 634 task history events.
- The migration added all 7 expected columns, retained the existing recurrence triggers, and installed the authenticated-only `tasks_create_recurrence_from_task` and `tasks_evaluate_recurrence` security-definer functions without anonymous or public execution.
- The owner-scoped acceptance fixture proved checklist creation and editing, recurrence definition and occurrence creation, terminal task editing while completed and deleted, fresh PowerSync projection, reopening and restoration, and complete owner cleanup.
- Independent post-cleanup queries returned every content-free count to the exact preflight baseline and found zero synthetic users, tasks, or recurrence records.
- PowerSync remains ready with exactly 20 approved Tasks tables and exactly 20 corresponding replication-role `SELECT` grants.
- The reminder dispatch, reached-Start activation, and Done-retention jobs remain active once per minute. Each job's latest inspected run succeeded.
- The production database linter found no new Tasks error. Its failing exit remains caused by the two pre-existing Drawers functions that reference `public.drawers_insert_instances`. Existing Tasks unused-variable warnings are unchanged.
- Security and performance advisor review found no new table, publication, index, owner-isolation, or anonymous-execution regression from this release. Existing informational findings remain governed by their prior decisions.

## Web Release

Commit `85fe05757aaa2793e6a1cd378a8e75da535e0b34` was pushed to `main` and published through Lovable deployment `8dfef85c-db47-4482-b1a6-4c0b747ac183`.

Production serves entry bundle `index-Crio3dVJ.js` and Tasks chunk `TasksIndex-_iK216i2.js`. The Tasks chunk SHA-256 is:

`6ea4ed3f5c05b18c8ff86178975a8f5fdbe389fa384ce0980fb83bd6c677cf26`

The live bundle contains the expected checklist, recurrence, Repeating Tasks, Repeat Task, Someday checkbox, and terminal-action surfaces. Authenticated Safari rendered Today, opened an existing task without mutation, showed its checklist editor and reorder handles, exposed Repeat and Delete in the task menu, and closed the task without changing personal content.

## Validation

- 982 application tests passed and 13 opt-in tests were skipped.
- 672 database tests passed.
- The dedicated production rich-task behavior gate passed.
- TypeScript, ESLint, the Vite production build, `git diff --check`, and strict OpenSpec validation passed.
- The completed OpenSpec change was synchronized into the durable form-control and personal-tasks specifications and archived as `2026-07-27-expand-tasks-checklists-recurrence-and-done`.

## Rollback

Before client adoption, rollback is a prior web republish plus a controlled database restore from the verified private backup. After recurrence definitions or terminal edits are created under the new contract, an application-only rollback is unsafe because older clients do not understand the expanded recurrence and terminal state. Recovery must restore the verified backup, redeploy the prior web release, and prove the 20-table PowerSync projection before mutation resumes.
