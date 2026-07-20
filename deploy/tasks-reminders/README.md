# Task Reminder Delivery

This package prepares the production Web Push dispatcher and its one-minute Supabase Cron trigger without committing credentials. Running the files locally or reading this package does not provision production.

## Required configuration

The Edge Function needs these managed secrets:

- `TASKS_REMINDER_DISPATCH_SECRET`: At least 32 high-entropy bytes. Cron sends it in `x-tasks-dispatch-secret`.
- `TASKS_WEB_PUSH_VAPID_PUBLIC_KEY`: The URL-safe, unpadded P-256 public key.
- `TASKS_WEB_PUSH_VAPID_PRIVATE_KEY`: The matching private key. It must never enter the client build or repository.
- `TASKS_WEB_PUSH_SUBJECT`: A `mailto:` contact or public HTTPS URI.

The deployed web build needs only `VITE_TASKS_WEB_PUSH_PUBLIC_KEY`, whose value must exactly match the server public key. Supabase supplies `SUPABASE_URL` and a server-only secret key to the hosted function.

The Cron header secret must also exist in Supabase Vault with the exact name `tasks_reminder_dispatch_secret`. Create or update it through the Supabase Dashboard Vault interface so it does not enter repository files or shell history. The Vault value and `TASKS_REMINDER_DISPATCH_SECRET` must match.

## Preflight

Export the five task reminder values only in the controlled deployment environment, then run:

```sh
npm run verify:tasks:reminders
```

The preflight verifies the key pair, client/server public-key equality, subject shape, and dispatch-secret length. It prints only a short public-key fingerprint. Compare that fingerprint across the Edge Function and web deployment environments without exposing key material.

## Deployment sequence

1. Approve production activation and select the intended Supabase project.
2. Generate a fresh VAPID P-256 key pair and an independent dispatch secret outside the repository.
3. Run the preflight with the intended server and web values.
4. Set the four server values as Supabase Edge Function secrets.
5. Set `VITE_TASKS_WEB_PUSH_PUBLIC_KEY` in the production web-build environment and deploy that build.
6. Deploy `dispatch-task-reminders` with JWT verification disabled. The function authenticates only the separate dispatch secret.
7. Create the matching `tasks_reminder_dispatch_secret` value in Supabase Vault.
8. Run `cron-create.sql`, followed immediately by `verify.sql`.
9. Verify that `GET` returns `405`, an unauthenticated `POST` returns `401`, and the configured Cron run returns a content-free dispatch summary.
10. Complete one synthetic-device acceptance test for permission, subscription, provider acceptance, notification opening, acknowledgement, expired-target revocation, and cleanup.

The fixed production endpoint in the SQL belongs to the BathOS Supabase project `rsqfokyqntmtdejfwmjs`. If production moves to another project, update and revalidate this package before running it.

## Rollback

Run `cron-remove.sql` first to stop new dispatch claims. The Tasks module remains usable when push delivery is absent or degraded. Remove or rotate the Edge Function secrets only after the Cron job is confirmed absent. Subscription and delivery records remain available for diagnosis and do not need destructive cleanup.

`test-local.sql` validates the SQL package inside one uncommitted database transaction. It creates only a synthetic transaction-local Vault secret, schedules the job invisibly to the Cron worker, runs all assertions, and rolls back.
