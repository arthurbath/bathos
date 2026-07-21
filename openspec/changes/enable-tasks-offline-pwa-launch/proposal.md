## Why

Tasks persists task data and pending mutations locally, but the production service worker currently registers only when browser reminders are enabled and does not retain the application shell. An installed iPhone PWA can therefore lose access to the interface after network loss even though its task database remains available, which prevents honest offline-device acceptance.

## What Changes

- Register the Tasks service worker from the connected Tasks runtime without requesting notification permission or creating a push subscription.
- Precache the current Tasks application shell and its versioned entry assets so a previously loaded Tasks PWA can reopen without network access.
- Serve cached shell HTML only for same-origin `/tasks` navigation requests and cache only same-origin versioned application assets, leaving unrelated BathOS module navigation and API traffic untouched.
- Refresh the cached shell safely on a new deployment, remove superseded Tasks shell caches, and preserve the existing Web Push registration and notification-routing contract.
- Add browser-level and service-worker contract tests for installation, activation, online refresh, offline launch, scope isolation, update recovery, and notification compatibility.
- Document the exact first-load requirement and the production iPhone acceptance sequence.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Extend offline task operation so a previously loaded installed Tasks PWA can reopen its interface during network loss, while keeping notification permission optional and isolating cache behavior from other BathOS modules.

## Impact

- **Tasks runtime**: Add idempotent service-worker registration independent of reminder enablement.
- **Service worker**: Add a versioned Tasks-only application-shell cache and bounded fetch handling while retaining existing push and notification-click behavior.
- **Build and deployment**: Publish a deterministic shell asset manifest or equivalent current-build inputs without adding server credentials or changing hosting topology.
- **Tests**: Extend service-worker lifecycle tests and add a rendered offline-launch acceptance gate.
- **Documentation**: Clarify first-load, offline reopening, update, and iPhone production acceptance behavior.
- **Blast radius**: No task schema, Supabase migration, PowerSync stream, reminder dispatcher, MCP, Raycast, or non-Tasks module behavior changes.
