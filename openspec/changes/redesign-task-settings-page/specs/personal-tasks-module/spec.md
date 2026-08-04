## MODIFIED Requirements

### Requirement: Config-Owned Task Maintenance
The system SHALL present ordinary Tasks settings on a dedicated Config route using the established BathOS headed-card pattern, SHALL expose only user-relevant synchronization state, and SHALL keep debug and recovery infrastructure out of the ordinary frontend.

#### Scenario: Open Tasks Config
- **WHEN** a user follows the Config destination
- **THEN** `/tasks/config` renders inside the existing Tasks runtime and orders Features first, Areas second, Sync Status third, followed by the existing installed-app Account card when applicable
- **AND** every Tasks settings group uses a plain headed BathOS card without a decorative heading icon

#### Scenario: Present feature settings
- **WHEN** Tasks Config renders
- **THEN** Features presents Notifications first and Automatically Sort Anytime and Someday second
- **AND** each feature row shows a bold title, a concise second-line description, and its control aligned opposite the copy

#### Scenario: Manage browser notifications
- **WHEN** Tasks runs in an ordinary browser that can request notification permission
- **THEN** Notifications exposes a user-initiated Enable action until the browser subscription is active and an enabled toggle after activation
- **AND** blocked, unsupported, disconnected, expired, or degraded states remain usable and explain the bounded action or configuration needed without exposing provider diagnostics

#### Scenario: Withhold unfinished native notifications
- **WHEN** Tasks Config runs inside a native companion before native notification delivery is implemented
- **THEN** Notifications does not expose a browser notification toggle as though it controlled native operating-system notifications
- **AND** the interface may identify native notifications as unavailable or forthcoming without changing notification authorization

#### Scenario: Configure automatic list sorting
- **WHEN** a user views Automatically Sort Anytime and Someday
- **THEN** the option explains that Tasks sorts within Areas by Deadline, Today horizon, and Actionability while preserving manual order among equal peers
- **AND** its toggle is aligned to the right of the option copy

#### Scenario: Open keyboard commands from a point-and-click device
- **WHEN** Tasks Config renders on a point-and-click device
- **THEN** Features ends with a Keyboard Shortcuts row whose description identifies the platform shortcut as `⌘/` on Mac or `⌃/` on Windows for viewing all keyboard commands at any time
- **AND** a right-aligned Show button opens the existing dialog titled Keyboard Shortcuts

#### Scenario: Show only relevant keyboard shortcuts
- **WHEN** the Keyboard Shortcuts dialog opens
- **THEN** every section lists each action with only the shortcut for the current platform
- **AND** the other platform's shortcut column and the redundant Action and platform column-heading row are absent
- **AND** the Tasks-specific Actions heading uses lowercase `specific` after the hyphen

#### Scenario: Withhold keyboard shortcuts from touch devices
- **WHEN** Tasks Config renders on a touch device
- **THEN** the Keyboard Shortcuts feature row is not shown

#### Scenario: Inspect synchronization status
- **WHEN** a user opens Tasks Config
- **THEN** Sync Status directly shows Health, Pending Changes, and Last Successful Sync without requiring another dialog
- **AND** Last Successful Sync uses the local display form `2026 Aug 3, 5:55 PM` when a value exists

#### Scenario: Keep debug synchronization detail out of Config
- **WHEN** a user views Sync Status
- **THEN** connection internals, offline-launch state, transfer directions, full-sync state, reliability events, conflict receipts, and an open-details action are not shown
- **AND** diagnostic infrastructure may continue recording bounded evidence outside the ordinary UI

#### Scenario: Remove frontend data portability
- **WHEN** a user views Tasks Config
- **THEN** no Backup and Restore card, trigger, or modal is available
- **AND** existing backend portability and recovery services remain unchanged
