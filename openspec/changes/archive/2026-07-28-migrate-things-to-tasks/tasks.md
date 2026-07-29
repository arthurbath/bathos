## 1. Private Source Discovery

- [x] 1.1 Create an owner-private consistent Things SQLite snapshot and verify its integrity and digest
- [x] 1.2 Inventory approved roots, projects, children, areas, tags, planning, reminders, deadlines, and recurrence relationships without publishing content
- [x] 1.3 Decode every observed recurrence shape and prove its next date against the Things stored next-instance value
- [x] 1.4 Record exact content-free source counts and fail-closed extraction invariants

## 2. BathOS Recurrence Compatibility

- [x] 2.1 Extend the client recurrence rule type and preview engine for yearly fixed-date and ordinal-weekday rules
- [x] 2.2 Add a forward-only Supabase migration for authoritative yearly recurrence evaluation and validation
- [x] 2.3 Add client and database parity tests for all imported yearly recurrence shapes

## 3. Deterministic Migration Tooling

- [x] 3.1 Implement the private Things snapshot validator and semantic extractor
- [x] 3.2 Implement approved mapping for planning, actionability, Areas, task content, project-to-checklist conversion, deadlines, reminders, and ordering
- [x] 3.3 Collapse each recurrence template and current instance into one native adopted recurrence graph
- [x] 3.4 Build a schema-13 target envelope from a current Tasks export while preserving approved owner settings and Areas
- [x] 3.5 Emit a content-free preview and reconciliation report and reject any unsupported or ambiguous source data
- [x] 3.6 Add synthetic migration fixtures and tests that cover every observed source shape without personal content

## 4. Tasks-Only Capture Cutover

- [x] 4.1 Create and implement the matching Inbox Manager OpenSpec change for operational Tasks-only Mail delivery
- [x] 4.2 Preserve one existing AI refinement while removing Things credential, scripting, and write work from Tasks-only mode
- [x] 4.3 Retarget the canonical Raycast webpage capture and retire or redirect legacy Things-writing commands
- [x] 4.4 Update capture documentation, private runtime evidence, tests, and emergency rollback instructions

## 5. Local Validation

- [x] 5.1 Dry-run extraction and schema-13 replacement against isolated local data
- [x] 5.2 Reconcile source and target counts, planning, actionability, checklists, Areas, reminders, deadlines, recurrence definitions, and adopted occurrences
- [x] 5.3 Run BathOS database tests, application tests, TypeScript, lint, build, and strict OpenSpec validation
- [x] 5.4 Run Inbox Manager and Raycast tests and prove zero Things work in Tasks-only mode

## 6. Production Cutover

- [x] 6.1 Inspect installed Inbox Manager health and drain or explicitly reconcile every accepted and retrying pre-cutover handoff
- [x] 6.2 Stop task capture at the cutover boundary and refresh and verify the private production Tasks backup and schema-13 export
- [x] 6.3 Apply and verify the backward-compatible yearly recurrence migration and matching server/client support
- [x] 6.4 Preview and atomically replace the owner Tasks corpus using the validated private envelope and exact backup digest
- [x] 6.5 Verify aggregate parity, rendered Tasks behavior, reminders, recurrence generation, PowerSync's exact 20-table boundary, cron, and advisors
- [x] 6.6 Install Tasks-only Inbox Manager and Raycast runtimes, resume scheduling, and prove disposable new-Mail and webpage captures create Tasks only
- [x] 6.7 Clean every disposable production fixture and retain private rollback artifacts

## 7. Closeout

- [x] 7.1 Update the Tasks readiness and cutover evaluation documentation with content-free evidence
- [x] 7.2 Sync and archive the BathOS and Inbox Manager OpenSpec changes
- [x] 7.3 Commit and push every affected repository and prove each working tree is clean and synchronized
