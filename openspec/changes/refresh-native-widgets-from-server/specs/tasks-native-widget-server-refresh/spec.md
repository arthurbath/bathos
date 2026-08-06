## ADDED Requirements

### Requirement: Native widget push registrations are owner scoped
The system SHALL register a WidgetKit push token only through a valid, unexpired, owner-and-installation-bound Tasks widget credential and SHALL store registrations outside the public data surface.

#### Scenario: Register a current widget token
- **WHEN** a supported native widget submits its token, platform, allowlisted topic, and APNs environment with a valid widget credential
- **THEN** the system binds the registration to that credential's owner and installation without exposing other registrations

#### Scenario: Reject untrusted registration
- **WHEN** a caller uses an invalid credential, unsupported platform, unapproved topic, invalid environment, or malformed token
- **THEN** the system rejects the request without creating or changing a registration

#### Scenario: Remove an unused widget token
- **WHEN** WidgetKit reports no configured widgets for a previously registered token
- **THEN** the native extension disables that registration through the same bounded authority

### Requirement: Relevant task changes enqueue coalesced widget invalidations
The system SHALL enqueue owner-scoped widget invalidations when authoritative data affecting a native widget projection changes and SHALL coalesce repeated changes without losing a newer change that arrives during dispatch.

#### Scenario: Change widget-visible task data
- **WHEN** an owned task, recurrence projection, or widget-visible task preference is inserted, updated, or deleted
- **THEN** the owner's pending widget generation advances once or is coalesced with other pending changes

#### Scenario: Change data during delivery
- **WHEN** another relevant mutation occurs while an earlier generation is claimed for dispatch
- **THEN** acknowledging the earlier generation leaves the newer generation queued

### Requirement: Widget update dispatch is private and content free
The system SHALL allow only the service dispatcher to claim queued updates and SHALL send APNs WidgetKit notifications containing no task content, owner identifier, credential, or private metadata.

#### Scenario: Dispatch an owner invalidation
- **WHEN** the authenticated dispatcher claims a due owner generation with active registrations
- **THEN** it sends the canonical WidgetKit content-changed payload to each valid token with the allowlisted widget topic

#### Scenario: Retire an invalid APNs token
- **WHEN** APNs reports that a token is invalid, unregistered, or does not belong to the declared widget topic
- **THEN** the dispatcher disables that registration without blocking valid registrations for the same owner

#### Scenario: Retry a transient dispatch failure
- **WHEN** APNs or the network returns a retryable failure for any active registration
- **THEN** the dispatcher releases the generation with bounded backoff rather than discarding it

### Requirement: Push refresh preserves timeline fallback
The system SHALL treat server-triggered WidgetKit updates as opportunistic accelerators and SHALL retain scheduled snapshot retrieval and last-valid cache fallback.

#### Scenario: Widget push is delivered
- **WHEN** WidgetKit accepts a content-changed push and requests a new timeline
- **THEN** the widget fetches the ordinary bounded authoritative snapshot and atomically caches a valid response

#### Scenario: Push is unavailable or suppressed
- **WHEN** the widget has no push registration, is offline, or WidgetKit suppresses a notification
- **THEN** later system-budgeted timelines continue refreshing the widget through the existing snapshot path
