# Tasks Reminder Delivery Readiness

**Date:** 2026-07-20
**Status:** Production Reminder Delivery Accepted

## Decision

Keep the existing server-authoritative reminder model and deliver Web Push through the `dispatch-task-reminders` Supabase Edge Function. Trigger it once per minute through one fixed-name Supabase Cron job. Store the provider private key and function dispatch secret in managed server secrets, store the matching Cron header value in Supabase Vault, and expose only the public VAPID key to the web build.

The owner approved and activated the production infrastructure, granted Safari notification permission through an explicit user gesture, and completed the synthetic-device acceptance path. The Tasks module remains fully usable when push delivery is unconfigured or degraded.

## Audit Findings

- The browser registration and service worker correctly require an explicit user action and keep provider credentials out of the synchronized projection.
- The database already provides service-role-only due-delivery claims, stable per-target delivery identifiers, bounded leases, provider-outcome recording, expired-target revocation, and content-free diagnostic fields.
- The dispatcher previously accepted the current hosted `SUPABASE_SECRET_KEYS` shape and the legacy service-role variable, but not the current local `SUPABASE_SECRET_KEY` shape.
- The dispatcher previously returned HTTP 200 after a push attempt even when the database could not record the provider result. This could make a scheduled run appear completely successful while leaving an ambiguous delivery receipt.
- Production configuration existed only as prose. It had no key-pair preflight, fixed Cron SQL, Vault drift checks, rollback SQL, or transaction-safe local proof.
- The local Supabase CLI initially failed before loading any function because Docker Desktop accepted bind mounts from macOS temporary directories but exposed them as empty inside the container. The CLI-generated main-worker `index.ts` was therefore absent. Directing the CLI's `TMPDIR`, `TMP`, and `TEMP` values to an ignored directory under the Docker-shared repository root restores project-wide local serving without changing any function configuration.

## Changes Made

- Extracted a runtime-independent dispatcher handler and retained a thin Deno adapter.
- Added support for hosted, current local, and legacy Supabase server-key environment shapes.
- Added constant-work dispatch-secret comparison through equal-length SHA-256 digests.
- Added bounded dispatcher tests for method handling, missing configuration, authentication, provider acceptance, terminal revocation, claim failures, invalid claims, and receipt failures.
- Changed a provider-outcome receipt failure to return HTTP 500 with a content-free `receipt_errors` count.
- Added `npm run verify:tasks:reminders` to validate secret length, public/private P-256 key pairing, server/client public-key equality, and contact-subject shape without printing credentials.
- Added `npm run verify:tasks:edge-bundle` to repeat the direct Edge Runtime compilation proof, report a bundle hash and size, and remove the ignored artifact in all outcomes.
- Added `npm run dev:supabase-functions` to serve local functions with CLI bootstrap and environment files under `supabase/.temp/functions-serve`, where Docker Desktop can read them.
- Added `npm run verify:tasks:edge-serve` to boot the actual local Supabase HTTP path, assert the reminder dispatcher's safe GET boundary, and stop the runtime cleanly without invoking delivery.
- Made the wrapper remove stale generated files before launch and remove bootstrap and environment files after both normal and signaled exits.
- Added `deploy/tasks-reminders/` with a deployment sequence, one-minute fixed-endpoint Cron SQL, Vault-backed header lookup, structural verification, targeted rollback, and rollback-only local validation.
- Added an explicit `extensions-enable.sql` production step after a read-only audit confirmed that the BathOS project does not yet have `pg_cron` or `pg_net`. The rollback-only test now reuses that exact file instead of enabling the extensions through test-only statements.
- Updated the Edge Function documentation and OpenSpec contract.
- Extended reminder-time validation to accept synchronized PostgreSQL `time` values with fractional-second precision after the first production notification deep link exposed PowerSync's `HH:mm:ss.sss` representation.
- Added a focused regression test covering minute, second, millisecond, and nanosecond precision plus malformed fractional values.

## Local Evidence

- Dispatcher and configuration tests: 21 passing focused tests.
- Full application suite: 634 passing tests and 9 intentional skips across 115 files.
- Database suite: 648 passing pgTAP assertions across 24 files, including the Web Push delivery contract.
- Repository lint, TypeScript, production build, and strict OpenSpec validation: passing.
- Edge compatibility: the repeatable bundle gate used Supabase Edge Runtime `v1.74.2` to produce a 10 MB dispatcher eszip successfully, reported its digest, and removed the ignored temporary artifact.
- Local HTTP compatibility: the repository wrapper booted all functions through Supabase CLI `2.109.1`. The reminder dispatcher returned HTTP 405 with `Allow: POST` for a safe GET request, and the runtime stopped cleanly.
- Local wrapper cleanup: both the automated gate and an interrupted development session left no generated function temp files or Edge Runtime container behind.
- Cron package: created the required local extensions, one synthetic Vault secret, one active minute schedule, and the approved command in a database transaction. All assertions passed and the transaction rolled back.
- Cleanup proof: no synthetic reminder secret and no Cron schema artifact remained after rollback.
- Production pre-activation audit: no dispatcher function, reminder Vault secret, Cron schema, `pg_cron`, or `pg_net` was present, so activation used the documented fresh-install path.
- Database lint reported one pre-existing Drawers function error and one pre-existing unused-variable warning in a Tasks restore helper. It reported no reminder-delivery finding.

## Production Evidence

- `dispatch-task-reminders` version 1 is active with custom dispatch-secret authentication.
- `pg_cron` 1.6.4 and `pg_net` 0.19.5 are enabled.
- Supabase managed secrets contain the dispatch secret, VAPID key pair, and public subject. The matching dispatch header secret exists once in Vault.
- `tasks-dispatch-reminders` is the only matching Cron job. It is active on `* * * * *` with job ID 1.
- The structural verifier reports `ready`. The latest three Cron runs inspected on 2026 Jul 20 all succeeded.
- Hosted boundary checks return HTTP 405 for GET and HTTP 401 for POST without the dispatch secret.
- The public `.env` contains only the matching VAPID public key. Private provider and dispatch credentials remain outside the repository.
- Safari registered one active Web Push target after an explicit permission gesture and remained synchronized after a production redeployment.
- One synthetic notification was accepted by the provider on its first attempt and opened from Safari. The corrected deep link rendered Tasks and recorded user acknowledgement separately from provider acceptance.
- One isolated synthetic expired endpoint produced the bounded `push_http_410` receipt, changed only that target to revoked, and removed its provider credential.
- Cleanup removed the synthetic task, reminder, occurrences, deliveries, claim diagnostics, and expired target. One real active Safari target and one matching credential remained.

## Production Acceptance Gate

Production infrastructure acceptance requires all of the following:

1. Complete: Explicit approval to modify production infrastructure
2. Complete: Fresh VAPID and dispatch-secret generation outside the repository
3. Complete: A passing preflight using the exact intended server and web values
4. Complete: `pg_cron` and `pg_net` enablement followed by Edge Function, Vault, Cron, and public web-key configuration
5. Complete: Structural SQL verification immediately after provisioning
6. Complete: Hosted function smoke tests for method and authentication boundaries
7. Complete: One synthetic-device test covering subscription, provider acceptance, notification opening, acknowledgement, expired-target revocation, and cleanup

The local wrapper and direct-runtime gates cover local HTTP boot and compilation. They do not justify bypassing hosted HTTP acceptance or deploying unverified credentials.
