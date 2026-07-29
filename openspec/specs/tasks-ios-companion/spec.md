# Tasks iOS Companion Specification

## Purpose

Define the thin native iOS host, owner-scoped widget projection, configurable WidgetKit surface, cache privacy boundary, refresh behavior, deep links, and reproducible private build for BathOS Tasks.

## Requirements

### Requirement: Thin Native Tasks Host
The iOS companion SHALL house the authoritative BathOS Tasks web application without recreating task editing, synchronization, recurrence, reminder, or offline-mutation behavior natively, and SHALL prevent unrelated BathOS modules from replacing Tasks inside its WebKit container.

#### Scenario: Launch the companion
- **WHEN** the user launches the iOS companion without a pending deep link
- **THEN** it opens the production Today route in a native WebKit container and uses the ordinary BathOS authentication and Tasks experience

#### Scenario: Follow an internal Tasks route
- **WHEN** the web application navigates among trusted BathOS Tasks routes
- **THEN** the companion keeps that navigation inside the WebKit container

#### Scenario: Follow a required platform route
- **WHEN** Tasks navigates to Account, sign-in, sign-up, password recovery, terms, or help
- **THEN** the companion may keep that required platform route inside the WebKit container

#### Scenario: Follow another BathOS module
- **WHEN** the user activates a trusted-origin link to the platform launcher, Administration, or a BathOS module other than Tasks
- **THEN** the companion opens that URL through the operating system and leaves its Tasks WebKit route unchanged

#### Scenario: Follow an unrelated external link
- **WHEN** the user activates a link outside the trusted Tasks and required platform routes
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
The Tasks web application SHALL provide the native companion with one versioned, bounded, owner-scoped projection for every supported widget list while withholding authentication material and detailed private task content.

#### Scenario: Publish an authenticated projection
- **WHEN** an authenticated companion session has loaded or changed its local synchronized Tasks data
- **THEN** the web module publishes Today, Upcoming, Anytime, Someday, and Done projections through the native bridge

#### Scenario: Bound projected content
- **WHEN** a supported list contains more tasks than the native cache limit
- **THEN** the projection includes the total count, includes only the bounded leading rows in authoritative list order, and marks the list as truncated

#### Scenario: Withhold sensitive fields
- **WHEN** the web module creates a native projection
- **THEN** it omits notes, checklist text, Primary Link values, Mail source metadata, reminder delivery credentials, Supabase tokens, PowerSync credentials, and every non-Tasks record

#### Scenario: Ignore an ordinary browser
- **WHEN** Tasks runs outside the native companion and no approved bridge exists
- **THEN** projection publication performs no native call and does not change normal web behavior

#### Scenario: Reject an untrusted bridge message
- **WHEN** a message comes from a subframe, an untrusted origin, an unsupported schema version, or an oversized or malformed payload
- **THEN** the native host rejects it without changing the last accepted cache

#### Scenario: Change signed-in owners
- **WHEN** the native host receives a valid projection for an owner different from the cached owner
- **THEN** it atomically replaces the complete prior cache before reloading widget timelines

#### Scenario: Sign out
- **WHEN** the authenticated web session signs out
- **THEN** the web module treats an unavailable browser Push API as no existing browser subscription, asks the native host to clear cached task projections, and the widgets stop showing the prior owner's tasks

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
The native companion SHALL refresh widget timelines after accepting a changed web projection and SHALL represent the widget as a cached, system-budgeted surface rather than claiming continuous synchronization.

#### Scenario: Accept a changed projection
- **WHEN** the native host atomically stores a valid projection whose content differs from the cache
- **THEN** it requests WidgetKit to reload the Tasks widget timeline

#### Scenario: Receive the same projection
- **WHEN** the native host receives a projection identical to the current cache apart from generation time
- **THEN** it avoids an unnecessary widget reload

#### Scenario: Reload on the system schedule
- **WHEN** WidgetKit asks the provider for a later timeline
- **THEN** the provider re-reads the shared cache and returns a conservative future refresh policy

#### Scenario: Remain usable offline
- **WHEN** the device has no network connection but a valid shared projection exists
- **THEN** the widget continues rendering that cached projection and the containing app launches the existing cached Tasks web shell and owner-bound local task data

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
The iOS companion SHALL preserve extension points for later Apple-platform surfaces without including them in the mandatory first delivery.

#### Scenario: Evaluate an Apple Watch count complication
- **WHEN** lived use shows that a watch task count has recurring value
- **THEN** a later change can reuse the versioned list projection while separately specifying watchOS installation, refresh, privacy, and interaction behavior

#### Scenario: Avoid speculative native features
- **WHEN** no observed workflow yet requires interactive widgets, native notifications, App Intents beyond widget configuration, or native task editing
- **THEN** the first companion omits those features and remains a web host plus read-only widget surface

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
