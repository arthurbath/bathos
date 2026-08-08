## ADDED Requirements

### Requirement: macOS Badge Authorization Compatibility
The macOS companion SHALL reconcile previously authorized notification installations that predate badge authorization while leaving explicit operating-system badge choices authoritative.

#### Scenario: Repair an authorized installation without badge capability
- **WHEN** notification authorization is enabled, the operating system does not report badge presentation as enabled, and this compatibility repair has not been attempted
- **THEN** Tasks makes one incremental authorization request for alerts, sounds, and badges
- **AND** refreshes operating-system notification settings after the request completes

#### Scenario: Respect an explicit badge disablement
- **WHEN** the operating system reports badge presentation as disabled after the compatibility repair has been attempted
- **THEN** Tasks does not request badge authorization again during ordinary refreshes
- **AND** clears the Dock badge according to the existing badge policy

#### Scenario: Avoid repeating the compatibility request
- **WHEN** the versioned badge-authorization compatibility repair has already been attempted
- **THEN** Tasks does not issue that repair request again during ordinary authorization refreshes

### Requirement: Immediate macOS Notification Settings Handoff
The macOS companion SHALL use its most recently resolved notification authorization state to avoid unnecessary delay when opening operating-system notification settings.

#### Scenario: Open Settings from a known state
- **WHEN** the user activates `Enable` or `Edit` after Tasks has resolved notification authorization as enabled or denied
- **THEN** Tasks opens the Tasks notification settings immediately without waiting for another settings query

#### Scenario: Resolve Settings action before the first status read
- **WHEN** the user activates the notification Settings action before Tasks has resolved authorization
- **THEN** Tasks queries the operating system and performs the appropriate permission or Settings action after that query completes
