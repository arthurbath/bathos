## 1. Discovery and Product Contract

- [x] 1.1 Capture the private-first product posture, tag exclusion, deferred migration, optional native surfaces, and original-expression constraint in OpenSpec.
- [x] 1.2 Perform an initial bounded read-only Things inventory and record only generalized findings in the public repository.
- [x] 1.3 Catalogue the user's daily capture, planning, execution, review, completion, and rescheduling workflows.
- [x] 1.4 Define the actionability states that will replace the current tag conventions.
- [x] 1.5 Define supported source/origin types and the behaviors attached to each origin.
- [x] 1.6 Define to-do template and project template creation, editing, instantiation, and provenance behavior.
- [x] 1.7 Inventory relevant Things keyboard behaviors and choose the BathOS keyboard contract for the first daily workflow.
- [x] 1.8 Select the smallest end-to-end workflow that can provide useful parallel operation.
- [x] 1.9 Confirm or revise the working `/tasks` route, `tasks_` database namespace, and `src/modules/tasks` source path.
- [ ] 1.10 Select an original user-facing product name and initial icon direction before launcher implementation.

## 2. Architecture Gates

- [x] 2.1 Compare module-local offline persistence and synchronization approaches against web, Supabase, MCP, and possible native-client requirements.
- [x] 2.2 Build a disposable spike for offline task creation, restart persistence, reconnection, and server reconciliation.
- [x] 2.3 Build a disposable spike for stable manual ordering and overlapping reorder conflicts.
- [x] 2.4 Define open, completed, canceled, recoverably deleted, restoration, and hierarchy-transition invariants.
- [x] 2.4a Add the structured actionability transitions after the vocabulary in 1.4 is resolved.
- [x] 2.5 Define start-date, deadline, reminder, time-zone, and daylight-saving semantics.
- [x] 2.6 Define recurrence definitions, occurrence identity, generation idempotency, and after-completion behavior.
- [x] 2.7 Define undo, history, mutation receipt, trash, permanent deletion, backup, restore, and export contracts.
- [x] 2.8 Define notification responsibility across server, web, and possible native clients.
- [x] 2.9 Record the selected architecture and update OpenSpec requirements when the spikes resolve current questions.

## 3. Database and Domain Foundation

- [x] 3.1a Add the owner-scoped `tasks_todos` table for the first-slice task, planning, source, lifecycle, recovery, and ordering model.
- [x] 3.1b Add owner-scoped area, project, heading, and checklist tables for the hierarchy slice.
- [x] 3.1c Add owner-scoped planning-time-zone settings for date-derived views.
- [x] 3.1d Add owner-scoped template, recurrence, reminder, and delivery tables when their product slices begin.
- [x] 3.1e Add a normalized owner-scoped Mail source identity and retirement-lifecycle record.
- [x] 3.2 Add RLS policies and grants that restrict every current task record to its signed-in owner and withhold hard deletion from authenticated clients.
- [x] 3.3a Add first-slice constraints and indexes for stable identifiers, provenance, valid lifecycle/disposition, planning queries, and synchronization.
- [x] 3.3b Add owner-inclusive hierarchy constraints and indexes with the later hierarchy tables.
- [x] 3.4 Add module-local TypeScript types and state-transition utilities with focused tests.
- [x] 3.5 Add the selected local persistence, mutation queue, reconciliation, and conflict primitives.
- [x] 3.6 Add stable ordering primitives with focused concurrent-order tests.
- [x] 3.7a Add recoverable deletion and restoration primitives with restoration tests.
- [x] 3.7b Add append-only history, mutation receipts, and inverse-mutation undo primitives.
- [x] 3.8 Add an initial portable export and verified restore path using synthetic test data.
- [x] 3.8a Advance portable export and restore to include normalized Mail source records.
- [x] 3.8b Advance portable export and restore to include append-only Mail retirement events.
- [x] 3.9 Regenerate or update Supabase TypeScript types for the new task objects.

## 4. Minimal End-to-End Module

- [x] 4.1 Add the isolated task module shell and working routes.
- [ ] 4.2 Register the task module in platform module detection, launcher metadata, PWA metadata, and related tests.
- [x] 4.3 Add the minimum owner-scoped task query and mutation hooks.
- [x] 4.4 Add keyboard-accessible task creation, editing, completion, and recoverable deletion.
- [x] 4.5 Prove offline creation and completion across a client restart and later reconnection.
- [x] 4.6 Prove optimistic task display without stale-value snapback or focus disruption.
- [x] 4.7 Add focused accessibility and keyboard tests for the minimal workflow.

## 5. Daily Planning Workflow

- [x] 5.1 Add Inbox behavior for unprocessed captures.
- [x] 5.2a Add the owner-safe hierarchy schema, independent ordering, offline projection, and mutation primitives.
- [x] 5.2b Add area and project navigation, creation, editing, movement, and manual ordering.
- [x] 5.2c Add project headings, to-do placement, checklist editing, and hierarchy-context presentation in planning views.
- [x] 5.2d Add explicit project lifecycle, descendant transition, recoverable hierarchy deletion, history, export/restore, and trust tests.
- [x] 5.3 Add Today and This Evening with manual ordering and unfinished-item rescheduling.
- [x] 5.4 Add Upcoming with future start-date planning.
- [x] 5.5 Add Anytime and Someday with the specified active/inactive semantics.
- [x] 5.6 Add Logbook, completion history, cancellation history, and recovery flows.
- [x] 5.7a Add date-only start-date and deadline storage, range validation, history, undo, export/restore, synchronization, and editing.
- [x] 5.7b Apply owner-time-zone availability and deadline presentation across derived planning views.
- [x] 5.8 Add reminders using the responsibility model selected in the architecture gate.
- [x] 5.9 Add recurrence definitions and idempotent occurrence generation.
- [x] 5.10 Add native to-do and project templates with provenance-aware instantiation.
- [x] 5.11 Add structured actionability and source/origin fields without generic tags.
- [x] 5.12a Add web-safe capture, route, row-focus, completion, reorder, and editor keyboard commands.
- [x] 5.12b Add task search, structured-field filtering, keyboard help, and distinct Move/When command surfaces.
- [x] 5.13 Add bulk task selection and the approved bulk planning actions.

## 6. MCP and macOS Capture

- [x] 6.1 Add read-only MCP tools for task hierarchy, individual records, and defined planning views.
- [x] 6.2 Add guarded MCP task creation with stable IDs, structured origin, and idempotency support.
- [x] 6.3 Add guarded MCP update, completion, movement, scheduling, and recoverable deletion operations.
- [x] 6.4 Add MCP mutation receipts and task-domain audit history.
- [x] 6.5 Add MCP tests for authentication, RLS boundaries, invalid transitions, retries, and destructive guardrails.
- [x] 6.6 Build a Raycast quick-entry command with a configurable global hotkey.
- [x] 6.7 Add dependable browser context capture with structured webpage origin.
- [x] 6.8a Add Finder capture for exactly one selected item with a typed local file source.
- [x] 6.8b Add selected-text capture that actively copies the current selection and rejects stale clipboard content.
- [x] 6.8c Add AI-enriched reading-list capture with typed reading provenance and Today placement.
- [x] 6.8d Add Mail capture after the structured source contract preserves account identity, message identity, deep link, and source-retirement lifecycle.
- [x] 6.8d1 Add specialized atomic Mail task creation with request and source-identity deduplication.
- [x] 6.8d2 Add guarded, auditable Mail source-retirement lifecycle mutations.
- [ ] 6.9 Connect Inbox Manager output after the BathOS Inbox is approved for parallel use.

## 7. Trust Validation

- [x] 7.1 Test offline create, edit, complete, reschedule, reorder, delete, restore, and recurrence workflows.
- [x] 7.2 Test overlapping mutations from web, MCP, Raycast, and any other active client.
- [x] 7.3 Test time-zone and daylight-saving transitions for date-only planning and reminders.
- [x] 7.4 Test recurrence retries, missed schedules, delayed clients, and duplicate-suppression behavior.
- [x] 7.5 Test undo, trash restoration, backup, export, and restore with synthetic and disposable personal test data.
- [x] 7.6 Test keyboard traversal, focus restoration, screen-reader labels, and reduced-motion behavior.
- [x] 7.7 Measure task-view and search performance with a synthetic dataset larger than the current Things library.
- [x] 7.8 Run a sustained parallel-use evaluation and record unresolved trust failures before any migration decision.

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
