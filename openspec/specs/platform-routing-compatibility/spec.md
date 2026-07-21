# Platform Routing Compatibility

## Purpose

Define the compatibility and route-preservation contract for the shared BathOS browser router.

## Requirements

### Requirement: Shared browser routing compatibility
The BathOS platform SHALL explicitly enable the installed router's supported v7 transition-scheduling and relative-splat compatibility behaviors at the shared browser-router boundary.

#### Scenario: Application runtime starts
- **WHEN** the BathOS browser application mounts its shared router
- **THEN** both supported compatibility behaviors are active for every platform and module route
- **AND** the router emits no warning requesting either compatibility opt-in

### Requirement: Existing route outcomes are preserved
Enabling router compatibility behavior SHALL preserve the existing absolute route declarations and their destinations across the platform and every registered module family.

#### Scenario: Platform route resolves
- **WHEN** a user opens a registered platform route such as the launcher, account, authentication, help, or terms route
- **THEN** the route resolves to the same platform surface as before the compatibility opt-in

#### Scenario: Module route resolves
- **WHEN** a user opens a registered Budget, Drawers, Garage, Snake, Wardrobe, or Tasks route
- **THEN** the route resolves to the same module surface as before the compatibility opt-in

#### Scenario: Redirect route resolves
- **WHEN** a user opens a registered module-root or legacy redirect route
- **THEN** the router preserves the existing destination and replacement behavior

#### Scenario: Unknown route resolves
- **WHEN** a user opens a path that does not match a registered platform, module, or redirect route
- **THEN** the terminal not-found behavior remains unchanged
