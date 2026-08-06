# Tasks iOS Companion

This Xcode project contains the thin native BathOS Tasks companion, its configurable Home Screen and Lock Screen widgets, its New Task system control, and its focused Apple Watch capture companion.

## Targets

- `TasksCompanion`: SwiftUI application containing the production Tasks web application in `WKWebView`
- `TasksWidgets`: configurable WidgetKit extension for Today, Upcoming, Anytime, and Someday, plus the New Task system control on iOS 18 and later
- `TasksWatch`: watchOS application for adding a task to Today Inbox through the system text-entry interface
- `TasksWatchWidgets`: accessory-circular complication showing completed Today tasks as a share of the current planning day's non-deleted Today tasks
- `TasksCompanionTests`: dependency-free tests for cache validation and deep-link routing

## Identifiers

- App: `garden.bath.tasks`
- Widget extension: `garden.bath.tasks.widgets`
- Watch app: `garden.bath.tasks.watchkitapp`
- Watch complication: `garden.bath.tasks.watchkitapp.widgets`
- Shared App Group: `group.garden.bath.tasks`
- Apple development team: `SPJYXE7ZA3`
- URL scheme: `bathostasks`

## Apple Team Setup

1. Select an eligible Apple Developer team for the app and widget targets.
2. Register the iPhone app, iPhone widget, Watch app, and Watch complication bundle identifiers.
3. Enable the App Groups capability for all four identifiers.
4. Add `group.garden.bath.tasks` to all four targets.
5. Let Xcode create or download the corresponding development provisioning profiles.
6. Build and install the `TasksCompanion` scheme on the intended iPhone.

Do not replace the checked-in App Group identifier or create a second shared container for local development. App and widget must use the same entitlement.

## Native Reminders

Tasks Settings reports the iPhone's current notification authorization. **Enable** invokes the iOS permission workflow when authorization has not yet been decided and opens the app's notification settings after authorization has been denied. There is no second Tasks-owned on/off preference; iOS Settings is authoritative.

The trusted Tasks web surface publishes a bounded projection of active reminder IDs, task IDs, Summaries, and already-resolved reminder instants. The companion schedules the earliest 60 future values as local UserNotifications, removes obsolete app-owned requests after task changes, shows the native banner and sound even while Tasks is foregrounded, and opens the referenced task when the notification is activated. Swift does not calculate recurrence, Start, or reminder dates. If iOS authorization is not enabled, an open Tasks surface continues using the persistent in-app reminder toast.

## Apple Watch

The Watch app intentionally has one job. Its plus button opens the standard watchOS text-entry interface, and submitting non-empty text creates an owned task with an explicit Start date of the owner's current planning day and the Inbox Today horizon. It does not download or display task lists.

The accessory-circular complication uses one solid circular track with a high-contrast clockwise progress stroke beginning at 12 o'clock and a bold centered checkmark. Its denominator is the current set of open Today-horizon tasks plus Today-horizon tasks completed on the owner's current planning day. Its numerator is the completed subset. Canceled tasks, deleted tasks, stale completions, future tasks, and recurrence projections are excluded. Tapping the complication opens the Watch app.

The iPhone transfers the existing expiring widget credential to its paired Watch through `WatchConnectivity`. If that capability is missing or rejected, the Watch requests a replacement in the background without sending task content through the phone. The credential grants only the bounded Watch capture and aggregate-progress operations at the Edge Function boundary, and the Watch sends captured task summaries directly to that HTTPS boundary. The watchOS 26 complication registers a WidgetKit push token so owner changes can prompt an earlier progress timeline, while activation refresh and the existing 30-minute requested timeline remain fallback paths. watchOS ultimately schedules both mechanisms according to its system budget, so neither is an immediate-delivery guarantee.

Production acceptance requires applying `20260801195000_add_tasks_watch_capture_and_progress.sql` and `20260802214500_fix_tasks_watch_today_progress.sql`, deploying `tasks-widget-actions` with the matching backward-compatible handler, rebuilding the automatically signed companion, installing it on the paired iPhone and Watch, and verifying capture, sign-out clearing, owner replacement, complication progress, and offline cached rendering on physical hardware.

## Local Validation

With a Simulator runtime matching the installed Xcode SDK:

```sh
xcodebuild \
  -project ios/TasksCompanion/TasksCompanion.xcodeproj \
  -scheme TasksCompanion \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build-for-testing
```

Run the `TasksCompanion` scheme from Xcode to perform interactive sign-in and widget acceptance. A physical device and eligible Apple team are required to prove production App Group provisioning and Home Screen behavior.

The large Home Screen widget shows up to ten leading tasks from the configured list with interactive task completion and Primary Link actions. Today rows include the task's colored horizon symbol. Upcoming rows include a compact short-weekday or month-and-day chip, and recurrence schedule projections replace the inapplicable completion control with a repeating symbol. Generic Primary Links use the native chain-link symbol, while recognized Mail, Jira, and Obsidian destinations retain protocol-specific symbols. Additional tasks remain implicit rather than consuming a row with an overflow message. The rectangular Lock Screen widget shows up to three leading task summaries from the configured list using the same bounded list context. Tapping the Lock Screen widget opens that list in the native companion.

WidgetKit timeline generation independently requests the current bounded owner projection and schedules another refresh after 30 minutes. On iOS 26 or later, the widget also registers an owner-and-installation-bound WidgetKit push token through the same narrow widget authority. Content-free server invalidations can prompt an earlier timeline after task changes made on any client. iOS ultimately controls both opportunities and may defer them according to system budgets. A successful response is validated and atomically cached. Offline, timed-out, rejected, malformed, oversized, cross-owner, or unpersistable responses leave the last valid cache untouched, so the widget remains useful without instructing the user to open the app merely to refresh it.

## Control Center

On iOS 18 or later, open Control Center editing, choose **Add a Control**, find **New Task** under Tasks, and place it in Control Center. The same control may appear on other system control surfaces supported by the installed iOS version.

The control uses Apple's adaptive `plus.square` symbol and opens the native companion to one new task in Today Inbox with Summary focused. It does not create task data inside the widget extension. The authoritative web editor retains autosave, offline, synchronization, undo, and close behavior. If one unsaved draft is already open, the control returns focus to that draft instead of replacing it.

The shared OpenIntent writes one bounded, opaque request marker into the existing private App Group before iOS opens the containing app. The app atomically consumes that marker and invokes the allowlisted `bathostasks://new` route behavior once. This avoids Associated Domains, which Apple Personal Teams cannot provision, while preserving the same private capability boundary as the existing widgets.

The control is unavailable on iOS 17. The containing app remains available there, while the WidgetKit extension now requires iOS 26 for server-triggered widget refresh support.

## Privacy Boundary

The companion accepts widget snapshots only from the main frame at `https://os.bath.garden/tasks/*`. The versioned decoder enforces list, row, string, date, and enum bounds before atomically replacing the App Group cache.

The cache intentionally omits authentication material, notes, checklist text, recurrence-rule details, Mail source metadata, and raw errors. It contains only the bounded list information rendered by the widget, including Today horizon, authoritative Upcoming display date, recurrence-projection state, and an optional normalized Primary Link action for approved HTTP, HTTPS, Mail-message, Jira, and Obsidian URLs. The separate widget credential can read only that final bounded projection and complete an owned open task. Signing out clears both the cache and credential.
