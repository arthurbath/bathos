## ADDED Requirements

### Requirement: Cache-Preserving macOS Companion Upgrade
The repository SHALL provide a guarded macOS installation path that upgrades the verified Tasks application without deleting or replacing its durable WebKit task-data container.

#### Scenario: Verify a staged Mac application
- **WHEN** a developer prepares a Tasks build for installation
- **THEN** the guarded installer verifies the app, nested extensions, bundle identifiers, entitlements, and compatible signatures before changing the installed application

#### Scenario: Record the stopped application's task cache
- **WHEN** an existing Tasks installation has a PowerSync database and the app is not running
- **THEN** the installer records the database namespace, size, and cryptographic fingerprint before replacing only the application bundle

#### Scenario: Preserve the cache across upgrade
- **WHEN** the verified replacement application has been installed
- **THEN** the installer requires the same task-cache namespace, size, and fingerprint before reporting success or relaunching Tasks

#### Scenario: Refuse an unsafe Mac installation
- **WHEN** the staged app is invalid, Tasks remains running, or cache continuity cannot be established
- **THEN** the installer stops without deleting the application container, clearing WebKit data, or claiming a successful cache-preserving upgrade

#### Scenario: Install without an existing cache
- **WHEN** no prior Tasks application data container or PowerSync database exists
- **THEN** the installer records that this is a cacheless installation, installs the verified app, and does not represent that state as preservation of an existing cache
