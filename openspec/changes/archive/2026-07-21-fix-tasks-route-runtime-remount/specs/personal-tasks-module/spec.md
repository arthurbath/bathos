## ADDED Requirements

### Requirement: Stable Tasks Route Runtime
The system SHALL preserve one authenticated Tasks runtime and synchronization session while navigating among supported routes inside the Tasks module.

#### Scenario: Navigate between planning views
- **WHEN** a user follows a plain in-app link from one supported Tasks planning view to another
- **THEN** the URL and rendered view change without closing or recreating the Tasks local database, synchronization connector, reliability observer, or reminder polling lifecycle

#### Scenario: Navigate to hierarchy details
- **WHEN** a user opens a project or area detail from the Tasks hierarchy
- **THEN** the registered detail route renders inside the existing Tasks runtime and preserves real-link browser behavior

#### Scenario: Reject an unknown Tasks route
- **WHEN** navigation reaches a path under `/tasks/...` that is not a registered static, project-detail, or area-detail route
- **THEN** the application renders its normal not-found boundary and does not silently render a default Tasks view

#### Scenario: Leave the Tasks module
- **WHEN** a user navigates from Tasks to another BathOS module or signs out
- **THEN** the Tasks runtime may close its owner-bound local database and synchronization session according to the existing cleanup contract
