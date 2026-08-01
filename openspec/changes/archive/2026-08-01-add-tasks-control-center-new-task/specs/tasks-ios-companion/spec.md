## ADDED Requirements

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
