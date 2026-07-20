## 1. Discovery and Product Contract

- [x] 1.1 Capture the private-first product posture, tag exclusion, deferred migration, optional native surfaces, and original-expression constraint in OpenSpec.
- [x] 1.2 Perform an initial bounded read-only Things inventory and record only generalized findings in the public repository.
- [ ] 1.3 Catalogue the user's daily capture, planning, execution, review, completion, and rescheduling workflows.
- [ ] 1.4 Define the actionability states that will replace the current tag conventions.
- [ ] 1.5 Define supported source/origin types and the behaviors attached to each origin.
- [ ] 1.6 Define to-do template and project template creation, editing, instantiation, and provenance behavior.
- [ ] 1.7 Inventory relevant Things keyboard behaviors and choose the BathOS keyboard contract for the first daily workflow.
- [ ] 1.8 Select the smallest end-to-end workflow that can provide useful parallel operation.
- [ ] 1.9 Confirm or revise the working `/tasks` route, `tasks_` database namespace, and `src/modules/tasks` source path.
- [ ] 1.10 Select an original user-facing product name and initial icon direction before launcher implementation.

## 2. Architecture Gates

- [ ] 2.1 Compare module-local offline persistence and synchronization approaches against web, Supabase, MCP, and possible native-client requirements.
- [ ] 2.2 Build a disposable spike for offline task creation, restart persistence, reconnection, and server reconciliation.
- [ ] 2.3 Build a disposable spike for stable manual ordering and overlapping reorder conflicts.
- [ ] 2.4 Define the task state machine, including open, completed, canceled, recoverably deleted, and structured actionability states.
- [ ] 2.5 Define start-date, deadline, reminder, time-zone, and daylight-saving semantics.
- [ ] 2.6 Define recurrence definitions, occurrence identity, generation idempotency, and after-completion behavior.
- [ ] 2.7 Define undo, history, mutation receipt, trash, permanent deletion, backup, restore, and export contracts.
- [ ] 2.8 Define notification responsibility across server, web, and possible native clients.
- [ ] 2.9 Record the selected architecture and update OpenSpec requirements when the spikes resolve current questions.

## 3. Database and Domain Foundation

- [ ] 3.1 Add owner-scoped `tasks_` tables for the minimum task, hierarchy, planning, and ordering model.
- [ ] 3.2 Add RLS policies and grants that restrict every task record to its signed-in owner.
- [ ] 3.3 Add database constraints and indexes for valid hierarchy, stable identifiers, planning queries, and synchronization.
- [ ] 3.4 Add module-local TypeScript types and state-transition utilities with focused tests.
- [ ] 3.5 Add the selected local persistence, mutation queue, reconciliation, and conflict primitives.
- [ ] 3.6 Add stable ordering primitives with focused concurrent-order tests.
- [ ] 3.7 Add recoverable deletion and history primitives with restoration tests.
- [ ] 3.8 Add an initial portable export and verified restore path using synthetic test data.
- [ ] 3.9 Regenerate or update Supabase TypeScript types for the new task objects.

## 4. Minimal End-to-End Module

- [ ] 4.1 Add the isolated task module shell and working routes.
- [ ] 4.2 Register the task module in platform module detection, launcher metadata, PWA metadata, and related tests.
- [ ] 4.3 Add the minimum owner-scoped task query and mutation hooks.
- [ ] 4.4 Add keyboard-accessible task creation, editing, completion, and recoverable deletion.
- [ ] 4.5 Prove offline creation and completion across a client restart and later reconnection.
- [ ] 4.6 Prove optimistic task display without stale-value snapback or focus disruption.
- [ ] 4.7 Add focused accessibility and keyboard tests for the minimal workflow.

## 5. Daily Planning Workflow

- [ ] 5.1 Add Inbox behavior for unprocessed captures.
- [ ] 5.2 Add areas, projects, headings, and checklist items with stable hierarchy behavior.
- [ ] 5.3 Add Today and This Evening with manual ordering and unfinished-item rescheduling.
- [ ] 5.4 Add Upcoming with future start-date planning.
- [ ] 5.5 Add Anytime and Someday with the specified active/inactive semantics.
- [ ] 5.6 Add Logbook, completion history, cancellation history, and recovery flows.
- [ ] 5.7 Add start dates, deadlines, and date-aware planning interactions.
- [ ] 5.8 Add reminders using the responsibility model selected in the architecture gate.
- [ ] 5.9 Add recurrence definitions and idempotent occurrence generation.
- [ ] 5.10 Add native to-do and project templates with provenance-aware instantiation.
- [ ] 5.11 Add structured actionability and source/origin fields without generic tags.
- [ ] 5.12 Add task search, list filtering based on structured fields, and keyboard-first navigation.
- [ ] 5.13 Add bulk task selection and the approved bulk planning actions.

## 6. MCP and macOS Capture

- [ ] 6.1 Add read-only MCP tools for task hierarchy, individual records, and defined planning views.
- [ ] 6.2 Add guarded MCP task creation with stable IDs, structured origin, and idempotency support.
- [ ] 6.3 Add guarded MCP update, completion, movement, scheduling, and recoverable deletion operations.
- [ ] 6.4 Add MCP mutation receipts and task-domain audit history.
- [ ] 6.5 Add MCP tests for authentication, RLS boundaries, invalid transitions, retries, and destructive guardrails.
- [ ] 6.6 Build a Raycast quick-entry command with a configurable global hotkey.
- [ ] 6.7 Add dependable browser context capture with structured webpage origin.
- [ ] 6.8 Add Mail, Finder, selected-text, and reading-list capture only for sources with verified contracts.
- [ ] 6.9 Connect Inbox Manager output after the BathOS Inbox is approved for parallel use.

## 7. Trust Validation

- [ ] 7.1 Test offline create, edit, complete, reschedule, reorder, delete, restore, and recurrence workflows.
- [ ] 7.2 Test overlapping mutations from web, MCP, Raycast, and any other active client.
- [ ] 7.3 Test time-zone and daylight-saving transitions for date-only planning and reminders.
- [ ] 7.4 Test recurrence retries, missed schedules, delayed clients, and duplicate-suppression behavior.
- [ ] 7.5 Test undo, trash restoration, backup, export, and restore with synthetic and disposable personal test data.
- [ ] 7.6 Test keyboard traversal, focus restoration, screen-reader labels, and reduced-motion behavior.
- [ ] 7.7 Measure task-view and search performance with a synthetic dataset larger than the current Things library.
- [ ] 7.8 Run a sustained parallel-use evaluation and record unresolved trust failures before any migration decision.

## 8. Optional Native Apple Companion

- [ ] 8.1 Decide whether observed workflows justify a native Apple companion after the web and Raycast phases are usable.
- [ ] 8.2 Select a native shell, native client, or hybrid architecture if the companion is approved.
- [ ] 8.3 Establish stable Apple signing, bundle identifiers, entitlements, and local-device installation.
- [ ] 8.4 Add native notifications and deep links only if web behavior is insufficient.
- [ ] 8.5 Add selected WidgetKit widgets or controls tied to observed workflows.
- [ ] 8.6 Enroll in the Apple Developer Program and configure TestFlight only if distribution or capabilities require it.
- [ ] 8.7 Evaluate App Intents, Shortcuts actions, and Apple Watch support separately and implement only approved high-value surfaces.

## 9. Documentation, Validation, and Closeout

- [ ] 9.1 Keep the proposal, design, specs, and task list current as discovery or implementation changes the contract.
- [ ] 9.2 Update README and human documentation when the task module becomes available to its intended users.
- [ ] 9.3 Run focused task-domain and module tests after each implementation slice.
- [ ] 9.4 Run `npm run lint`, `npm run build`, and `npm run test` before declaring an implementation phase complete.
- [ ] 9.5 Run `npm run spec:validate` throughout the change.
- [ ] 9.6 Sync completed delta specs into canonical specs and archive the OpenSpec change only after all required behavior is implemented and verified.
- [ ] 9.7 Commit, push, and verify a clean synchronized repository only when the user requests publication or closeout.
