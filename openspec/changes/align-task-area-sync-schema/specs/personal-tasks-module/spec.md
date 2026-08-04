## MODIFIED Requirements

### Requirement: Offline Task Operation
The system SHALL allow core task work to continue during temporary network loss, SHALL allow a previously loaded installed Tasks web app to reopen its interface without network access, and SHALL reconcile valid local changes when connectivity returns.

#### Scenario: Create work offline
- **WHEN** the user creates a to-do while the client is offline
- **THEN** the client stores the to-do durably, displays it immediately, and queues it for synchronization

#### Scenario: Synchronize an offline hierarchy in dependency order
- **WHEN** the user creates an Area, a to-do assigned to that Area, and a checklist item before those local writes synchronize
- **THEN** the client uploads every supported row without rejected metadata or foreign-key failures and preserves the complete hierarchy after restart

#### Scenario: Complete work offline
- **WHEN** the user completes a to-do while the client is offline
- **THEN** the client retains the completion across restart and synchronizes it when connectivity returns

#### Scenario: Reconnect after multiple changes
- **WHEN** a client reconnects after local and remote task changes occurred
- **THEN** the system reconciles the changes according to the documented conflict rules and reports any state it cannot reconcile safely

#### Scenario: Preserve the durable mutation queue
- **WHEN** a client restarts while one or more mutations have not reached the server
- **THEN** the client retains the queued mutations, exposes their count, and retries them without creating duplicate logical tasks

#### Scenario: Prepare offline launch without requesting notification permission
- **WHEN** an authenticated user opens Tasks on a supported secure client with network access
- **THEN** the client idempotently registers the Tasks service worker and stages the complete public application shell without requesting notification permission, creating a push subscription, or sending a reminder-registration mutation

#### Scenario: Reopen a previously loaded Tasks PWA offline
- **WHEN** an installed Tasks web app completed one online shell stage and later launches a `/tasks/*` route during temporary network loss
- **THEN** the service worker returns one internally consistent cached shell whose versioned application assets are available, and the Tasks runtime can open its durable local database and pending mutation queue

#### Scenario: Prepare the Home Screen installation's independent storage
- **WHEN** an iPhone or iPad user adds Tasks to the Home Screen and launches that installed app online
- **THEN** Tasks uses its permanent same-origin manifest, establishes authentication and synchronization in the Home Screen app's own browsing partition, and reports offline launch as ready only after that partition contains the active complete shell

#### Scenario: Expose incomplete offline preparation without overstating readiness
- **WHEN** the current client does not yet have an active complete Tasks shell in its own Cache Storage
- **THEN** Synchronization Details reports offline launch as preparing, failed, or unavailable instead of ready, even if another browser or installation has staged the shell

#### Scenario: Preserve the previous shell after an incomplete refresh
- **WHEN** an online Tasks navigation receives new shell HTML but one required versioned application asset cannot be staged
- **THEN** the service worker leaves the prior complete shell active, removes the incomplete staging cache, and does not make the partial deployment the offline fallback

#### Scenario: Replace a CDN-cached worker release
- **WHEN** a new backward-compatible Tasks worker is published while the hosting edge still retains the prior unversioned script response
- **THEN** the client registers the new versioned worker script URL under the existing root scope so the published worker installs without creating a competing registration or push subscription

#### Scenario: Isolate offline caching from other BathOS modules and data traffic
- **WHEN** the root-scoped Tasks service worker observes another BathOS module navigation, authentication traffic, Supabase, PowerSync, MCP, reminder-provider, or other non-shell request
- **THEN** it does not intercept or cache that request and stores no task content, owner data, credential, provider secret, or API response in Cache Storage

#### Scenario: Pause remote role probes while offline
- **WHEN** the Tasks shell opens while the browser reports that network connectivity is unavailable
- **THEN** the client retains cached authorization state, makes no administrator-role network probes, labels synchronization as offline, and resumes authorization and synchronization checks when connectivity returns

#### Scenario: Back off transient role-probe failures
- **WHEN** an administrator-role probe fails while the browser still reports online
- **THEN** the client retries with bounded exponential backoff instead of issuing a fixed high-frequency request loop
