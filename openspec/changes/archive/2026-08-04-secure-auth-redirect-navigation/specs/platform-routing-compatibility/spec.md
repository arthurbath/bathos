## MODIFIED Requirements

### Requirement: Shared browser routing compatibility
The BathOS platform SHALL use a patched supported browser-router release whose default transition scheduling and relative-splat behavior applies consistently at the shared browser-router boundary.

#### Scenario: Application runtime starts
- **WHEN** the BathOS browser application mounts its shared router
- **THEN** the installed supported router behavior is active for every platform and module route
- **AND** the router emits no warning requesting obsolete compatibility opt-ins

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

## ADDED Requirements

### Requirement: Authentication redirects remain within BathOS
BathOS SHALL accept a post-authentication `next` destination only when it resolves to a root-relative path on the current BathOS origin. The same validation SHALL apply when switching between sign-in and sign-up routes.

#### Scenario: Valid internal destination
- **WHEN** authentication receives a `next` value containing a root-relative BathOS path with an optional query string or fragment
- **THEN** BathOS preserves the normalized internal destination through tab switching and successful authentication

#### Scenario: Valid OAuth consent destination
- **WHEN** authentication receives a `next` value for the internal `/.lovable/oauth/consent` route
- **THEN** BathOS preserves that route and its query string as the post-authentication destination

#### Scenario: External or ambiguous destination
- **WHEN** authentication receives a protocol-relative path, backslash-based path, encoded separator payload, absolute URL, non-path scheme, or destination that resolves to another origin
- **THEN** BathOS discards the value and navigates to the launcher after authentication
- **AND** BathOS does not preserve the unsafe value when switching authentication tabs
