## ADDED Requirements

### Requirement: Data-Preserving iOS Companion Upgrade
The repository SHALL provide a guarded iOS installation path that upgrades the verified Tasks application in place and proves that the installed application's durable data-container identity is unchanged.

#### Scenario: Verify a staged iOS application
- **WHEN** a developer prepares a Tasks iOS build for device installation
- **THEN** the guarded installer verifies the signed app and expected bundle identifier before invoking device installation

#### Scenario: Record an existing iOS data container
- **WHEN** the target device already has Tasks installed
- **THEN** the installer records the installed bundle and stable data-container identity before performing an in-place upgrade

#### Scenario: Preserve the iOS data container
- **WHEN** the in-place installation completes
- **THEN** the installer verifies that Tasks remains installed under the expected bundle identifier and that its data-container identity matches the pre-install value

#### Scenario: Refuse an unverifiable iOS upgrade
- **WHEN** the installed-app query cannot expose a stable data-container identity or the identity changes after installation
- **THEN** the installer reports failure and does not claim that the PowerSync cache was preserved

#### Scenario: Avoid uninstall-driven cache loss
- **WHEN** the guarded iOS installation path runs
- **THEN** it never invokes application uninstall or deletion before installing the replacement build

#### Scenario: Install on a device without Tasks
- **WHEN** Tasks is not already installed on the target device
- **THEN** the installer reports a new installation, installs the verified app, and does not represent that state as preservation of an existing cache
