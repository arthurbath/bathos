# Tasks iOS Companion Specification

## Purpose

Define the thin native iOS host, owner-scoped widget projection, configurable WidgetKit surface, cache privacy boundary, refresh behavior, deep links, and reproducible private build for BathOS Tasks.
## Requirements
### Requirement: Thin Native Tasks Host
The iOS companion SHALL house the authoritative BathOS Tasks web application without recreating task editing, synchronization, recurrence, reminder, or offline-mutation behavior natively, and its authentication bootstrap MUST reach a settled state instead of leaving the application on an indefinite loading view.

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

#### Scenario: Continue without native data services
- **WHEN** the companion edits, synchronizes, schedules, or reminds
- **THEN** it delegates that behavior to the existing web module and does not create a second native task database, generic mutation API, or reminder scheduler

#### Scenario: Prepare the existing offline web shell
- **WHEN** the companion loads the trusted production Tasks origin while online
- **THEN** its persistent WebKit container treats that origin as app-bound so the existing Tasks service worker can stage the authenticated offline shell in the same browsing partition

#### Scenario: Fail visibly instead of presenting a blank web view
- **WHEN** a top-level Tasks navigation or restarted WebKit content process cannot recover cached or network content
- **THEN** the companion performs one bounded automatic recovery navigation and presents its native unavailable state and retry action only if that recovery also fails, rather than leaving an empty web surface

### Requirement: Owner-Scoped Native Projection
The Tasks web application SHALL provide the native companion with one versioned, bounded, owner-scoped projection for every supported widget list while withholding general authentication material and detailed private task content.

#### Scenario: Publish an authenticated projection
- **WHEN** an authenticated companion session has loaded or changed its local synchronized Tasks data
- **THEN** the web module publishes Today, Upcoming, Anytime, Someday, and Done projections through the native bridge

#### Scenario: Bound projected content
- **WHEN** a supported list contains more tasks than the native cache limit
- **THEN** the projection includes the total count, includes only the bounded leading rows in authoritative list order, and marks the list as truncated

#### Scenario: Project an actionable Primary Link
- **WHEN** a projected task has a nonblank Primary Link that normalizes to a supported HTTP, HTTPS, Mail-message, Jira, or Obsidian URL
- **THEN** the row includes only the normalized href and its backward-compatible Mail-or-link transport kind needed for direct activation, while presentation derives protocol-specific iconography from the href

#### Scenario: Withhold sensitive fields
- **WHEN** the web module creates a native projection
- **THEN** it omits notes, checklist text, Mail source metadata, reminder delivery credentials, Supabase access and refresh tokens, PowerSync credentials, native completion credentials, and every non-Tasks record

#### Scenario: Ignore an ordinary browser
- **WHEN** Tasks runs outside the native companion and no approved bridge exists
- **THEN** projection and credential publication perform no native call and do not change normal web behavior

#### Scenario: Preserve the installed read-only widget during rollout
- **WHEN** the web module detects the approved native bridge without a schema-version-2 installation identity
- **THEN** it continues publishing schema-version-1 snapshots and clear messages without Primary Links or a completion credential

#### Scenario: Reject an untrusted bridge message
- **WHEN** a message comes from a subframe, an untrusted origin, an unsupported schema version, or an oversized or malformed payload
- **THEN** the native host rejects it without changing the last accepted cache or native credential

#### Scenario: Change signed-in owners
- **WHEN** the native host receives a valid projection for an owner different from the cached owner
- **THEN** it atomically replaces the complete prior cache before reloading widget timelines

#### Scenario: Sign out
- **WHEN** the authenticated web session signs out
- **THEN** the web module asks the native host to clear cached task projections and the narrow native completion credential, the host attempts credential revocation without retaining prior-owner content, and the widgets stop showing the prior owner's tasks

### Requirement: Configurable Large Task List Widget
The companion SHALL provide a configurable large Home Screen widget that lets the user choose one supported task list and renders its cached leading tasks.

#### Scenario: Configure a widget
- **WHEN** the user edits the widget configuration
- **THEN** the available list choices include Today, Upcoming, Anytime, Someday, and Done

#### Scenario: Render a populated list
- **WHEN** the configured list has a valid cached projection
- **THEN** the large widget shows the list name, task count, and as many leading summaries as fit without exposing omitted task details

#### Scenario: Render an empty list
- **WHEN** the configured list has a current projection with zero tasks
- **THEN** the widget shows the list name and a sentence-case empty state without inventing tasks

#### Scenario: Render before authentication or first projection
- **WHEN** no valid owner-scoped cache exists
- **THEN** the widget prompts the user to open BathOS Tasks and does not show sample or prior-owner task content

#### Scenario: Render a truncated list
- **WHEN** the cached projection reports more tasks than the large widget can display
- **THEN** the widget shows only the first ten tasks in authoritative list order without an overflow message or other indication that additional tasks exist

#### Scenario: Respect widget privacy
- **WHEN** iOS redacts widget content for device privacy
- **THEN** task summaries participate in the system's privacy redaction rather than bypassing it

### Requirement: Native Widget Freshness
The native companion SHALL refresh widget timelines after accepting a changed web projection, SHALL independently request a current bounded projection during system-budgeted WidgetKit timeline generation, and SHALL preserve the last valid projection when a background refresh cannot succeed.

#### Scenario: Accept a changed web projection
- **WHEN** the native host atomically stores a valid web projection whose content differs from the cache
- **THEN** it requests WidgetKit to reload the Tasks widget timeline

#### Scenario: Receive the same web projection
- **WHEN** the native host receives a projection identical to the current cache apart from generation time
- **THEN** it avoids an unnecessary widget reload

#### Scenario: Refresh on the system schedule
- **WHEN** WidgetKit asks the provider for a later timeline and a valid native widget credential is available
- **THEN** the provider requests the current owner-scoped bounded projection, validates and atomically caches a successful response, renders it, and returns a conservative future refresh policy

#### Scenario: Receive a remote task change
- **WHEN** an eligible task or durable Tasks list preference changes on another client before the containing iOS app opens
- **THEN** a later successful WidgetKit background refresh reflects that change without requiring the user to open Tasks

#### Scenario: Fail a background refresh
- **WHEN** the device is offline, the request times out, the server rejects the credential, the response is malformed or oversized, the response owner differs from the credential owner, or persistence fails
- **THEN** the provider leaves the last valid shared projection unchanged and renders that projection without claiming that the failed response is current

#### Scenario: Render cached content without an app-refresh prompt
- **WHEN** a valid shared projection exists, regardless of its generation time
- **THEN** the widget renders the projection without instructing the user to open Tasks to refresh it

#### Scenario: Render before authentication or first projection
- **WHEN** no valid owner-scoped cache or credential-backed response exists
- **THEN** the widget prompts the user to open BathOS Tasks and does not show sample or prior-owner task content

### Requirement: Native Widget Snapshot Authority
The system SHALL authorize a native installation to read only its owner’s bounded widget projection through an expiring, revocable, owner-and-installation-bound credential.

#### Scenario: Read a valid owner projection
- **WHEN** the widget submits a valid unexpired credential to the snapshot operation
- **THEN** the server returns one schema-versioned projection containing Today, Upcoming, Anytime, Someday, and Done in the owner’s current planning date, list order, quick filter, area order, and automatic-sort configuration

#### Scenario: Bound returned lists
- **WHEN** an eligible list contains more than the native cache limit
- **THEN** the response includes the filtered total count, only the bounded leading rows in authoritative order, and an accurate truncation indicator

#### Scenario: Withhold detailed task content
- **WHEN** the server builds a native widget projection
- **THEN** it omits notes, checklist text, reminder records, Mail source metadata, Supabase session material, PowerSync credentials, widget credentials, and every unrelated BathOS record

#### Scenario: Reject invalid native authority
- **WHEN** the snapshot request has a missing, malformed, expired, revoked, or unknown credential
- **THEN** the server returns a content-free rejection and exposes no owner or task data

#### Scenario: Prevent cross-owner reads
- **WHEN** one owner’s valid native credential requests a projection
- **THEN** the server returns only that credential owner’s projection and provides no parameter capable of selecting another owner

#### Scenario: Preserve the replication boundary
- **WHEN** snapshot-read authority is deployed
- **THEN** no credential record or new private function becomes part of PowerSync and the approved Tasks publication remains exactly 20 tables

### Requirement: Native Task Deep Links
The iOS companion SHALL map its private deep links to allowlisted Tasks web routes without treating any deep-link identifier as authorization.

#### Scenario: Open a configured list
- **WHEN** the user taps the widget background or a list deep link
- **THEN** the companion opens the corresponding Today, Upcoming, Anytime, Someday, or Done web route

#### Scenario: Open a visible widget task
- **WHEN** the user taps a task row in the widget
- **THEN** the companion opens the row's configured list and asks the authenticated web module to open that task only when it is visible to the current owner

#### Scenario: Reject an unsupported route
- **WHEN** the companion receives an unknown list, malformed task identifier, non-Tasks path, or untrusted URL
- **THEN** it falls back to the Today route without granting access or mutating task data

### Requirement: Reproducible Private iOS Build
The repository SHALL contain a dependency-free iOS app and widget project with stable personal namespace identifiers and no committed Apple account identity or secret.

#### Scenario: Build without signing
- **WHEN** CI or a development Mac builds the project for a generic iOS Simulator with code signing disabled
- **THEN** the app target, widget extension, shared models, and tests compile using the installed Apple SDKs without downloading third-party packages

#### Scenario: Configure private device signing
- **WHEN** the user selects an eligible Apple Development team in Xcode
- **THEN** automatic signing can provision `garden.bath.tasks`, `garden.bath.tasks.widgets`, and `group.garden.bath.tasks` without changing committed source

#### Scenario: Lack Apple account capability
- **WHEN** the selected team cannot provision App Groups or the widget extension
- **THEN** the project reports that Apple account gate clearly and does not remove the shared-container privacy boundary to force installation

### Requirement: Bounded Native Expansion
The iOS companion SHALL preserve extension points for later Apple-platform surfaces while permitting only explicitly specified native behavior.

#### Scenario: Evaluate an Apple Watch count complication
- **WHEN** lived use shows that a watch task count has recurring value
- **THEN** a later change can reuse the versioned list projection while separately specifying watchOS installation, refresh, privacy, and interaction behavior

#### Scenario: Limit the interactive widget action
- **WHEN** the widget receives native completion authority
- **THEN** that authority can only complete an owned present open task and cannot read, create, edit, delete, reopen, plan, search, or otherwise mutate Tasks data

#### Scenario: Avoid speculative native features
- **WHEN** no observed workflow yet requires additional widget families, native notifications, general App Intents, native task editing, or an Apple Watch complication
- **THEN** the companion omits those features and remains a web host plus bounded widget surface

### Requirement: Native Tasks text editing presents the software keyboard
The Tasks iOS companion SHALL allow ordinary editable web text controls to become the active WebKit editor and present the iOS software keyboard when the user begins editing, including after a native deep-link or widget capture handoff.

#### Scenario: Tap an ordinary text control
- **WHEN** the user taps an editable text field or text area in the native Tasks companion without a connected hardware keyboard
- **THEN** the control receives the insertion point and the iOS software keyboard becomes available for entry

#### Scenario: Launch a new task from a native surface
- **WHEN** a widget or Control Center action opens the existing new-task workflow
- **THEN** Summary receives editing focus and the same native keyboard-presentation behavior as a directly tapped web field

#### Scenario: Preserve hardware-keyboard behavior
- **WHEN** iOS reports a connected hardware keyboard or the user dismisses the software keyboard
- **THEN** the companion does not continuously steal first responder or force the software keyboard back onscreen

### Requirement: Native Tasks launch surfaces remain dark
The Tasks companion SHALL use the BathOS application background color behind and within its persistent WebView throughout cold launch, navigation, recovery, and offline loading.

#### Scenario: Cold-launch the companion
- **WHEN** the native app creates its WebView before web content has painted
- **THEN** no white or contrasting launch surface is visible behind the loading content

### Requirement: Apple Companion Widget Parity
The iOS and macOS Tasks companions SHALL compile the same large-widget renderer, configuration intent, bounded snapshot model, completion action, Primary Link action, iconography, and presentation limits except where an operating system does not support a family or control.

#### Scenario: Change shared large-widget behavior
- **WHEN** the shared large-widget rendering or interaction contract changes
- **THEN** both the iOS and macOS widget targets consume that change from shared source unless a documented platform capability requires a conditional branch

#### Scenario: Preserve iOS-only widget families
- **WHEN** the iOS widget target builds
- **THEN** it retains the existing large Home Screen and rectangular Lock Screen families while the macOS target exposes only the large family

#### Scenario: Preserve iOS-only system controls
- **WHEN** the macOS widget target builds
- **THEN** it excludes the iOS Control Center implementation without removing or changing that control from the iOS target

### Requirement: Native widgets preserve Primary Link identity
The Tasks iOS and macOS widgets SHALL use the closest native equivalent of the web task-row Primary Link identity icon and color every actionable Primary Link icon with native system blue without changing link routing or exposing the Primary Link value in the cached projection.

#### Scenario: Show a generic Primary Link
- **WHEN** a widget task has a generic Primary Link action
- **THEN** the widget uses the native chain-link symbol rather than the external-launch symbol and renders it in native system blue

#### Scenario: Show a recognized Primary Link
- **WHEN** a widget task has a recognized Mail, Jira, or Obsidian Primary Link kind
- **THEN** the widget preserves that kind's existing protocol-specific native symbol and renders it in native system blue

#### Scenario: Activate a widget Primary Link
- **WHEN** the user activates any widget Primary Link icon
- **THEN** the existing widget action opens the configured destination without launching an unrelated Tasks route

### Requirement: iOS shake invokes task undo
The iOS Tasks companion SHALL translate one completed foreground device-shake gesture into the same guarded task-and-checklist undo command used by the Tasks web interface.

#### Scenario: Shake with an undoable task change
- **WHEN** the user shakes the device while the iOS Tasks companion is in the foreground and the task history has a safely undoable change
- **THEN** the companion invokes the existing Tasks undo command exactly once and the synchronized inverse mutation follows the normal task history contract

#### Scenario: Shake with an undoable checklist change
- **WHEN** the user shakes the device while the latest safely undoable Tasks change belongs to a checklist item
- **THEN** the existing Tasks undo arbitration reverses that checklist change without creating a separate native history

#### Scenario: Shake at the undo boundary
- **WHEN** the user shakes the device and no task or checklist change can be safely undone
- **THEN** Tasks performs no mutation and shows the existing neutral Nothing to Undo toast

#### Scenario: Non-shake motion
- **WHEN** the native web view receives a completed motion event that is not a shake
- **THEN** the companion does not dispatch the Tasks undo command

### Requirement: iOS distribution category is Productivity
The Tasks iOS app's primary category in App Store Connect SHALL be Productivity. The project SHALL NOT claim that the macOS-only `LSApplicationCategoryType` plist key controls App Library placement for a development-installed iOS build.

#### Scenario: Distributed iOS metadata is configured
- **WHEN** the Tasks iOS app is prepared for TestFlight or App Store distribution
- **THEN** its App Store Connect primary category SHALL be set to Productivity

#### Scenario: Local development build is inspected
- **WHEN** a development-installed iOS build is grouped under the developer identity in App Library
- **THEN** the repository SHALL treat that label as platform-controlled development metadata rather than adding an unsupported iOS plist override

### Requirement: Minimal Lock Screen Task Rows
The iOS rectangular Lock Screen widget SHALL reserve its horizontal space for task summaries and SHALL show no row context beyond one leading checkbox symbol.

#### Scenario: Render any Lock Screen list
- **WHEN** the rectangular Lock Screen widget renders Today, Upcoming, Anytime, or Someday
- **THEN** every row contains only one leading checkbox symbol and one task Summary, without horizon markers, recurrence symbols, date chips, Area labels, actionability symbols, Primary Link icons, or other metadata

### Requirement: Portrait-Only iPhone Companion
The iOS companion SHALL keep its iPhone interface in upright portrait orientation.

#### Scenario: Rotate an iPhone
- **WHEN** the user rotates an iPhone running Tasks into either landscape orientation
- **THEN** the native Tasks interface remains in upright portrait

#### Scenario: Build the companion
- **WHEN** Xcode produces the iPhone application
- **THEN** the built application declares only `UIInterfaceOrientationPortrait` for iPhone

### Requirement: Interactive Native Widget Completion
The Tasks widget SHALL let the user complete a visible open task from its checkbox without launching the containing app and SHALL apply the result through the authoritative Tasks lifecycle.

#### Scenario: Complete a visible widget task
- **WHEN** the user taps the completion control for a present open task while the server is reachable and the native credential is valid
- **THEN** the server accepts one idempotent completion, records ordinary task history and recurrence effects, and synchronizes the completed state to other clients

#### Scenario: Acknowledge and remove a completed task
- **WHEN** authoritative widget completion succeeds
- **THEN** the tapped control optimistically shows its completed state, the widget keeps that acknowledgement visible for approximately two seconds after authoritative acceptance, removes the task from active cached lists with a system-supported animation, reconciles it into Done, and reloads the Tasks widget timeline

#### Scenario: Revert an unconfirmed optimistic acknowledgement
- **WHEN** the completion request cannot be confirmed
- **THEN** the widget leaves the cached task in place and returns its completion control to the ordinary unchecked appearance without claiming completion

#### Scenario: Invoke one-way completion for either delivered Toggle value
- **WHEN** WidgetKit invokes an open task's completion intent with either the pre-tap or post-tap Boolean value
- **THEN** the intent treats the invocation as the same one-way request to complete that open task

#### Scenario: Retry one transient completion failure
- **WHEN** the first completion attempt has a transient transport failure or retryable HTTP response
- **THEN** the extension retries once with the same operation and mutation identifiers before retaining the task as open

#### Scenario: Retry the same completion
- **WHEN** the extension repeats a completion request with the same idempotency identifier after an ambiguous response
- **THEN** the server returns the original accepted outcome without adding another lifecycle or history transition

#### Scenario: Complete an already completed task
- **WHEN** a distinct valid request targets a task that is already completed
- **THEN** the endpoint returns a safe no-op completion outcome and the widget may reconcile the row without appending duplicate history

#### Scenario: Fail without connectivity or authority
- **WHEN** the completion request cannot reach the server or its credential is missing, expired, revoked, malformed, or bound to another owner
- **THEN** the app does not open, the cached task remains visible, and the widget does not claim completion

#### Scenario: Protect terminal rows
- **WHEN** a widget row represents completed, canceled, or deleted work
- **THEN** it shows its terminal symbol without exposing the interactive completion control

### Requirement: Direct Native Widget Primary Links
The Tasks widget SHALL expose a separate direct Primary Link action for a visible task without changing the task-summary deep link or completion control.

#### Scenario: Open a web Primary Link
- **WHEN** a widget task has a validated HTTP or HTTPS Primary Link and the user taps its trailing protocol-specific or generic link icon
- **THEN** the operating system opens that URL in the configured browser without first opening BathOS Tasks

#### Scenario: Open a Mail Primary Link
- **WHEN** a widget task has a validated `message://` Primary Link and the user taps its trailing Mail icon
- **THEN** the operating system routes the URL to the application registered for that protocol without first opening BathOS Tasks

#### Scenario: Open a Jira Primary Link
- **WHEN** a widget task has a validated `jira:` Primary Link or a recognized Jira HTTP or HTTPS URL
- **THEN** the widget uses the native counterpart to Lucide `Zap` and the operating system opens the Jira application or configured browser as appropriate without first presenting BathOS Tasks

#### Scenario: Open an Obsidian Primary Link
- **WHEN** a widget task has a validated `obsidian:` Primary Link
- **THEN** the widget uses the native counterpart to Lucide `FileText` and the operating system routes the URL to Obsidian without first presenting BathOS Tasks

#### Scenario: Open the task independently
- **WHEN** the user taps the task summary rather than its checkbox or Primary Link icon
- **THEN** the companion opens the existing allowlisted task deep link and performs no completion or external-link action

#### Scenario: Omit an absent or unsafe Primary Link
- **WHEN** the task has no Primary Link or its value cannot normalize to an approved absolute URL
- **THEN** the widget omits the trailing action and does not expose an unusable or unsupported link

#### Scenario: Preserve widget privacy treatment
- **WHEN** iOS redacts sensitive widget content
- **THEN** the task summary and Primary Link action participate in the system privacy treatment without revealing the href as visible text

### Requirement: Native Widget List Presentation
The Tasks widget SHALL present the four active planning lists with compact, top-aligned, neutral native rendering that follows the canonical Tasks iconography.

#### Scenario: Offer supported widget lists
- **WHEN** the user configures a Tasks list widget
- **THEN** the available choices are Today, Upcoming, Anytime, and Someday, with Done omitted

#### Scenario: Render canonical list identity
- **WHEN** a widget renders a supported list
- **THEN** its title uses a neutral native rendering of the canonical Lucide concept for that list: Star for Today, CalendarRange for Upcoming, ListTodo for Anytime, and SquareDashed for Someday

#### Scenario: Keep short lists at the top
- **WHEN** a widget list does not fill the available vertical space
- **THEN** its header and task rows remain aligned to the top rather than being vertically centered

#### Scenario: Keep active completion controls neutral
- **WHEN** a widget renders an open task
- **THEN** its unchecked square uses the ordinary neutral gray treatment without inheriting Today horizon colors

#### Scenario: Identify Today horizons
- **WHEN** the Today widget renders an open task in Inbox, Now, Next, or Later
- **THEN** the row shows the canonical horizon symbol between the completion control and summary using that horizon's canonical green, yellow, red-orange, or reddish-purple color

#### Scenario: Identify Upcoming dates
- **WHEN** the Upcoming widget renders a task beginning one through six calendar days after the projection planning date
- **THEN** the row shows the localized short weekday in a compact chip between the leading task control and summary
- **WHEN** the authoritative Upcoming display date is seven or more calendar days after the projection planning date
- **THEN** the chip instead shows the localized abbreviated month and day

#### Scenario: Protect an Upcoming recurrence projection
- **WHEN** an Upcoming widget row represents a repeating schedule projection rather than a materialized task instance
- **THEN** the row replaces the completion checkbox with the canonical repeating symbol and exposes no completion action

#### Scenario: Omit an extraneous header count
- **WHEN** a widget renders its list header
- **THEN** it shows the canonical icon and list name without a task-count badge or number

#### Scenario: Maximize the large-widget task capacity
- **WHEN** a large widget has ten or fewer projected tasks
- **THEN** it shows every task without an overflow message
- **WHEN** the list has more than ten projected tasks
- **THEN** it shows only the first ten tasks in authoritative list order without an overflow message or other indication that additional tasks exist

#### Scenario: Start a task from the configured list
- **WHEN** the user taps the plus action in the top-right of a large widget
- **THEN** the companion opens the configured Today, Upcoming, Anytime, or Someday view and begins that view's ordinary new-task workflow
- **AND** the draft inherits the same placement criteria that the list's floating add action would apply

### Requirement: Native Widget Credential Boundary
The system SHALL provision, store, rotate, revoke, and validate a purpose-built native credential whose only authorities are reading its owner's final bounded widget projection and completing an owned present open task.

#### Scenario: Provision after authenticated companion use
- **WHEN** a trusted native companion session proves the current Supabase user and supplies its stable installation identifier
- **THEN** the server rotates one owner-and-installation-bound credential, stores only its cryptographic hash, and returns the raw credential once for protected native storage

#### Scenario: Keep the credential out of projections
- **WHEN** the web module publishes task data or the widget renders a timeline
- **THEN** the widget credential is absent from the task snapshot, visible UI, logs, browser persistence, PowerSync, and source control

#### Scenario: Revoke native authority
- **WHEN** the user signs out, the owner changes, or the credential is explicitly revoked
- **THEN** the local credential is removed immediately and future server requests using the revoked credential are rejected

#### Scenario: Preserve the replication boundary
- **WHEN** native widget credentials are stored centrally
- **THEN** their records remain outside the public PowerSync publication and the approved publication remains exactly 20 Tasks tables

### Requirement: Widget Deep-Link Runtime Continuity
The companion SHALL open widget deep links without creating overlapping local Tasks database runtimes and SHALL turn an unexpected startup stall into a recoverable state.

#### Scenario: Route through loaded companion content
- **WHEN** a widget deep link arrives after the companion has loaded Tasks content
- **THEN** the companion performs same-document route navigation without reloading the web document or reconstructing the PowerSync database

#### Scenario: Ignore a canceled replacement navigation
- **WHEN** WebKit reports a canceled navigation because another requested navigation replaced it
- **THEN** the companion does not treat the cancellation as a cold-start failure and does not start recovery

#### Scenario: Bound local runtime initialization
- **WHEN** opening the local Tasks database does not finish within the bounded startup window
- **THEN** Tasks replaces the central spinner with a recoverable error and offers Retry through a fresh database instance

### Requirement: Configurable Lock Screen Task List Widget
The companion SHALL provide an accessory rectangular Lock Screen widget that lets the user choose one supported active task list, renders up to three leading cached task summaries, and opens the configured list in the native Tasks app.

#### Scenario: Add or edit the Lock Screen widget
- **WHEN** the user configures the Tasks accessory rectangular widget
- **THEN** the available list choices are Today, Upcoming, Anytime, and Someday

#### Scenario: Render three or more tasks
- **WHEN** the configured list has three or more cached tasks
- **THEN** the Lock Screen widget shows the first three summaries in authoritative list order with compact neutral task indicators
- **AND** each summary uses the native default system typeface at 13 points and regular weight, matching the Calendar Lock Screen event-title treatment
- **AND** the three rows use slight vertical separation and are vertically centered together inside the widget
- **AND** their row height and separation match the populated one- and two-task states so corresponding task lines occupy approximately the same vertical positions

#### Scenario: Render fewer than three tasks
- **WHEN** the configured list has one or two cached tasks
- **THEN** the Lock Screen widget shows only those tasks without inventing rows or vertically centering the content away from the top

#### Scenario: Render an empty list
- **WHEN** the configured list has a current projection with zero tasks
- **THEN** the Lock Screen widget shows a sentence-case empty state without a count or sample task

#### Scenario: Render without a projection
- **WHEN** no valid owner-scoped cache exists
- **THEN** the Lock Screen widget prompts the user to open Tasks and does not expose sample or prior-owner task content

#### Scenario: Open the configured list
- **WHEN** the user taps anywhere on the Lock Screen widget
- **THEN** the native companion opens the web route for the widget's configured list

#### Scenario: Respect Lock Screen privacy
- **WHEN** iOS redacts sensitive Lock Screen widget content
- **THEN** every task summary participates in system privacy redaction

#### Scenario: Preserve the large Home Screen widget
- **WHEN** the same widget kind renders in the large Home Screen family
- **THEN** it retains its existing header, list presentation, completion controls, task deep links, and Primary Link actions

### Requirement: Control Center Today Inbox Capture
The Tasks companion SHALL provide one nonconfigurable system control on supported iOS versions that opens the authoritative Tasks editor with a new Today Inbox task draft without mutating task data inside the widget extension.

#### Scenario: Discover the control
- **WHEN** the user browses Tasks controls on a supported iOS version
- **THEN** the system offers a `New Task` control with the native square-plus symbol treatment

#### Scenario: Start a task from Control Center
- **WHEN** the user activates the New Task control
- **THEN** iOS opens the Tasks companion to the Today list, opens the existing new-task editor, assigns the draft to Inbox, focuses Summary with its text cursor ready for entry, and requests the standard iOS software keyboard

#### Scenario: Present the native software keyboard
- **WHEN** the new-task Summary input has mounted inside the native companion
- **THEN** the web module requests focus through the bounded native bridge
- **AND** the native companion focuses the known Summary input through a fixed public WebKit script
- **AND** only after WebKit confirms that DOM focus, the companion waits within a bounded interval for its window to become key and primes the standard software keyboard through an empty native text responder in the active view hierarchy
- **AND** once UIKit presents that keyboard, the companion reconfirms the known Summary input and transfers the active responder session to WebKit
- **AND** the native primer never accepts, stores, mirrors, or persists task text

#### Scenario: Add a checklist during creation
- **WHEN** a new task draft is open
- **THEN** the editor offers the same Add Checklist control as an existing task
- **AND WHEN** the user invokes that control after entering a Summary
- **THEN** Tasks persists the draft through the existing creation path and opens the ordinary checklist editor without closing the task

#### Scenario: Identify an empty task draft
- **WHEN** a task's Summary is empty
- **THEN** its summary row displays `New Task` in subdued italic text
- **AND WHEN** the user enters the first Summary character
- **THEN** the placeholder is immediately replaced by the entered Summary without waiting for autosave

#### Scenario: Preserve the authoritative creation workflow
- **WHEN** the user enters a Summary or changes any draft metadata after activating the control
- **THEN** the existing Tasks autosave, offline, synchronization, undo, and close behavior remains authoritative

#### Scenario: Consume one control activation once
- **WHEN** the native companion cold-starts, warm-starts, reloads, or recovers WebKit content after receiving one valid new-task route
- **THEN** the web module consumes and removes that route signal once and does not create duplicate drafts

#### Scenario: Preserve an existing unsaved draft
- **WHEN** the control opens Tasks while one unsaved task draft is already open
- **THEN** Tasks focuses that draft rather than discarding its pending metadata or opening a second draft

#### Scenario: Reject unsupported creation routes
- **WHEN** the native companion receives an unknown route, arbitrary placement value, or malformed new-task route
- **THEN** it falls back to the ordinary Today list without creating a task or granting data authority

#### Scenario: Run on an older supported system
- **WHEN** the app or widget extension runs on iOS 17
- **THEN** the Control Center control is absent while the containing app and existing widgets continue to work
