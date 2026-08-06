# Tasks Widget Update Dispatcher

This service-only Edge Function sends content-free WidgetKit invalidations for
coalesced owner changes. It does not contain or receive task content.

Required managed secrets:

- `TASKS_WIDGET_PUSH_DISPATCH_SECRET` - at least 32 random bytes
- `TASKS_WIDGET_APNS_TEAM_ID`
- `TASKS_WIDGET_APNS_KEY_ID`
- `TASKS_WIDGET_APNS_PRIVATE_KEY` - the complete APNs `.p8` PKCS#8 PEM

Deploy with JWT verification disabled because the endpoint authenticates a
dedicated constant-time compared cron secret:

```sh
supabase functions deploy dispatch-task-widget-updates --no-verify-jwt
```

## Production rollout

1. Refresh the private production backup and confirm the database migration
   plan contains only `20260806155216_add_tasks_widget_push_updates.sql` for
   this change.
2. Apply the migration, then independently verify that the two private tables,
   five enqueue triggers, and three service-only dispatcher RPCs exist. Confirm
   neither private table is in the PowerSync publication.
3. Deploy the registration-aware `tasks-widget-actions` function.
4. Add all four secrets above to the managed project secret store. Never put
   the APNs private key or dispatch secret in a committed migration, `.env`,
   build setting, application bundle, or log.
5. Deploy this function without scheduling it. Invoke it once with the
   `x-tasks-widget-push-secret` header while the queue is empty and require a
   successful response reporting zero claims.
6. Build and sign the OS 26 widget extensions with the Push Notifications
   capability. Use `development` for private development installs and
   `production` for distribution builds. Install one bounded test device per
   platform and confirm its owner-and-installation-bound registration in the
   private table.
7. Change one disposable fixture task for that owner, invoke the dispatcher
   once, and verify all of the following before cleaning up the fixture:
   one owner generation was claimed, APNs accepted the content-free push, the
   widget requested the ordinary snapshot, and the outbox generation cleared.
8. Only after that readback succeeds, schedule one authenticated POST per
   minute. Monitor APNs rejection reasons, transient retries, token retirement,
   snapshot failures, and queue age.

Rollback begins by disabling the schedule. Normal WidgetKit timeline refreshes
and last-valid cache fallback continue without this dispatcher, so the private
tables and registrations can remain in place while a native or server issue is
investigated.
