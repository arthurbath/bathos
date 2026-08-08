# Restricted Module Access

## ADDED Requirements

### Requirement: Restricted modules require an entitlement

BathOS SHALL allow a signed-in user to access a restricted module only when the user is an administrator or has an explicit access grant for that module.

#### Scenario: Ordinary user without a grant

- **WHEN** a non-admin user without a grant loads the launcher or navigates directly to a restricted module
- **THEN** the module is absent from the launcher and the direct route does not reveal the module

#### Scenario: Explicitly granted user

- **WHEN** a non-admin user has an explicit grant for a restricted module
- **THEN** the module is available and its launcher card shows a purple Restricted Access badge

#### Scenario: Administrator

- **WHEN** an administrator uses BathOS
- **THEN** every restricted module is available without a separate manual grant

### Requirement: Administration manages restrictions and grants

The Administration module SHALL allow an administrator to mark ordinary modules restricted or unrestricted and to grant or revoke a user's explicit access to a restricted module. Administration itself SHALL remain administrator-only and SHALL NOT be grantable as an ordinary restricted module.

#### Scenario: Restrict a module

- **WHEN** an administrator marks a module restricted
- **THEN** current administrators retain access and non-admin users require explicit grants

#### Scenario: Grant and revoke access

- **WHEN** an administrator grants or revokes a user's module access
- **THEN** the user's effective access changes without altering the user's account or module data

### Requirement: Tasks synchronization honors module access

Tasks SHALL be restricted by default. Its database policies and PowerSync download stream SHALL require the same module entitlement so an unauthorized user cannot obtain Tasks data by bypassing the launcher.

#### Scenario: Tasks access revoked

- **WHEN** a non-admin user's Tasks grant is revoked
- **THEN** direct Tasks table access is denied and PowerSync no longer retains that user's Tasks rows locally

#### Scenario: Existing administrator migration

- **WHEN** the restricted-module migration is applied
- **THEN** existing administrators retain Tasks access and no existing Tasks content is rewritten
