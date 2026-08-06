## Why

Tasks widgets can fetch fresh owner-scoped data when WidgetKit grants a timeline refresh, but server-side changes can remain stale until that budgeted refresh occurs. Apple platforms now provide WidgetKit push notifications that can opportunistically prompt a refresh after relevant server data changes, while the existing timeline fetch remains necessary for reliability and older operating systems.

## What Changes

- Register WidgetKit push tokens from supported iOS, macOS, and watchOS widget extensions through the existing narrow widget authority.
- Queue owner-scoped widget invalidations when authoritative task data affecting a widget projection changes.
- Add a service-only dispatcher that sends coalesced WidgetKit APNs notifications and retires invalid device tokens.
- Refresh the normal bounded widget projection after a WidgetKit push rather than placing task content in the push payload.
- Preserve scheduled WidgetKit timelines and last-valid cached projections as the fallback for missed pushes, offline use, and platform refresh budgets; push-enabled widget extensions require Apple OS 26 while host apps retain their earlier deployment targets.

## Capabilities

### New Capabilities

- `tasks-native-widget-server-refresh`: Owner-scoped push registration, coalesced server invalidation, secure APNs dispatch, and fallback behavior shared across Tasks native widgets.

### Modified Capabilities

- `tasks-ios-companion`: The iOS widget gains opportunistic server-triggered refresh while retaining scheduled fetches and cache fallback.
- `tasks-macos-companion`: The macOS widget gains the same shared server-triggered refresh behavior and signing entitlement.
- `tasks-watch-companion`: The watch complication gains opportunistic server-triggered progress refresh while retaining WidgetKit timelines.

## Impact

- Native Swift widget targets, App Group registration state, entitlements, and tests.
- The `tasks-widget-actions` Edge Function and a new service-only widget-update dispatcher.
- New private Supabase registration and outbox tables, narrow RPCs, and triggers on task projection inputs.
- Managed APNs signing secrets and a scheduled dispatcher invocation are required at deployment; no secrets are committed.
