## MODIFIED Requirements

### Requirement: Thin Native Tasks Host
The iOS companion SHALL house the authoritative BathOS Tasks web application without recreating task editing, synchronization, recurrence, or offline-mutation behavior natively, MAY project authoritative reminder instants into bounded operating-system local notifications, and MUST reach a settled authentication state instead of leaving the application on an indefinite loading view.

#### Scenario: Launch the companion
- **WHEN** the user launches the iOS companion without a pending deep link
- **THEN** it opens the production Today route in a native WebKit container and uses the ordinary BathOS authentication and Tasks experience

#### Scenario: Serialize companion authentication
- **WHEN** the approved single-view native Tasks bridge is present
- **THEN** Supabase authentication uses a process-local serialized lock that cannot be held by a stale external WebKit document

#### Scenario: Preserve ordinary browser session coordination
- **WHEN** BathOS runs in Safari, an installed PWA, or another context without the approved native Tasks bridge
- **THEN** Supabase authentication retains its ordinary browser lock behavior for cross-tab session coordination

#### Scenario: Settle a failed initial session read
- **WHEN** the initial Supabase session read rejects during application startup
- **THEN** BathOS leaves its loading state and presents a recoverable authentication state rather than displaying the central spinner indefinitely

#### Scenario: Follow an internal Tasks route
- **WHEN** the web application navigates among trusted BathOS Tasks routes
- **THEN** the companion keeps that navigation inside the WebKit container

#### Scenario: Follow an unrelated external link
- **WHEN** the user activates a link outside the trusted BathOS origin
- **THEN** the companion opens that URL through the operating system rather than granting it access to the Tasks bridge

#### Scenario: Keep native data services bounded
- **WHEN** the companion edits, synchronizes, schedules, or reminds
- **THEN** it delegates task-domain behavior to the existing web module and limits native reminder behavior to reconciling canonical synchronized reminder instants into operating-system requests without creating a second task database, generic mutation API, or recurrence evaluator

#### Scenario: Prepare the existing offline web shell
- **WHEN** the companion loads the trusted production Tasks origin while online
- **THEN** its persistent WebKit container treats that origin as app-bound so the existing Tasks service worker can stage the authenticated offline shell in the same browsing partition

#### Scenario: Fail visibly instead of presenting a blank web view
- **WHEN** a top-level Tasks navigation or restarted WebKit content process cannot recover cached or network content
- **THEN** the companion performs one bounded automatic recovery navigation and presents its native unavailable state and retry action only if that recovery also fails, rather than leaving an empty web surface

## ADDED Requirements

### Requirement: iOS Native Reminder Notifications
The iOS companion SHALL use UserNotifications to report authorization, request permission only after explicit user action, reconcile a bounded owner-scoped set of future reminder requests, present a native Reminder notification whose body is the task Summary, and display the full Today-list task count as the application badge while notification and badge authorization are enabled.

#### Scenario: Inspect iOS notification authorization
- **WHEN** the native bridge becomes available or the app returns to the foreground
- **THEN** the companion reads current authorization and reports Enabled, Not Enabled, or Blocked in Settings to the web Settings surface

#### Scenario: Enable iOS notifications
- **WHEN** authorization is not determined and the user activates Enable
- **THEN** iOS presents its alert, sound, and badge permission workflow and Tasks refreshes the reported status after the workflow completes

#### Scenario: Synchronize the iOS app badge
- **WHEN** an accepted foreground or background snapshot reports a Today-list total while notification and badge authorization are enabled
- **THEN** the companion sets the app-icon badge to that complete unfiltered Today-list total regardless of horizon, active quick filter, or bounded visible widget rows

#### Scenario: Clear the iOS app badge
- **WHEN** notification authorization or badge presentation is not enabled, the owner signs out, or the Today-list total is zero
- **THEN** the companion clears the app-icon badge

#### Scenario: Route denied authorization to Settings
- **WHEN** iOS authorization is denied and the user activates Enable
- **THEN** the companion opens the Tasks notification settings screen when the operating system exposes that destination

#### Scenario: Schedule an authoritative reminder
- **WHEN** an open present task has a future active reminder whose local date matches the task Start date synchronized to the companion and notification authorization is enabled
- **THEN** the companion schedules one app-owned local notification titled Reminder with the task Summary as its body at that exact instant

#### Scenario: Reconcile changed reminders
- **WHEN** the synchronized reminder projection changes
- **THEN** the companion removes obsolete app-owned pending requests and schedules the earliest bounded future requests without changing unrelated notifications

#### Scenario: Present while foregrounded
- **WHEN** an app-owned reminder fires while Tasks is in the foreground
- **THEN** iOS still presents its native banner and sound and the web app does not present a duplicate in-app toast

#### Scenario: Open the reminded task
- **WHEN** the user activates an app-owned reminder notification
- **THEN** the companion opens the referenced task through the existing native task route

#### Scenario: Fall back when native notifications are unavailable
- **WHEN** iOS authorization is not enabled
- **THEN** the companion reports native notifications as disabled and an open Tasks web surface remains eligible to show the persistent in-app reminder toast
