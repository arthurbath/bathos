## ADDED Requirements

### Requirement: Control Center Today Inbox Capture
The Tasks companion SHALL provide one nonconfigurable system control on supported iOS versions that opens the authoritative Tasks editor with a new Today Inbox task draft without mutating task data inside the widget extension.

#### Scenario: Discover the control
- **WHEN** the user browses Tasks controls on a supported iOS version
- **THEN** the system offers a `New Task` control with the native square-plus symbol treatment

#### Scenario: Start a task from Control Center
- **WHEN** the user activates the New Task control
- **THEN** iOS opens the Tasks companion to the Today list, opens the existing new-task editor, assigns the draft to Inbox, and focuses Summary

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
