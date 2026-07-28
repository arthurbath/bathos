## Why

The Tasks widget already exposes the right native surface for quick work, but its checkbox is only decorative and its rows can only open the containing app. A user should be able to complete a visible task or follow its Primary Link directly from the widget without turning the widget into a second full Tasks client.

## What Changes

- Make the checkbox area of each open widget task an interactive completion control that updates the authoritative Tasks database without opening the app.
- Keep the task summary as an independent deep link into the Tasks companion.
- Project a bounded, normalized Primary Link for widget rows and render a separate Mail or external-link action that opens through the operating system.
- Introduce a narrow, owner-bound, revocable native completion credential that cannot read Tasks data or perform arbitrary mutations and is never included in PowerSync.
- On successful completion, briefly acknowledge the action, remove the task from active widget lists, add it to Done when projected, reload widget timelines, and rely on ordinary synchronization for every other client.
- Fail closed when completion cannot reach the server, retaining the task in the widget rather than showing an unconfirmed completion.
- Preserve the exact 20-table PowerSync publication and keep Supabase sessions, refresh tokens, PowerSync credentials, notes, checklist text, and Mail source metadata out of the native cache.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-ios-companion`: Replace the read-only widget boundary with narrowly scoped completion and direct Primary Link actions while preserving the thin-host, cache, privacy, and deep-link contracts.
- `personal-tasks-module`: Accept widget completion as an ordinary idempotent lifecycle transition with authoritative history, recurrence, and cross-client synchronization.

## Impact

- **Tasks web module:** Native projection schema, Primary Link normalization, credential provisioning, sign-out clearing, and bridge tests.
- **iOS companion and widget:** Shared cache schema, secure credential storage, App Intent completion action, row layout, direct external links, timeline reloads, and signed project capabilities.
- **Supabase:** One private credential table, narrow privileged functions, one Edge Function boundary, database tests, and generated types where applicable.
- **PowerSync:** No new replicated table and no publication change. The approved set remains exactly 20 Tasks tables.
- **Production:** A later controlled migration, Edge Function deployment, Lovable release, signed companion reinstall, and owner-scoped acceptance fixture will require explicit rollout evidence.
