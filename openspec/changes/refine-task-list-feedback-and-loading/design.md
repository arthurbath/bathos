## Context

The shared `Button` primitive already supplies a two-unit flex gap, while `DatePickerField` adds a second explicit left margin to decorated content. Closed task completion currently reserves and begins terminal motion immediately. Deadline command advancement derives its starting point from the focused calendar button, which can be coerced from an overdue disabled date to the minimum date before the first Control+D advance. PowerSync watched queries expose initial/local refresh through `fetching` separately from `loading`, but Tasks only uses `loading` when deciding whether to render an empty state.

Apple documents `LSApplicationCategoryType` as a macOS key. iOS distribution category is the primary category selected in App Store Connect, so a local iOS plist change would not reliably control App Library placement for a development-installed build.

## Goals / Non-Goals

**Goals:**

- Align shared decorated date-picker spacing with decorated selects.
- Add a reversible three-second grace period before closed-task terminal motion and persistence.
- Preserve the actual overdue selected deadline as the first Control+D advancement origin.
- Distinguish cacheless watched-query fetching from a settled empty list.
- Keep native category metadata truthful and record the supported iOS configuration path.

**Non-Goals:**

- Change completion behavior for an open editor, terminal tasks, widgets, or recurrence prototypes.
- Add a new database table, migration, PowerSync schema change, or dependency.
- Attempt to override iOS App Library classification with a macOS-only plist key.

## Decisions

1. Remove the date field's extra content margin and rely on the shared button gap. This matches the shared select without inventing another spacing token.
2. Keep the grace state inside the rendered task row. The first click visually checks the item and starts a three-second timer without disabling the control. A second click cancels the pending reservation and timer. Once elapsed, the existing settle/exit sequence and persistence path run unchanged. Opening the task transfers the pending check into the existing deferred-open-task completion model.
3. In `DatePickerPanel`, retain the selected overdue date as the first command focus origin even when the calendar must focus the legal minimum date. After the first advance, normal DOM focus remains authoritative so arrow navigation and repeated commands compose correctly.
4. Treat `fetching && tasks.length === 0` as cacheless initial loading. Cached rows remain visible during same-view refreshes, while an actually empty list renders only after fetching settles.
5. Do not add `LSApplicationCategoryType` to the iOS plist. Productivity remains configured in the macOS bundle, and the iOS distribution record must use Productivity as its App Store Connect primary category.

## Risks / Trade-offs

- [A task row unmounts during the grace period] -> preserve the reserved completion by committing without decorative motion during cleanup.
- [Repeated Control+D ignores intervening arrow navigation] -> use the overdue selected date only for the initial illegal-to-legal boundary, then prefer the actual focused calendar date.
- [An offline cache is genuinely empty] -> stop treating it as loading once the watched query is no longer fetching; connectivity failures continue through existing offline status handling.
- [A development-installed iOS build remains grouped under the developer name] -> document that the App Store Connect category applies to distributed metadata and cannot be proven by a local Mac rebuild.
