## MODIFIED Requirements

### Requirement: Existing route outcomes are preserved
Router compatibility behavior SHALL preserve registered platform and module destinations while allowing explicit replacement redirects for retired module routes.

#### Scenario: Platform route resolves
- **WHEN** a user opens a registered launcher, account, authentication, help, or terms route
- **THEN** the route resolves to the same platform surface as before

#### Scenario: Module route resolves
- **WHEN** a user opens a registered Budget, Drawers, Garage, Snake, Wardrobe, or current Tasks route
- **THEN** the route resolves to its registered module surface

#### Scenario: Retired Tasks route resolves
- **WHEN** a user opens `/tasks/inbox`, `/tasks/logbook`, or `/tasks/trash`
- **THEN** the router replaces it with `/tasks/today` or `/tasks/done` without rendering a retired surface or adding a browser-history entry

#### Scenario: Module root resolves
- **WHEN** a user opens the neutral `/tasks` route
- **THEN** the router replaces it with `/tasks/today`

#### Scenario: Unknown route resolves
- **WHEN** a user opens a path that does not match a registered platform, module, or redirect route
- **THEN** terminal not-found behavior remains unchanged
