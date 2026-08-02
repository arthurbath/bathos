## ADDED Requirements

### Requirement: Paired Watch Authority Handoff
The signed-in iOS Tasks companion SHALL transfer only the current expiring native credential and its owner identity to the paired watch, and SHALL replace or clear that handoff when native authority changes.

#### Scenario: Provision a paired watch
- **WHEN** the iOS companion accepts a valid owner-bound native credential
- **THEN** it publishes that credential, owner identifier, and expiration through the latest WatchConnectivity application context

#### Scenario: Replace the signed-in owner
- **WHEN** the iOS companion accepts valid native authority for a different owner
- **THEN** it replaces the prior watch context rather than retaining credentials for both owners

#### Scenario: Sign out
- **WHEN** Tasks clears or revokes native authority during sign-out
- **THEN** the iOS companion publishes a cleared watch context so the watch stops creating or refreshing on behalf of the prior owner

#### Scenario: Run without a paired watch
- **WHEN** WatchConnectivity is unsupported, unavailable, or has no paired installed watch app
- **THEN** the iOS Tasks app continues its existing web-host and widget behavior without error
