# BathOS Architecture

## Overview

BathOS is a multi-module platform where each module is a self-contained application sharing a unified design language and database infrastructure. Modules currently use the shared authentication system.

## Core Principles

1. **Module isolation**: Each module is self-contained. Removing a module should not require surgery on any other module or cause unexpected consequences. Modules communicate rarely and only through well-defined interfaces.

2. **Shared infrastructure**: Authentication, user profiles, design tokens, and UI primitives are shared across all modules. Changes to shared infrastructure affect all modules uniformly.

3. **Database prefixing**: All tables use a namespace prefix for easy identification:
   - `bathos_` — shared platform tables (profiles, user_roles, user_settings)
   - `budget_` — Budget module tables
   - Future modules use their own prefix (e.g., `inventory_`, `tracker_`)

4. **Path-based routing**: Each module lives under its own URL path prefix (for example, `/budget/...`, `/drawers/...`, `/garage/...`, `/tasks/...`, `/wardrobe/...`). The platform root (`/`) serves the launcher and account management.

5. **Group entity isolation**: Each module has its own concept of a "group" (e.g., Budget has "households"). Group IDs are module-specific — sharing a group in one module does not grant access in another.

## File Structure

```
src/
  platform/           — shared platform code
    components/        — header, account page, launcher, auth forms
    hooks/             — useHostModule, useIsAdmin
    contexts/          — AuthContext
  modules/
    budget/            — Budget module (formerly Split)
      components/
      hooks/
      types/
    drawers/           — Drawers module
      components/
      hooks/
      types/
    garage/            — Garage maintenance module
      components/
      hooks/
      types/
    wardrobe/          — Wardrobe module
      components/
      hooks/
      types/
ios/
  TasksCompanion/      — thin iOS WebKit host and WidgetKit extension for Tasks
  components/ui/       — shadcn/ui primitives (shared)
  lib/                 — shared utilities
  integrations/        — Supabase client and types
  hooks/               — legacy hooks (thin wrappers)
```

## Adding a Module

See `/docs/agents/MODULE_GUIDE.md`.

## Tasks iOS Companion

`ios/TasksCompanion/` contains a deliberately thin SwiftUI companion. The application embeds `https://os.bath.garden/tasks/today` in `WKWebView`; the web module remains the only task-editing implementation. The native target accepts only production Tasks navigation and hands unrelated HTTP(S) links to the system browser.

The authenticated Tasks web module derives a versioned widget projection from the same owner-scoped PowerSync data used by the interface. It sends that projection only when the `bathosTasks` WebKit message handler exists. The native handler accepts only main-frame messages from the production Tasks origin, enforces schema and size bounds, and atomically replaces the App Group cache at `group.garden.bath.tasks`.

The widget cache contains only the owner identifier needed for replacement semantics and up to 50 rows per supported list. A row may contain its task identifier, Summary, Deadline, Today horizon, actionability, and terminal state. It never contains session material, cookies, access or refresh tokens, notes, checklist text, Primary Link, Mail metadata, or raw synchronization errors. Signing out clears the cache.

The `TasksWidgets` extension offers one configurable `systemLarge` widget through App Intents. Today, Upcoming, Anytime, Someday, and Done are supported. Widget taps use allowlisted `bathostasks://` list and task routes. The app translates those routes back to production web routes, and task links open only after the authenticated web projection proves that the task is visible to the current owner.

Widget freshness is event-driven while the companion is running: accepted content changes reload WidgetKit timelines. WidgetKit owns later scheduling, and the extension does not independently authenticate or query Supabase while the companion is dormant.

## Security

- Row Level Security (RLS) is enforced on all tables
- Admin roles are stored in `bathos_user_roles`, never in client-side storage
- The `has_role()` function uses SECURITY DEFINER to avoid RLS recursion
- Each module's data is isolated by module-specific RLS, using either group membership or per-user ownership checks
- Public modules should avoid permissive anonymous table reads; expose narrow `SECURITY DEFINER` RPCs instead when anonymous access is required
