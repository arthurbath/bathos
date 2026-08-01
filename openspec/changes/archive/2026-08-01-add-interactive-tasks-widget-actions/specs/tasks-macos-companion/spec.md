## ADDED Requirements

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
