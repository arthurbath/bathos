# Tasks Reminder Delivery Readiness

**Date:** 2026-07-20
**Status:** Locally Prepared, Production Activation Pending Approval

## Decision

Keep the existing server-authoritative reminder model and deploy Web Push through the `dispatch-task-reminders` Supabase Edge Function. Trigger it once per minute through one fixed-name Supabase Cron job. Store the provider private key and function dispatch secret in managed server secrets, store the matching Cron header value in Supabase Vault, and expose only the public VAPID key to the web build.

Do not activate production reminder delivery until production infrastructure changes are approved. The Tasks module remains fully usable when push delivery is unconfigured or degraded.

## Audit Findings

- The browser registration and service worker correctly require an explicit user action and keep provider credentials out of the synchronized projection.
- The database already provides service-role-only due-delivery claims, stable per-target delivery identifiers, bounded leases, provider-outcome recording, expired-target revocation, and content-free diagnostic fields.
- The dispatcher previously accepted the current hosted `SUPABASE_SECRET_KEYS` shape and the legacy service-role variable, but not the current local `SUPABASE_SECRET_KEY` shape.
- The dispatcher previously returned HTTP 200 after a push attempt even when the database could not record the provider result. This could make a scheduled run appear completely successful while leaving an ambiguous delivery receipt.
- Production configuration existed only as prose. It had no key-pair preflight, fixed Cron SQL, Vault drift checks, rollback SQL, or transaction-safe local proof.
- The local Supabase CLI serve wrapper currently fails to determine the entrypoint for both the reminder dispatcher and an unrelated existing function. The failure is project-runtime-wide rather than dispatcher-specific. A direct bundle through the same cached Supabase Edge runtime image succeeds, which proves the dispatcher graph and npm dependencies are runtime-compatible. Hosted HTTP acceptance remains part of the approval-gated deployment exercise.

## Changes Made

- Extracted a runtime-independent dispatcher handler and retained a thin Deno adapter.
- Added support for hosted, current local, and legacy Supabase server-key environment shapes.
- Added constant-work dispatch-secret comparison through equal-length SHA-256 digests.
- Added bounded dispatcher tests for method handling, missing configuration, authentication, provider acceptance, terminal revocation, claim failures, invalid claims, and receipt failures.
- Changed a provider-outcome receipt failure to return HTTP 500 with a content-free `receipt_errors` count.
- Added `npm run verify:tasks:reminders` to validate secret length, public/private P-256 key pairing, server/client public-key equality, and contact-subject shape without printing credentials.
- Added `npm run verify:tasks:edge-bundle` to repeat the direct Edge Runtime compilation proof, report a bundle hash and size, and remove the ignored artifact in all outcomes.
- Added `deploy/tasks-reminders/` with a deployment sequence, one-minute fixed-endpoint Cron SQL, Vault-backed header lookup, structural verification, targeted rollback, and rollback-only local validation.
- Added an explicit `extensions-enable.sql` production step after a read-only audit confirmed that the BathOS project does not yet have `pg_cron` or `pg_net`. The rollback-only test now reuses that exact file instead of enabling the extensions through test-only statements.
- Updated the Edge Function documentation and OpenSpec contract.

## Local Evidence

- Dispatcher and configuration tests: 20 passing focused tests.
- Full application suite: 527 passing tests and 9 intentional skips across 97 files.
- Database suite: 574 passing pgTAP assertions across 21 files, including the Web Push delivery contract.
- Repository lint, TypeScript, production build, and strict OpenSpec validation: passing.
- Edge compatibility: the repeatable bundle gate used Supabase Edge Runtime `v1.74.2` to produce a 10 MB dispatcher eszip successfully, reported its digest, and removed the ignored temporary artifact.
- Cron package: created the required local extensions, one synthetic Vault secret, one active minute schedule, and the approved command in a database transaction. All assertions passed and the transaction rolled back.
- Cleanup proof: no synthetic reminder secret and no Cron schema artifact remained after rollback.
- Production read-only audit: no dispatcher function, reminder Vault secret, Cron schema, `pg_cron`, or `pg_net` is present, so activation will use the documented fresh-install path.
- Database lint reported one pre-existing Drawers function error and one pre-existing unused-variable warning in a Tasks restore helper. It reported no reminder-delivery finding.
- Production effects: none.

## Production Acceptance Gate

Activation requires all of the following:

1. Explicit approval to modify production infrastructure.
2. Fresh VAPID and dispatch-secret generation outside the repository.
3. A passing preflight using the exact intended server and web values.
4. `pg_cron` and `pg_net` enablement followed by Edge Function, Vault, Cron, and web-build configuration in the approved Supabase and hosting environments.
5. Structural SQL verification immediately after provisioning.
6. Hosted function smoke tests for method and authentication boundaries.
7. One synthetic-device test covering subscription, provider acceptance, notification opening, acknowledgement, expired-target revocation, and cleanup.

The local CLI serve-wrapper entrypoint failure is isolated to an external project-wide wrapper path and should be repaired independently. The repeatable direct-runtime bundle gate covers compilation, but it does not justify bypassing hosted HTTP acceptance or deploying unverified credentials.
