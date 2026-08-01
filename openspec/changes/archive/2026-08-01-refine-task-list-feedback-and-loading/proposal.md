## Why

Tasks currently exposes several small but disruptive feedback gaps: date decorations are spaced differently from selects, completion removes work too quickly to reverse an accidental click, yesterday deadlines cannot be advanced through today, and startup can briefly reveal stale cached task rows before the first current-session server refresh completes. The iOS App Library also exposes a development-team grouping that needs a documented path to the intended Productivity category.

## What Changes

- Make decorated shared date-picker triggers use the same decoration-to-content spacing as shared selects.
- Keep a newly checked closed to-do visible and reversibly checked for three seconds before its completion animation and persistence begin.
- Keep deadline dates unrestricted while advancing an overdue deadline from yesterday to today when Control+D is invoked again in an open deadline picker.
- Show a centered loading indicator while an online Tasks launch waits for its first current-session server refresh, including when stale cached rows are locally available; retain cached rows as the offline or bounded-failure fallback.
- Record that iOS App Library/App Store categorization is supplied by the App Store Connect primary category, while the existing macOS bundle category remains Productivity.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `form-control-interactions`: Decorated shared date-picker triggers match the spacing contract of shared selects.
- `personal-tasks-module`: Closed-list completion gains a reversible three-second grace period, deadline dates remain unrestricted while advancement supports yesterday-to-today, and online startup conceals cached task rows until current-session freshness is established.
- `tasks-ios-companion`: The distribution category contract identifies Productivity as App Store Connect metadata rather than an unsupported iOS plist override.

## Impact

- Shared date-picker presentation in `src/components/ui/date-picker-field.tsx`.
- Tasks completion scheduling, deadline keyboard routing, startup freshness state, and initial-list rendering in `src/modules/tasks/runtime/TasksRuntime.tsx`, `src/modules/tasks/components/TasksShell.tsx`, and focused tests.
- iOS companion distribution documentation/specification; no database schema, Supabase object, dependency, or PowerSync topology change.
