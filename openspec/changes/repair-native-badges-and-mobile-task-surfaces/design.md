## Context

Tasks already requests alert, sound, and badge authorization for new native installations, projects the complete Today count to the native companions, and centers Start and Deadline pickers on touch-capable mobile viewports. The reported failures are compatibility and presentation gaps around those existing contracts rather than new product capabilities.

Existing installations may have granted notification authorization before badge authorization was included. UserNotifications then reports the application as authorized while the badge setting is not enabled, so the current coordinator skips the authorization request that would add badge capability. The notification Settings action also waits for a fresh asynchronous settings query even when the companion already knows the authorization state.

The centered temporal picker uses shared popover chrome, but the mobile presentation needs an explicit inset treatment and a backdrop layer above persistent navigation. Checklist rows already overflow the drawer on the leading edge and need the same trailing-edge treatment now that their handles are permanently visible.

## Goals / Non-Goals

**Goals:**

- Upgrade previously authorized iOS and macOS installations to request badge capability once when the operating system does not report it as enabled.
- Respect a user's explicit badge disablement and avoid repeated authorization requests.
- Open native notification settings immediately when the cached authorization state already identifies the correct action.
- Restore normal inset border and corner chrome to centered mobile temporal pickers, compact their footer, and place their backdrop above persistent mobile controls.
- Align checklist rows symmetrically beyond both horizontal drawer insets.

**Non-Goals:**

- Changing the Today-count badge definition.
- Adding a Tasks-owned notification or badge toggle.
- Changing APNs delivery, reminder scheduling, task synchronization, Supabase, or PowerSync.
- Altering anchored date-picker presentation outside touch-capable mobile viewports.

## Decisions

### Use a one-time incremental badge-authorization repair

The shared native notification coordinator will detect the narrow state where overall notification authorization is enabled but `badgeSetting` is not `.enabled`. It will issue one incremental request containing alert, sound, and badge options and then refresh the authoritative settings.

A versioned native preference records that this compatibility request was attempted. This prevents repeated prompts or status churn if an operating-system version continues reporting the old state. UserNotifications remains authoritative: the request cannot override an explicit system-level badge disablement, and the version marker prevents requesting it again.

Alternative considered: request authorization whenever badges are not enabled on every refresh. Rejected because it would repeatedly challenge an explicit user decision and blur the operating system's authority.

### Cache the most recently resolved notification settings

The coordinator will retain the most recent authorization state and settings. When the user activates the Settings action and the cached state is enabled or denied, it will open the operating-system notification settings immediately. A fresh query remains the fallback before the first status read and for indeterminate states.

Alternative considered: always await `getNotificationSettings`. Rejected because it creates unnecessary latency in an explicitly user-triggered navigation action.

### Keep the visual repair scoped to centered Task temporal pickers

The centered Start and Deadline picker path will explicitly apply inset rounded border chrome. While either centered picker backdrop is present, persistent mobile navigation will move below the existing shared backdrop layer. This preserves the established ordering in which selection controls and navigation sit beneath the backdrop, toasts remain above it, and the picker remains highest. The shared popover defaults and full-screen modal policy remain unchanged.

The picker footer will remove surplus outer padding while preserving the existing Clear and Someday actions, touch targets, and divider.

### Apply matching negative inline margins to checklist rows

The checklist editor will retain its existing leading overflow and apply the same magnitude to the trailing handle edge. Both persisted rows and the draft row will use the same alignment so inserting an item does not shift the editor geometry.

## Risks / Trade-offs

- Some operating-system versions may not reinterpret an incremental authorization request as a newly available badge category. The one-time attempt is safe and the refreshed settings remain authoritative; a rebuild and device readback are required to confirm system presentation.
- Caching authorization state can become stale if the user changes Settings while Tasks remains open. Existing lifecycle refreshes remain in place, and the immediate Settings handoff only chooses a destination rather than treating the cache as permanent authorization.
- Reordering persistent navigation while a centered picker is open depends on modern `:has()` support. The supported iOS and macOS WebKit surfaces provide it, and the selector is scoped to the two centered picker backdrop markers so ordinary navigation layering remains unchanged.

## Migration Plan

1. Ship the shared coordinator update in signed iOS and macOS builds.
2. On the next native authorization refresh, previously authorized installations without enabled badges receive the one-time incremental request.
3. Read back `UNNotificationSettings.badgeSetting`; only enabled badges receive the complete Today count.
4. Users who explicitly disabled badges remain unchanged.
5. Rollback is source-only: remove the compatibility request while leaving its versioned preference harmlessly in native defaults.

No database or server migration is required.

## Open Questions

None.
