## 1. Regression Contract

- [x] 1.1 Extend the Mail-capture pgTAP retry case to vary the service-generated task ID, planning date, and order while preserving caller-controlled fields.
- [x] 1.2 Prove the new assertion fails against the current function and retains the changed-caller-field rejection.

## 2. Atomic Retry Fix

- [x] 2.1 Create a Supabase migration through the CLI and replace only the existing `tasks_create_mail_capture` function body.
- [x] 2.2 Compare every caller-controlled task and source field while excluding service-generated identity, date, and order from existing-mutation equality.
- [x] 2.3 Preserve the function signature, invoker security, search path, grants, advisory lock, insertion behavior, and response envelope.

## 3. Validation

- [x] 3.1 Run the focused Mail-capture database test and the complete Supabase database suite.
- [x] 3.2 Run database lint, focused Tasks tests, Tasks typecheck, production build, and strict OpenSpec validation.
- [x] 3.3 Inspect the final diff for unrelated schema, RLS, PowerSync, Edge Function, reminder, or Mail-rule changes.

## 4. Production Acceptance

- [x] 4.1 Obtain approval and apply the single function migration to production.
- [x] 4.2 Replay the accepted canary UUID and prove `already_applied`, unchanged task/source/history counts, synchronized projection, and no duplicate.
- [x] 4.3 Record the acceptance evidence, sync durable specs, archive both completed changes, commit, push, and verify clean synchronized repositories.
