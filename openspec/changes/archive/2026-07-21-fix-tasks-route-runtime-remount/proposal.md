## Why

Production Safari navigation between Tasks views remounts the complete Tasks runtime, closes the active local database, and starts a replacement PowerSync connection. The replacement can remain stuck at `Connecting` and cause the due-reminder check to fail until the page is reloaded, violating the module's synchronization and reminder trust contracts during ordinary navigation.

## What Changes

- Keep one authenticated Tasks runtime and local database mounted while the user navigates among supported `/tasks/...` routes.
- Preserve real-link navigation and modified-click behavior without reopening the synchronization boundary for ordinary plain-left-click navigation.
- Register the implemented area-detail route alongside project details so Projects hierarchy links do not fall through to Not Found.
- Continue routing unknown Tasks paths to the normal not-found experience instead of silently treating them as a valid planning view.
- Add regression coverage that proves internal Tasks navigation changes the rendered view without recreating or closing the Tasks runtime.
- Record a production Safari acceptance pass covering Synced status, reminder health, and representative route transitions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Require internal Tasks navigation to preserve the active local database, synchronization session, runtime services, and reminder polling lifecycle.

## Impact

- **Tasks module:** Route rendering and runtime lifecycle under `src/modules/tasks/`.
- **Platform routing and grid history:** Tasks route registration plus the path-scoped DataGrid undo reset in `src/App.tsx`, with focused routing tests around the complete application wrapper.
- **Synchronization and reminders:** No protocol, schema, Supabase, PowerSync, or reminder-service changes. The change prevents unnecessary teardown and reconnection.
- **Blast radius:** Supported Tasks paths and unknown `/tasks/...` path handling only. Other BathOS modules and shared route behavior remain unchanged.
