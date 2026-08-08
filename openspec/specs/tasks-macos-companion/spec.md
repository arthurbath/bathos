# tasks-macos-companion Specification

## Purpose
TBD - created by archiving change add-tasks-macos-companion. Update Purpose after archive.
## Requirements
### Requirement: Canonical Lucide macOS Widget Iconography
The shared macOS Tasks widget SHALL use the same canonical Lucide icon vocabulary as the Tasks application and iOS list widget for list identity, Today horizons, task state, recurrence, Primary Links, add actions, and empty states.

#### Scenario: Render the Mac list widget
- **WHEN** macOS renders any supported Tasks widget list and row state
- **THEN** every Tasks-domain icon position uses the corresponding canonical Lucide geometry, semantic color, and accessible meaning

#### Scenario: Change a canonical Tasks icon
- **WHEN** a canonical icon assignment changes in the Tasks application
- **THEN** a contract check identifies any stale macOS widget assignment before release

### Requirement: Thin Native macOS Tasks Host
The system SHALL provide a native macOS SwiftUI application that hosts the authoritative production Tasks web application in a persistent app-bound `WKWebView`.

#### Scenario: Launch the Mac companion
- **WHEN** the user launches the installed Mac app
- **THEN** it opens the production Today view in a dark native window and preserves web authentication, offline storage, and synchronized task behavior

#### Scenario: Follow an internal Tasks route
- **WHEN** the user navigates among Tasks lists, Settings, task links, or required account and authentication routes
- **THEN** the destination remains inside the existing native web view

#### Scenario: Follow another module or external destination
- **WHEN** the user follows another BathOS module, an ordinary web URL, or an approved external protocol
- **THEN** macOS opens it in the user's default browser or protocol application rather than replacing Tasks inside the native window

#### Scenario: Recover a failed initial load
- **WHEN** the production route cannot initially load and no cached web content can render
- **THEN** the app shows an explicit retryable unavailable state instead of a blank window or permanent spinner

#### Scenario: Combine Tasks with another full-screen application
- **WHEN** the user invokes macOS Split View or a compatible two-up full-screen tiling action from the Tasks window
- **THEN** the Tasks window explicitly remains eligible for placement beside another eligible application and can resize to a narrow mobile-class content width

#### Scenario: Preserve tiling eligibility across window transitions
- **WHEN** SwiftUI reconciles the main window or the window enters or exits full screen
- **THEN** Tasks retains its resizable style, explicit full-screen tiling eligibility, and narrow mobile-class minimum without acquiring a behavior that disallows tiling

### Requirement: Native macOS Task Navigation Commands
The Mac companion SHALL own desktop view shortcuts before WebKit or macOS can reserve them.

#### Scenario: Switch views with Command and a number
- **WHEN** the Tasks window is active and the user presses Command+1, Command+2, Command+3, Command+4, Command+5, or Command+6
- **THEN** the app routes the existing web view to Today, Upcoming, Anytime, Someday, Done, or Settings respectively without opening a second window

#### Scenario: Retain web Control shortcuts
- **WHEN** the user presses an existing Control-based Tasks shortcut not owned by a native menu command
- **THEN** the key event remains available to the web module and retains its documented Tasks behavior

### Requirement: Native macOS Escape Ownership
The Mac companion SHALL consume unmodified Escape while its window is active, forward the action to the Tasks web surface, and prevent the same event from making the native window leave full screen.

#### Scenario: Cancel the deepest Tasks surface
- **WHEN** the user presses unmodified Escape with a task picker, menu, selection, drag, or other Escape-owned Tasks surface active
- **THEN** the web surface receives one Escape action and performs its ordinary deepest-layer cancellation

#### Scenario: Remain in full screen
- **WHEN** the active Tasks window is full screen and the user presses unmodified Escape
- **THEN** the app remains full screen regardless of whether the web surface changed state

#### Scenario: Preserve modified and unrelated Escape
- **WHEN** Escape includes another modifier or the Tasks window is not the active key window
- **THEN** the companion does not consume that event as its unmodified Tasks Escape command

### Requirement: Native macOS Task Deep Links
The Mac companion SHALL accept the allowlisted Tasks URL scheme for list, task, and new-task routes.

#### Scenario: Open a configured widget list
- **WHEN** the user activates the Mac widget header
- **THEN** the installed app opens or activates and shows the configured Tasks list

#### Scenario: Open a visible widget task
- **WHEN** the user activates a task summary in the Mac widget
- **THEN** the installed app opens or activates the owning list and exposes that task

#### Scenario: Reject an unsupported route
- **WHEN** a custom URL does not match an allowlisted list, task UUID, or new-task route
- **THEN** the app falls back to Today without executing arbitrary navigation

### Requirement: Configurable macOS Task List Widget
The Mac companion SHALL provide one configurable large WidgetKit surface for Today, Upcoming, Anytime, and Someday using the shared Apple-platform Tasks widget behavior.

#### Scenario: Configure the Mac widget
- **WHEN** the user edits the Mac widget
- **THEN** the choices are Today, Upcoming, Anytime, and Someday, with Done omitted

#### Scenario: Render a populated list
- **WHEN** a valid owner-scoped projection exists for the configured list
- **THEN** the widget shows the canonical list identity and up to the first ten tasks in authoritative order using the same presentation policy as the iOS large widget

#### Scenario: Complete a task
- **WHEN** the user activates an open task's completion control
- **THEN** the widget performs the existing narrow owner-scoped completion action, displays its optimistic acknowledgement, and reconciles the cached lists without opening the app

#### Scenario: Show a Primary Link
- **WHEN** a projected task has an approved Primary Link
- **THEN** its generic or protocol-specific native identity icon uses the shared native system blue link treatment

#### Scenario: Open a Primary Link
- **WHEN** the user activates the projected task's Primary Link control
- **THEN** macOS opens the normalized destination in the default browser or protocol application without opening the Tasks app

#### Scenario: Refresh independently
- **WHEN** WidgetKit requests a timeline while a valid widget credential exists
- **THEN** the extension requests a current bounded projection, atomically stores a valid result, and retains the last valid cache when refresh fails

#### Scenario: Preserve widget privacy
- **WHEN** the Mac widget renders owner task content
- **THEN** task summaries participate in system privacy treatment and the cache excludes notes, checklist text, authentication material, and raw errors

### Requirement: Reproducible Signed macOS Companion
The repository SHALL provide a reproducible build and installation path for the Mac app and its embedded widget using stable identifiers and compatible Apple signing.

#### Scenario: Build without signing
- **WHEN** a developer runs the documented macOS validation build with signing disabled
- **THEN** the app, widget, and tests compile against the selected macOS SDK without requiring production credentials

#### Scenario: Build with automatic signing
- **WHEN** the existing eligible Apple developer team and App Group are available
- **THEN** Xcode signs `garden.bath.tasks`, `garden.bath.tasks.widgets`, and `group.garden.bath.tasks` without changing committed identifiers

#### Scenario: Install only verified output
- **WHEN** a signed build is prepared for local installation
- **THEN** the install flow strictly verifies the app and nested widget signatures, identifiers, and entitlements before replacing the installed app

#### Scenario: Fail closed without compatible signing
- **WHEN** compatible Apple signing or App Group provisioning is unavailable
- **THEN** the build or install stops without ad-hoc signing, entitlement removal, or replacement of a previously verified installed app

### Requirement: Unified Apple Tasks Identity
The macOS and iOS companions SHALL present one Tasks product identity while retaining platform-specific native implementations.

#### Scenario: Present the Mac application
- **WHEN** macOS displays the installed application in Finder, the Dock, the app menu, or a system picker
- **THEN** its user-visible name is `Tasks`

#### Scenario: Identify platform counterparts
- **WHEN** Apple system services inspect the iOS and macOS app and widget bundles
- **THEN** both apps use `garden.bath.tasks`, both widgets use `garden.bath.tasks.widgets`, both widgets use `garden.bath.tasks.list-widget`, and all four targets use the same Apple team and `group.garden.bath.tasks` App Group

#### Scenario: Prefer the native Mac widget identity
- **WHEN** the Mac app and its widget are installed on a Mac that can also expose the paired iPhone widget
- **THEN** WidgetKit can identify the native Mac widget as the platform counterpart instead of treating BathOS Tasks as an unrelated second app

#### Scenario: Replace the superseded Mac installation
- **WHEN** a verified `Tasks.app` is installed after this identity alignment
- **THEN** the old `BathOS Tasks.app` is no longer left active in an Applications directory to advertise a competing widget extension

### Requirement: Native Cache-Clearing Web-View Refresh
The Tasks native desktop companion SHALL provide a deep hard-refresh command that clears reload-safe web caches before reloading the current Tasks route while preserving authentication and durable local application data.

#### Scenario: Refresh the active Mac web view
- **WHEN** the Tasks window is active on macOS and the user presses Command+Option+R
- **THEN** the companion consumes the shortcut, clears its response and Fetch Cache data, and reloads the current route from its origin

#### Scenario: Preserve signed-in and offline state
- **WHEN** the cache-clearing refresh runs
- **THEN** it preserves cookies, credentials, local storage, IndexedDB, OPFS task data, service-worker registrations, and App Group widget data

#### Scenario: Preserve unrelated keyboard input
- **WHEN** the chord uses different modifiers or the Tasks window is not active
- **THEN** the macOS companion does not consume it as the cache-clearing refresh command

#### Scenario: Keep Windows shortcut parity
- **WHEN** the same command is implemented by a native Windows Tasks host
- **THEN** its chord is Control+Alt+R and its cache-preservation boundary matches the macOS command

### Requirement: Canonical macOS Tasks Icon
The macOS companion SHALL present the canonical Tasks artwork as a full-bleed native app icon wherever macOS displays the application or its WidgetKit provider.

#### Scenario: Apply the macOS icon mask
- **WHEN** macOS renders the Tasks app icon in Finder, the Dock, Spotlight, an application menu, or Notification Center's widget selector
- **THEN** the black artwork fills the system-provided squircle and the system mask clips its outer rectangular corners without showing an inset source rectangle

#### Scenario: Preserve canonical artwork
- **WHEN** the Mac icon is built
- **THEN** it uses the existing Tasks PWA artwork as its visual authority and preserves the white SquareCheckBig concept on the dark Tasks background

#### Scenario: Preserve the iOS icon
- **WHEN** the Mac-specific icon implementation changes
- **THEN** the iOS companion continues using its existing correctly rendered app icon

### Requirement: Singular macOS Tasks Widget Registration
The installed Mac companion SHALL expose one current `Tasks` WidgetKit provider and SHALL NOT leave a separate superseded `BathOS Tasks` provider registered.

#### Scenario: Discover Tasks widgets
- **WHEN** Notification Center enumerates widgets from `/Applications/Tasks.app`
- **THEN** it presents the unified `Tasks` provider with the native Mac and paired iPhone choices under that identity

#### Scenario: Remove a stale superseded registration
- **WHEN** no `BathOS Tasks.app` bundle remains installed but LaunchServices or WidgetKit still advertises that prior name
- **THEN** the bounded installation cleanup removes the stale registration, re-registers the verified current Tasks bundle, and preserves Tasks user and widget data

### Requirement: Discoverable Embedded macOS Tasks Widget
The verified macOS Tasks installation SHALL embed and register its native WidgetKit extension so macOS offers the On This Mac widget alongside the paired iPhone widget under the unified Tasks identity.

#### Scenario: Build the Mac widget extension
- **WHEN** the macOS Tasks scheme builds the companion application
- **THEN** the build produces the Tasks Mac widget extension for the current macOS deployment target and embeds it in the application plug-ins directory

#### Scenario: Verify widget signing and entitlements
- **WHEN** a signed Tasks application is prepared for installation
- **THEN** the app and nested widget share the configured Apple team and App Group, each passes strict signature verification, and the nested extension retains its WidgetKit extension point

#### Scenario: Discover the installed Mac widget
- **WHEN** the verified Tasks application is installed in `/Applications` and macOS enumerates available widgets
- **THEN** Tasks offers an On This Mac list widget and continues to offer the paired From iPhone widget as its platform counterpart

#### Scenario: Preserve widget data while refreshing registration
- **WHEN** installation refreshes LaunchServices or WidgetKit registration to recover a missing Mac widget
- **THEN** the process preserves App Group task projections, widget configuration, authentication material, and the installed iOS companion

#### Scenario: Fail before replacing a working app
- **WHEN** the built application lacks its extension, compatible signing, required entitlements, or strict verification
- **THEN** the installation stops before replacing the last verified Tasks application

### Requirement: Configurable Global macOS Quick Entry
The macOS companion SHALL let the user record one global keyboard shortcut and SHALL use it to present the authoritative native Tasks new-task editor from any active macOS application.

#### Scenario: Configure the shortcut
- **WHEN** Tasks runs in the native macOS companion and the user activates the Global Quick Entry shortcut recorder in Settings
- **THEN** the next supported modified keystroke becomes the persisted shortcut, replaces any prior registration, and is displayed using macOS shortcut notation

#### Scenario: Withhold the setting outside native macOS
- **WHEN** Tasks runs in an ordinary browser, a PWA, or the iOS companion
- **THEN** the Global Quick Entry Settings card is absent

#### Scenario: Invoke the shortcut globally
- **WHEN** the configured shortcut is pressed while any macOS application is active
- **THEN** Tasks synchronously presents a compact centered native overlay above the current Space without first requiring the main Tasks window to be active or waiting for a web document

#### Scenario: Reuse the authoritative task form contract
- **WHEN** the quick-entry overlay opens
- **THEN** it renders native Summary, Notes, Link, checklist, Start, Deadline, Area, Actionability, reminder, picker, validation, traversal, and Control-command behavior from the same versioned contract as the web new-task workflow

#### Scenario: Preserve overlay geometry during native hosting
- **WHEN** AppKit installs or reuses the SwiftUI editor
- **THEN** the quick-entry panel retains its declared content size instead of collapsing to the hosted view's initial intrinsic size

#### Scenario: Present only the quick-entry editor
- **WHEN** the global quick-entry overlay displays a new-task draft
- **THEN** Tasks shows the native metadata editor without the list summary row, completion control, ellipsis menu, or blue open-task background

#### Scenario: Keep temporal pickers inside the overlay
- **WHEN** the user opens Start or Deadline from global quick entry
- **THEN** Tasks presents a native picker within the overlay's usable bounds, preserves documented keyboard navigation and focus handoff, and does not clip it against the editor field position

#### Scenario: Edit content that exceeds the overlay
- **WHEN** Notes or checklist content becomes taller than the quick-entry overlay
- **THEN** the editor remains vertically scrollable and the user can create, edit, and reorder checklist items through the same semantic controls as the ordinary new-task form

#### Scenario: Submit quick entry
- **WHEN** the user commits a valid nonempty quick-entry draft
- **THEN** Tasks atomically creates exactly one complete task through the bounded authenticated native authority, closes the overlay, and refreshes the main Tasks surface and native widgets

#### Scenario: Cancel quick entry
- **WHEN** the user cancels the overlay or dismisses an empty or partial draft
- **THEN** the overlay closes without creating, changing, or recoverably deleting a task

#### Scenario: Preserve shortcut safety
- **WHEN** a shortcut is unsupported, reserved, incomplete, or cannot be registered
- **THEN** Tasks keeps the prior working registration, explains the failure without exposing raw native diagnostics, and logs bounded diagnostic detail

### Requirement: Native macOS First-Pointer Delivery
The native macOS Tasks companion SHALL allow a pointer press over its hosted Tasks web surface to activate an inactive Tasks window and reach the intended web interaction as the same pointer sequence.

#### Scenario: Activate a control with the first click
- **WHEN** the Tasks window is visible but inactive and the user clicks an interactive element in the hosted Tasks surface
- **THEN** the window becomes active and the element receives that initial click without requiring a second click

#### Scenario: Begin dragging with the first press
- **WHEN** the Tasks window is visible but inactive and the user presses and drags an eligible task or checklist item
- **THEN** the window becomes active and the hosted Tasks surface receives the original pointer sequence so its existing drag interaction can begin without a second attempt

#### Scenario: Preserve ordinary active-window interaction
- **WHEN** the Tasks window is already active
- **THEN** clicks, text selection, controls, and drag gestures retain their existing WebKit behavior without duplicated or synthetic events

### Requirement: Reliable macOS Widget Completion Authority
The macOS companion SHALL ensure that its shared widget receives the same narrow owner-and-installation-bound completion credential used by the interactive Apple Tasks widget.

#### Scenario: Recover a transient credential-issuance failure
- **WHEN** the Mac companion publishes its synchronized widget projection but its first authenticated credential-issuance request fails or returns an invalid result
- **THEN** the web host retries with bounded backoff until it publishes a valid credential for the current owner and installation or that companion session ends

#### Scenario: Stop recovery for a replaced session
- **WHEN** the authenticated owner or native companion session changes while credential recovery is pending
- **THEN** the prior recovery loop stops without publishing its result into the replacement session

#### Scenario: Complete from the Mac widget
- **WHEN** a valid credential has reached the shared App Group and the user activates an open task's Mac widget checkbox
- **THEN** the existing narrow completion intent updates the authoritative task and reconciles the widget without opening the app

### Requirement: Compact macOS Widget Density
The macOS widget SHALL preserve the shared Tasks row semantics while fitting ten rows with comfortable outer padding.

#### Scenario: Render ten Mac widget rows
- **WHEN** the macOS large widget renders its maximum ten tasks
- **THEN** each row uses one point less minimum vertical height than the corresponding iOS large-widget row without changing the shared controls, labels, or list order

### Requirement: macOS Upcoming Widget Rank
The macOS widget SHALL use the same authoritative Upcoming rank as the web list before truncating its projection.

#### Scenario: Render more than ten Upcoming rows
- **WHEN** Upcoming contains ordinary tasks and recurrence prototypes sharing controlling dates
- **THEN** the widget displays the first ten rows in controlling-date and Upcoming-rank order

### Requirement: Global quick entry presents a compact stable editor
The macOS Tasks companion SHALL present Global Quick Entry in a balanced, rounded, movable panel centered in the visible frame of the display containing the pointer, large enough for its native controls and focus outlines, SHALL visually distinguish its boundary with a one-pixel lighter dark-gray border and restrained native shadow, and SHALL never expose web loading, stale web content, or a blank web failure state.

#### Scenario: Open global quick entry on a multi-display Mac
- **WHEN** the user invokes Global Quick Entry while the pointer is on any attached display
- **THEN** the complete native editor appears immediately and is centered within that display's visible frame

#### Scenario: Finish global quick entry
- **WHEN** the user saves or cancels Global Quick Entry after invoking it from another application
- **THEN** the overlay closes and macOS restores the application that was active before the overlay opened

### Requirement: Global quick entry commits explicitly and cancels cleanly
The macOS Tasks companion SHALL provide a filled primary Save action and an always-available outlined Cancel action, SHALL treat Save and Command+Return as positive quick-entry submission, and SHALL treat Escape, Cancel, panel dismissal, or a second global-shortcut invocation as cancellation whenever no nested control owns Escape.

#### Scenario: Save quick entry
- **WHEN** the user activates Save or Command+Return with a valid Summary and valid field values
- **THEN** Tasks submits one idempotent native creation request, closes the complete panel after acceptance, and does not fade its inner content separately

#### Scenario: Preserve draft during an ambiguous save
- **WHEN** the native creation request fails or has an ambiguous outcome
- **THEN** Tasks keeps the complete draft visible, reuses its mutation identity on retry, and does not create a second task

#### Scenario: Toggle quick entry closed
- **WHEN** the global quick-entry shortcut is invoked while its panel is open
- **THEN** Tasks immediately hides the complete panel and discards the local draft without a server mutation

#### Scenario: Cancel ready quick entry
- **WHEN** the user activates Cancel or presses Escape while no nested picker owns Escape
- **THEN** Tasks immediately hides the complete panel, discards the local draft, and does not retain a committed task

#### Scenario: Dismiss a nested editor surface
- **WHEN** the user presses Escape while a native date picker, selection menu, or reminder menu is open
- **THEN** Tasks closes only that nested surface and preserves the panel and draft

#### Scenario: Keep Cancel available
- **WHEN** the editor is visible with an empty, valid, invalid, pending, or partially completed draft
- **THEN** Cancel remains enabled while Save reflects the shared task validity and pending-operation rules

### Requirement: Native Quick Entry uses bounded owner authority
The macOS companion SHALL use an expiring credential limited to Quick Entry bootstrap and creation, bound to the authenticated owner and native installation, and stored in the sandbox-aware macOS data-protection Keychain outside widget-shared files.

#### Scenario: Persist native Quick Entry authority across a compatible rebuild
- **WHEN** a consistently identified and signed Tasks build replaces an earlier build
- **THEN** the replacement reads its bounded credential through the application-scoped data-protection Keychain without presenting a legacy per-item access prompt

### Requirement: Global Quick Entry retains drafts for interior clicks
The macOS Global Quick Entry panel SHALL treat its complete visible content area as an interior surface and SHALL cancel a draft only through an explicit cancellation command or an actual panel-dismissal action.

#### Scenario: Click unused space inside Quick Entry
- **WHEN** the user clicks the background inside the visible Quick Entry panel outside an editor control
- **THEN** the panel remains open, the draft remains intact, and the click may only remove focus from the previously focused control

#### Scenario: Dismiss a nested Quick Entry popover
- **WHEN** the user clicks elsewhere inside Quick Entry while an editor-owned picker or menu is open
- **THEN** the nested surface may close while the Quick Entry panel and draft remain open

### Requirement: Reliable macOS Native Reminder Notifications
The macOS companion SHALL register for APNs after operating-system notification authorization is enabled, SHALL retain bounded local scheduling as a fallback, and SHALL receive server-driven native reminders without requiring the app to remain open.

#### Scenario: Register macOS remote notifications
- **WHEN** macOS notification authorization is enabled and the app receives an application device token
- **THEN** the trusted Tasks bridge registers that token for the authenticated owner and current installation

#### Scenario: Receive while suspended
- **WHEN** the server delivers a valid owner-scoped reminder while the app is suspended
- **THEN** macOS presents the Reminder alert and sound with the task Summary

#### Scenario: Avoid an in-app duplicate
- **WHEN** macOS notification authorization is enabled
- **THEN** the embedded Tasks surface does not claim the in-app toast fallback for that surface

#### Scenario: Keep local projection as fallback
- **WHEN** the embedded Tasks surface has a future canonical reminder projection
- **THEN** the companion may reconcile local requests using the same app-owned identity without independently computing task dates or recurrence

#### Scenario: Edit enabled notification permission
- **WHEN** native notifications are already enabled and the user activates `Edit` from `Notifications & Badges`
- **THEN** the companion opens the operating system notification settings for Tasks

### Requirement: Native Tasks list widget families

The macOS companion SHALL offer the Tasks list widget in medium, large, and extra-large system families, SHALL preserve the same list selection and task interactions in every family, and SHALL use a family-specific visible-task limit.

#### Scenario: Select a shorter widget
- **WHEN** the user adds the medium Tasks list widget
- **THEN** the widget shows the established header and interactions with no more than four task rows

#### Scenario: Select a taller widget
- **WHEN** the user adds the extra-large Tasks list widget
- **THEN** the widget shows the established header and interactions with no more than sixteen task rows

#### Scenario: Widget needs the app
- **WHEN** no authenticated widget snapshot is available
- **THEN** the body centers the task icon and the message `Open Tasks` between the header divider and the widget bottom

### Requirement: Long-running native Tasks sessions

The macOS companion SHALL keep the embedded Tasks runtime connected without repeatedly issuing state-neutral planning transactions or high-frequency empty queue reads throughout an idle long-running session.

#### Scenario: Native app remains open all day
- **WHEN** the native Tasks window remains open without pending uploads
- **THEN** the shared runtime uses date-change-only planning activation and idle queue polling

#### Scenario: Native app resumes after midnight
- **WHEN** the native app becomes active after the planning date has advanced
- **THEN** the shared runtime immediately checks and activates the new planning date
