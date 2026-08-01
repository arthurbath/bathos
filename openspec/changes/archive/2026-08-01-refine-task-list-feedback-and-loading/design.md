## Context

The shared `Button` primitive already supplies a two-unit flex gap, while `DatePickerField` adds a second explicit left margin to decorated content. Closed task completion currently reserves and begins terminal motion immediately. Deadline command advancement derives its starting point from the focused calendar button. Deadline dates are unrestricted, so the picker must preserve an overdue selected date as the advancement origin without imposing a current-date minimum. PowerSync watched-query `loading` and `fetching` describe local query evaluation, not whether the current application session has received an authoritative server sync. The runtime therefore needs a separate session-scoped freshness latch.

Apple documents `LSApplicationCategoryType` as a macOS key. iOS distribution category is the primary category selected in App Store Connect, so a local iOS plist change would not reliably control App Library placement for a development-installed build.

## Goals / Non-Goals

**Goals:**

- Align shared decorated date-picker spacing with decorated selects.
- Add a reversible three-second grace period before closed-task terminal motion and persistence.
- Preserve unrestricted past, current, and future deadline selection while using the actual selected deadline as the first Control+D advancement origin.
- Conceal locally cached task rows during an online launch until current-session server freshness is established, while retaining those rows as the offline and bounded-failure fallback.
- Keep native category metadata truthful and record the supported iOS configuration path.

**Non-Goals:**

- Change completion behavior for an open editor, terminal tasks, widgets, or recurrence prototypes.
- Add a new database table, migration, PowerSync schema change, or dependency.
- Attempt to override iOS App Library classification with a macOS-only plist key.

## Decisions

1. Remove the date field's extra content margin and rely on the shared button gap. This matches the shared select without inventing another spacing token.
2. Keep the grace state inside the rendered task row. The first click visually checks the item and starts a three-second timer without disabling the control. A second click cancels the pending reservation and timer. Once elapsed, the existing settle/exit sequence and persistence path run unchanged. Opening the task transfers the pending check into the existing deferred-open-task completion model.
3. Do not configure a minimum date on either Tasks deadline picker surface. In `DatePickerPanel`, use the selected deadline as the initial command focus origin, then keep normal DOM focus authoritative so arrow navigation and repeated commands compose correctly.
4. Capture the PowerSync `lastSyncedAt` baseline before connecting. During an online launch, keep a runtime freshness latch pending until a subsequent completed sync advances that timestamp. Release the latch immediately for an offline launch or a download failure, and after a bounded timeout, so cached rows remain a usable fallback instead of producing a permanent spinner. Ordinary same-view refreshes after this startup gate has opened continue to leave rendered rows in place.
5. Do not add `LSApplicationCategoryType` to the iOS plist. Productivity remains configured in the macOS bundle, and the iOS distribution record must use Productivity as its App Store Connect primary category.

## Risks / Trade-offs

- [A task row unmounts during the grace period] -> preserve the reserved completion by committing without decorative motion during cleanup.
- [Repeated Control+D ignores intervening arrow navigation] -> use the selected date as the initial origin, then prefer the actual focused calendar date.
- [The app launches without network access] -> initialize the freshness latch as released and render the durable cached projection immediately.
- [The browser reports online but the sync service cannot answer] -> release the latch on a download failure or after the bounded startup wait, leaving existing synchronization diagnostics responsible for the degraded state.
- [A later background refresh begins] -> keep the latch one-shot for the launch episode so ordinary refreshes do not repeatedly conceal an already usable list.
- [A development-installed iOS build remains grouped under the developer name] -> document that the App Store Connect category applies to distributed metadata and cannot be proven by a local Mac rebuild.
