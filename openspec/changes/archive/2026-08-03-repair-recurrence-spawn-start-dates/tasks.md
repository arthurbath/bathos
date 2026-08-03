## 1. Reproduce the Defect

- [x] 1.1 Add recurrence database fixtures whose current revision specifies six days earlier while the prototype snapshot contains a stale one-day Start offset or no Start offset.
- [x] 1.2 Prove the existing spawn function fails to persist the revision-derived Start for both fixtures.

## 2. Repair Generated Dates

- [x] 2.1 Create a timestamped Supabase migration that derives generated Start and Deadline values solely from the current recurrence revision.
- [x] 2.2 Preserve existing prototype metadata inheritance, reminder creation, occurrence identity, and permission boundaries.

## 3. Validate and Prepare Deployment

- [x] 3.1 Apply the migration locally and run the complete Tasks recurrence pgTAP suite.
- [x] 3.2 Run Supabase database lint and verify the function retains its expected security configuration.
- [x] 3.3 Run `npm run spec:validate` and `openspec validate --all --strict`.
- [x] 3.4 Perform a read-only production preflight for migration and function drift without modifying generated instances.

## 4. Closeout

- [x] 4.1 Sync the accepted delta into the durable Tasks specification.
- [x] 4.2 Archive the completed OpenSpec change after the approved production deployment and readback.
