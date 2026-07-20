# Task Reminder Dispatcher

This Edge Function claims due task-reminder deliveries from the server-owned schedule, sends standards-based Web Push requests, and records provider outcomes against the existing per-target delivery identifier.

Required Edge Function secrets:

- `TASKS_REMINDER_DISPATCH_SECRET`: A high-entropy secret required in the `x-tasks-dispatch-secret` request header.
- `TASKS_WEB_PUSH_VAPID_PUBLIC_KEY`: The URL-safe public VAPID key. The same public value must be available to the web build as `VITE_TASKS_WEB_PUSH_PUBLIC_KEY`.
- `TASKS_WEB_PUSH_VAPID_PRIVATE_KEY`: The private VAPID key. Never place it in the repository or client environment.
- `TASKS_WEB_PUSH_SUBJECT`: A `mailto:` or public HTTPS contact URI. Do not use an `https://localhost` subject because Safari push services reject it.

Supabase provides the project URL and a server-only secret key to hosted Edge Functions. The dispatcher accepts the current `SUPABASE_SECRET_KEYS` environment shape and the legacy `SUPABASE_SERVICE_ROLE_KEY` fallback.

Deploy the function with JWT verification disabled because Supabase Cron uses the separate dispatch secret:

```sh
supabase functions deploy dispatch-task-reminders --no-verify-jwt
```

Then create a Supabase Cron job that sends a `POST` request to `/functions/v1/dispatch-task-reminders` every minute with `Content-Type: application/json` and the `x-tasks-dispatch-secret` header. Store the header value in managed secrets or Vault. Do not place it in migration SQL or this public repository.

On iPhone and iPad, standards-based Web Push requires the Tasks route to be installed as a Home Screen web app. Notification permission is requested only from the explicit Enable action in the Tasks interface.
