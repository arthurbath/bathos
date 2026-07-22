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
Router compatibility behavior SHALL preserve registered platform and module destinations while allowing explicit replacement redirects for retired module routes.

#### Scenario: Platform route resolves
- **WHEN** a user opens a registered launcher, account, authentication, help, or terms route
- **THEN** the route resolves to the same platform surface as before

#### Scenario: Module route resolves
- **WHEN** a user opens a registered Budget, Drawers, Garage, Snake, Wardrobe, or current Tasks route
- **THEN** the route resolves to its registered module surface

#### Scenario: Unknown route resolves
- **WHEN** a user opens a path that does not match a registered platform, module, or redirect route
- **THEN** terminal not-found behavior remains unchanged

#### Scenario: Retired Tasks route resolves
- **WHEN** a user opens `/tasks/inbox`, `/tasks/logbook`, or `/tasks/trash`
- **THEN** the router replaces it with `/tasks/today` or `/tasks/done` without rendering a retired surface or adding a browser-history entry

#### Scenario: Module root resolves
- **WHEN** a user opens the neutral `/tasks` route
- **THEN** the router replaces it with `/tasks/today`
