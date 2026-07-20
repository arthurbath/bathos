## Why

Things is central to the user's daily planning, capture, reading, and work workflows, but its closed platform and fixed data model cannot support the structured personal semantics and AI access the user now needs. BathOS should add a private-first task module that preserves the calm, dependable interaction model the user values while developing an original identity and a more extensible system.

## What Changes

- Add a private-first BathOS task module under the permanent `/tasks/...` route, `src/modules/tasks/` source path, and `tasks_` database namespace. The user-facing product name remains undecided.
- Provide a cross-platform web interface for capture, organization, scheduling, completion, search, and review.
- Model Inbox, Today, This Evening, Upcoming, Anytime, Someday, Logbook, areas, projects, headings, checklists, start dates, deadlines, reminders, repeats, notes, and manual ordering without adding tags or another unstructured labeling system.
- Replace existing tag and title-prefix workarounds with explicit structured concepts for actionability, source/origin, templates, and other personal workflow semantics as those concepts are defined.
- Extend the authenticated BathOS MCP surface so AI systems can read and safely mutate task data within the signed-in user's RLS scope.
- Develop macOS capture and keyboard workflows, with Raycast as the preferred first integration.
- Treat offline behavior, synchronization, conflict handling, ordering, recurrence, reminders, undo, recovery, history, backups, and safe automation as trust requirements rather than optional polish.
- Keep Things in parallel use for an indefinite period. Migration and replacement are not initial delivery requirements.
- Keep future native Apple distribution possible without making App Store publication, Apple Watch support, or a complete Shortcuts action library part of the initial build.
- Establish an original visual and interaction identity that is inspired by the qualities of Things without reproducing its branding, assets, or interface.

## Capabilities

### New Capabilities

- `personal-tasks-module`: Private-first task management behavior, including the tagless organization model, structured personal semantics, task views, scheduling, recurrence, history, resilience expectations, capture surfaces, and phased native aspirations.

### Modified Capabilities

- `mcp-module-actions`: Add authenticated task reads and guarded task mutations to the existing BathOS MCP server.

## Impact

- New isolated module files under the working `src/modules/tasks/` path.
- New `tasks_` Supabase objects, RLS policies, indexes, functions, and migrations.
- Platform routing, module registration, document-head metadata, and launcher updates.
- New task-domain behavior shared by the web client, MCP tools, and later platform-specific clients.
- New macOS Raycast extension work outside or alongside the BathOS repository.
- Possible future native Apple app, WidgetKit extension, App Intents, notifications, and TestFlight distribution.
- Broader validation needs for keyboard behavior, offline operation, synchronization, recurrence, ordering, recovery, and automation safety.
