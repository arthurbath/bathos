## 1. Activation Policy

- [x] 1.1 Change local task Start activation to clear the Start and assign Inbox
- [x] 1.2 Add repository and runtime regression coverage for reached Starts entering Inbox

## 2. Server Policy

- [x] 2.1 Create a forward-only Supabase migration that replaces task activation with Inbox and rewrites no task rows during deployment
- [x] 2.2 Update database rollover tests for ordinary, midnight, and catch-up activation into Inbox
- [x] 2.3 Verify function privacy, rollover-before-activation ordering, reminder preservation, cron continuity, and unchanged PowerSync topology

## 3. Validation And Release Readiness

- [x] 3.1 Run focused application and database tests
- [x] 3.2 Run Tasks TypeScript, lint, production build, full default tests, database tests, strict OpenSpec validation, and Git whitespace checks
- [x] 3.3 Document the forward-only production release procedure and evidence
