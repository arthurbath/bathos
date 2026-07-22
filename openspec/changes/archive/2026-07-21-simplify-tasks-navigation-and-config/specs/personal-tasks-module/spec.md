## ADDED Requirements

### Requirement: Concise Tasks Navigation
The system SHALL prioritize daily planning through four primary Tasks destinations and one More destination while keeping every supported secondary view discoverable and addressable through a real route.

#### Scenario: Render primary desktop navigation
- **WHEN** an authenticated user opens Tasks at a desktop or tablet width
- **THEN** the persistent navigation presents Inbox, Today, Upcoming, Anytime, and More without clipping, overlap, horizontal page overflow, or a second navigation row

#### Scenario: Limit mobile navigation
- **WHEN** an authenticated user opens Tasks below the desktop breakpoint
- **THEN** the persistent mobile navigation presents exactly five destinations: Inbox, Today, Upcoming, Anytime, and More

#### Scenario: Open a secondary destination
- **WHEN** the user opens More
- **THEN** the menu presents Someday, Projects, Templates, Logbook, Trash, and Config with Lucide icons and a clear active state for the current secondary destination

#### Scenario: Preserve real-link behavior
- **WHEN** a user activates a primary or secondary destination with an ordinary left click
- **THEN** Tasks performs in-runtime SPA navigation, while browser-modified activation retains the anchor's default new-tab behavior

#### Scenario: Navigate secondary views by keyboard
- **WHEN** a keyboard user opens More and moves through its destinations
- **THEN** every destination receives visible focus, exposes a nonempty programmatic name, and can be activated without a pointer

### Requirement: Config-Owned Task Maintenance
The system SHALL keep infrequent Tasks settings, capability state, diagnostics, and recovery controls on a dedicated Config route instead of persistent daily-planning chrome.

#### Scenario: Open Tasks Config
- **WHEN** a user follows the Config destination
- **THEN** `/tasks/config` renders inside the existing Tasks runtime and presents Browser Reminders, Synchronization, and Backup and Restore sections

#### Scenario: Keep daily views concise
- **WHEN** a user opens Inbox, Today, Upcoming, Anytime, Someday, Projects, Templates, Logbook, or Trash
- **THEN** the page does not persistently render browser-reminder capability, synchronization diagnostics, backup/restore, or duplicate Projects and Templates shortcuts

#### Scenario: Preserve actionable reminder failures
- **WHEN** the current client cannot claim or project due reminder work
- **THEN** the daily task surface retains its existing content-free failure and retry behavior even though browser-reminder capability is managed on Config

#### Scenario: Manage browser reminders
- **WHEN** a user opens Browser Reminders on Config
- **THEN** the interface reports the current capability and exposes only the safe enable or disable action available under the existing reminder contract

#### Scenario: Inspect synchronization
- **WHEN** a user opens Synchronization Details from Config
- **THEN** the existing connection, offline-launch, health, full-sync, queue, activity, reliability-event, and conflict-receipt evidence remains available

#### Scenario: Manage data portability
- **WHEN** a user opens Backup and Restore from Config
- **THEN** the existing verified export, merge, replacement, and safety behavior remains available without a persistent module-header control

### Requirement: Concise Task View Presentation
The system SHALL use the active view's name, compact self-evident controls, and progressive disclosure so routine task browsing is not dominated by setup or explanatory UI.

#### Scenario: Name the active view
- **WHEN** any supported Tasks route renders
- **THEN** the primary page heading identifies that route as Inbox, Today, Upcoming, Anytime, Someday, Projects, Project, Area, Templates, Logbook, Trash, or Config at every viewport

#### Scenario: Create an area progressively
- **WHEN** a user activates Add Area from Projects
- **THEN** a title-only BathOS form dialog requests the required area title, disables Save til the title is nonblank, supports Enter submission and complete keyboard traversal, and restores focus to Add Area after close

#### Scenario: Create a project progressively
- **WHEN** a user activates Add Project from Projects
- **THEN** a title-only BathOS form dialog requests the required project title and optional area, disables Save til the title is nonblank, supports Enter submission and complete keyboard traversal, and restores focus to Add Project after close

#### Scenario: Browse projects without setup clutter
- **WHEN** the Projects view is not creating an area or project
- **THEN** it shows compact icon-only Add Area and Add Project controls with nonempty programmatic names and does not render permanent creation fields
