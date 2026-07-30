## 1. Authoritative Recurrence Editing

- [x] 1.1 Add a revision-checked authenticated RPC for editing rich recurrence rules
- [x] 1.2 Apply the edited after-completion next-occurrence override exactly once
- [x] 1.3 Supersede and replace prior-revision future calendar projections
- [x] 1.4 Add database tests for recurrence editing, conflicts, idempotency, projection replacement, and advancement

## 2. Recurrence Client Model

- [x] 2.1 Add recurrence edit types and service parsing
- [x] 2.2 Expose optimistic recurrence editing and outstanding-instance details from the hook
- [x] 2.3 Populate the repeat editor from current recurrence revisions

## 3. Upcoming Interaction

- [x] 3.1 Render recurrence projections with a recurrence symbol and exclude ordinary task mutation controls
- [x] 3.2 Add Edit Repeat to Upcoming projections and waiting definitions
- [x] 3.3 Move Waiting to second-row metadata and add Go to Instance

## 4. Verification

- [x] 4.1 Add focused service, hook, dialog, and TasksShell tests
- [x] 4.2 Run database, application, TypeScript, lint, build, OpenSpec, and rendered-behavior verification

## 5. Prototype Name and Date Guard

- [x] 5.1 Edit the repeating prototype name in the existing Edit Repeat dialog.
- [x] 5.2 Prevent a next occurrence before the owner-local planning date and advance stale source dates to the next valid cadence.
- [x] 5.3 Add focused name/date regression coverage and rerun full validation.
