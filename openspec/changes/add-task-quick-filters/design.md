## Context

The Tasks shell currently derives each primary list from structured task fields but has no list-level presentation filter. The requested filters map exactly to the existing `actionable`, `waiting`, and `rechecking` values. The active choice must outlive one Tasks render and converge across sessions and devices, while the default remains unfiltered.

BathOS already has an owner-scoped `bathos_user_settings` row protected by RLS and used for durable interface preferences. Tasks also has a PowerSync-replicated settings row, but adding a display-only preference there would expand the Tasks backup/restore schema and offline synchronization contract unnecessarily.

## Goals / Non-Goals

**Goals:**

- Present one compact Quick Filters control on primary list views.
- Offer exactly the four requested filters plus All Tasks for clearing the preference.
- Apply the active choice consistently across Today, Upcoming, Anytime, Someday, and Done.
- Restore the preference immediately from a per-user local cache and reconcile it with the durable database value across sessions and devices.
- Preserve list ordering, grouping, project cards, task editing stability, focus, and bulk-selection invariants.

**Non-Goals:**

- Advanced filtering, filter composition, custom filters, saved-filter management, tags, or query syntax.
- Filtering Projects, Templates, Config, Search, project-detail, or area-detail surfaces.
- Adding a PowerSync table or changing the approved Tasks publication.

## Decisions

### Store one explicit preference in `bathos_user_settings`

Add constrained `tasks_quick_filter` and `tasks_quick_filter_updated_at` columns. A direct column keeps the allowed values inspectable, avoids JSON merge ambiguity, and lets RLS continue enforcing one owner row. The migration also restates the update policy with both owner-scoped `USING` and `WITH CHECK` predicates.

Alternative considered: add the value to `tasks_user_settings`. Rejected because a display preference does not need to participate in Tasks replacement backups, schema-versioned restore, or the PowerSync upload connector.

### Reconcile a local cache with the database timestamp

A Tasks hook reads an owner-keyed localStorage value synchronously, loads the database preference on mount and on focus/online recovery, and keeps the newer timestamped value. User changes update the UI and cache immediately, then upsert the owner row. Storage events propagate the same preference between open tabs on one device.

Alternative considered: database-only loading. Rejected because it would briefly render All Tasks on every launch and would not preserve the preference during an offline launch.

### Filter the shell's visible task projection

The domain helper accepts a task and one of five fixed values: `all`, `actionable`, `non_actionable`, `rechecking`, or `waiting`. `non_actionable` means Waiting or Rechecking. The shell applies it after ordinary view membership has been derived and before grouping, focus traversal, bulk selection, and rendering. Project cards and deleted hierarchy roots remain unchanged because they are not task rows.

### Make the trigger communicate and control state

With All Tasks selected, the trigger is the compact Filter icon labeled Quick Filters for assistive technology. With a filter active, it shows that filter's name in the top action row. The menu is a single-select radio group containing All Tasks and the four predefined filters, so changing and clearing use the same surface.

## Risks / Trade-offs

- [A cached value and database value can diverge temporarily while offline] → Keep the newer timestamped cached value, retry database reconciliation when the browser returns online or regains focus, and never block local filtering.
- [Changing the filter can invalidate focus or a bulk selection] → Derive all focusable/selectable IDs from the filtered projection and reuse the existing reconciliation effect.
- [An active filter can produce an apparently empty view] → Keep the active filter name visible and render a specific no-matches message instead of the ordinary empty-list message.
- [Client timestamps can be affected by clock skew] → Follow the established BathOS preference convention and compare ISO timestamps consistently; a future shared preference service can centralize server-clock arbitration if needed.

## Migration Plan

1. Add constrained quick-filter value and timestamp columns to `bathos_user_settings`.
2. Recreate the owner update policy with explicit `USING` and `WITH CHECK`.
3. Update generated TypeScript database types.
4. Deploy the web release after the migration is applied. Existing owners begin at All Tasks without data rewriting beyond column defaults.
5. Rollback may remove the two columns after the web release stops reading them; the application sanitizer already falls back to All Tasks when the columns are unavailable.

## Open Questions

None.
