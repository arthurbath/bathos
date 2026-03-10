# Adding a New Module to BathOS

## 1. Choose a namespace

Pick a short, lowercase name (e.g., `tracker`). This becomes:
- The DB table prefix: `tracker_`
- The file path: `src/modules/tracker/`
- The path prefix: `/tracker/...`

## 2. Create database tables

All tables must be prefixed with your namespace. Example:

```sql
CREATE TABLE public.tracker_items (...);
ALTER TABLE public.tracker_items ENABLE ROW LEVEL SECURITY;
```

Create a membership/group table if the module supports collaboration:

```sql
CREATE TABLE public.tracker_groups (...);
CREATE TABLE public.tracker_group_members (...);
```

Create a SECURITY DEFINER function for RLS checks:

```sql
CREATE OR REPLACE FUNCTION public.is_tracker_group_member(...)
```

## 3. Create module files

```
src/modules/tracker/
  components/    — UI components
  hooks/         — data hooks (useTrackerItems, etc.)
  types/         — TypeScript interfaces
```

Before considering a new module UI complete, do a convention pass against `AGENTS.md` and `docs/human/STYLE_GUIDE.md`:
- Button labels, card titles, modal titles, input labels, and section titles use Title Case
- Form modal headers do not include descriptive subtext unless the task explicitly asks for it
- Card headings should use the shared `CardTitle` styling without local downsizing overrides

## 4. Register routes

In `src/App.tsx`, add a new module case in `AppRoutes`:

```tsx
if (module === 'tracker') {
  return (
    <Routes>
      <Route path="/" element={<TrackerIndex />} />
      ...
    </Routes>
  );
}
```

Add path-based fallback routes in the platform root section:

```tsx
<Route path="/tracker/*" element={...} />
```

## 5. Register in the launcher

Add the module to the `MODULES` array in `LauncherPage.tsx`.

## 6. Register module path handling

Add the module path mapping entry in `useHostModule.ts` so the module is detected from the first URL segment.

## 7. Module isolation rules

- Never import from another module's directory
- Shared code goes in `src/platform/`, `src/lib/`, or `src/components/ui/`
- Each module's group entity is independent — no cross-module group sharing
- Removing a module should require only deleting its files, routes, DB tables, and launcher entry
