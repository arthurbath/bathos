## Why

Tasks widgets currently ask WidgetKit for a new timeline every 30 minutes, but each request only re-reads the last snapshot written while the containing app was running. Remote task changes therefore remain stale until the user opens Tasks, forcing the widget to display an app-specific “Open Tasks to Refresh” prompt instead of behaving like an ordinarily refreshed network-backed iOS widget.

## What Changes

- Extend the existing owner-and-installation-bound widget credential with read-only authority for one bounded widget snapshot.
- Add an authenticated `snapshot` operation to the existing `tasks-widget-actions` Edge Function and a narrowly scoped database function that returns only the approved widget projection.
- Have the WidgetKit timeline provider request the current snapshot during its system-budgeted background refresh, atomically cache a valid response, and fall back to the last accepted snapshot when the network or authority is unavailable.
- Preserve immediate timeline reloads when the running Tasks app publishes changed synchronized data or a widget action changes local state.
- Remove the “Open Tasks to Refresh” stale-content prompt once background refresh is available.
- Keep Supabase session tokens, PowerSync credentials, notes, checklist text, reminder authority, and other detailed task data outside the native widget boundary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-ios-companion`: Make native widget freshness independently network-backed, owner-scoped, system-budgeted, and offline-tolerant without requiring the containing app to open.

## Impact

- Native iOS widget timeline provider, shared snapshot validation and storage, credential client, widget presentation, native tests, and companion documentation.
- Existing `tasks-widget-actions` Edge Function handler and tests.
- One private service-role-only database function plus its migration and database acceptance tests.
- Existing active interactive-widget specification, whose credential boundary must expand from completion-only authority to the union of bounded snapshot reads and completion.
- No new PowerSync table, client-visible secret, general task read API, or background native task database.
