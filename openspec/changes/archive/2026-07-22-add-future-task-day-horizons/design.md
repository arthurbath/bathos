## Context

Tasks currently stores `today_section` as `none`, `now`, `next`, or `later`. Application queries, repository validation, MCP validation, templates, and the previous production migration all treat a non-`none` value as Today membership and reject or clear it when `start_date` is in the future. That coupling prevents a user from choosing the eventual Today position of future work and leaves no Inbox subsection for due or newly captured triage.

The change crosses the local PowerSync model, Supabase constraints and functions, React views and editing surfaces, MCP service tools, template and recurrence data, export and restore, and companion capture defaults. Existing row identity, RLS, ownership, synchronization, lifecycle, history, and Done retention must remain unchanged.

## Goals / Non-Goals

**Goals:**

- Make the stored day horizon independent from start date.
- Add Inbox before Now, Next, and Later in Today.
- Ensure future work retains its selected horizon while remaining in Upcoming.
- Ensure due work appears in Today, defaulting to Inbox when its stored horizon is `none`.
- Preserve manual Today membership for undated Anytime work with an explicit horizon.
- Make day-horizon selection available beside start-date controls.
- Preserve the field through every supported task and project service, synchronization, recurrence, template, and portability path.

**Non-Goals:**

- Reintroducing a standalone Inbox list or route.
- Adding tags, reminder-time semantics, or a second task date.
- Changing Someday, Done retention, Mail classification, notification delivery, or Tasks module isolation.
- Renaming the physical `today_section` column in this change. The stable column name avoids an unnecessary PowerSync schema replacement while its documented meaning becomes day horizon.

## Decisions

### Keep one compatibility column with five values

`today_section` will accept `none`, `inbox`, `now`, `next`, and `later` for to-dos and projects. Code and UI will describe the concept as Day Horizon. Keeping the physical column avoids a destructive table or PowerSync projection rename, while adding `inbox` and removing the future-date coupling supplies the required semantics.

Alternative considered: add a new `day_horizon` column and migrate every consumer. This is semantically cleaner in isolation but duplicates planning state during rollout and broadens synchronization and restore risk without changing observable behavior.

### Derive Today from date availability plus explicit horizon

An open present Anytime item is visible in Today when either:

- it has no start date and an explicit non-`none` horizon, or
- its start date is on or before the owner-local planning date.

Its visible section is the stored non-`none` horizon, or Inbox when the stored value is `none`. A future start date always keeps the item in Upcoming and out of Today and Anytime, but does not erase its horizon.

This keeps manual undated Today planning, guarantees scheduled work appears when due, and gives unclassified due work a deterministic Inbox destination.

Alternative considered: require every scheduled item to store a non-`none` horizon. Defaulting at read time is safer for existing rows, older imports, and API callers while still presenting exactly four Today sections.

### New capture defaults to Inbox

Generic web, Raycast, browser, Mail, and MCP capture paths that do not receive an explicit placement will create an undated Anytime item with the Inbox horizon. This preserves immediate Today triage while using the new first bucket rather than Later. Explicit caller placement remains authoritative.

### Date editing preserves horizon

Changing a start date will not clear the horizon. The task editor and When surface will show a Start Date control and a Day Horizon select together. Selecting Someday still clears both start date and horizon. Removing an undated item from Today sets the horizon to `none`; removing a due dated item from Today requires rescheduling or clearing its due date because due work is defined to appear in Today.

Moving Today work to Tomorrow preserves its resolved horizon, including Inbox. This makes future planning intentional instead of discarding placement.

### Keep ordering scoped by stored horizon

Today ordering uses Inbox, Now, Next, Later rank followed by the existing manual order key. Reordering changes only the order within the resolved visible section. Upcoming remains ordered by start date and then the existing order key while displaying the retained horizon.

### Deploy as an additive constraint and function migration

The migration drops and recreates only planning constraints and horizon indexes, adds `inbox` to accepted values, changes capture defaults to Inbox, and replaces affected validation and service functions so future dates no longer force `none`. It does not rewrite existing Now, Next, Later, or `none` values.

## Risks / Trade-offs

- [Older clients do not recognize `inbox`] -> Deploy database and service compatibility with the web release, update the PowerSync client schema consumers before creating Inbox rows, and validate fresh-client projection.
- [A due item with stored `none` appears unexpectedly] -> This is the intended Inbox fallback, is specified explicitly, and is visible in both Today and the start-date planning control.
- [Clearing a date from a horizon-bearing future item makes it immediately visible Today] -> The combined control exposes both values together so the resulting state is apparent before save.
- [Manual order keys were created under the prior section set] -> Existing keys remain valid; Inbox receives its own indexed section and no cross-section rewrite is required.
- [Generated MCP bundle drifts from source tools] -> Rebuild the Edge Function bundle from the canonical source and verify the production artifact hash before deployment.

## Migration Plan

1. Add local and production migration coverage for five accepted values, independent future horizons, Inbox defaults, and preserved ownership/RLS behavior.
2. Update TypeScript, local PowerSync queries, domain derivation, repository validation, templates, recurrence, export/restore, MCP tools, and generated Edge Function bundle.
3. Update the task editor, When surface, Today grouping, markers, actions, and project planning.
4. Run local unit, database, integration, build, lint, typecheck, bundle, and strict OpenSpec gates.
5. Create a verified private production backup, apply the migration, deploy MCP, verify the 22-table PowerSync boundary, and perform synthetic cross-client acceptance before enabling new capture defaults.

Rollback is code-first while no Inbox values exist. After Inbox rows exist, rollback requires normalizing `inbox` to `later` or `none` before restoring the four-value constraint. No task content or identity needs to be deleted.

## Open Questions

None. The user-supplied contract and the existing Today/Upcoming architecture determine the behavior above.
