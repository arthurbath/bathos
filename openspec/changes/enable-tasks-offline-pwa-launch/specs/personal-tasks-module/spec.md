## MODIFIED Requirements

### Requirement: Offline Task Operation
The system SHALL allow core task work to continue during temporary network loss, SHALL allow a previously loaded installed Tasks web app to reopen its interface without network access, and SHALL reconcile valid local changes when connectivity returns.

#### Scenario: Create work offline
- **WHEN** the user creates a to-do while the client is offline
- **THEN** the client stores the to-do durably, displays it immediately, and queues it for synchronization

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

#### Scenario: Isolate offline caching from other BathOS modules and data traffic
- **WHEN** the root-scoped Tasks service worker observes another BathOS module navigation, authentication traffic, Supabase, PowerSync, MCP, reminder-provider, or other non-shell request
- **THEN** it does not intercept or cache that request and stores no task content, owner data, credential, provider secret, or API response in Cache Storage

#### Scenario: Pause remote role probes while offline
- **WHEN** the Tasks shell opens while the browser reports that network connectivity is unavailable
- **THEN** the client retains cached authorization state, makes no administrator-role network probes, labels synchronization as offline, and resumes authorization and synchronization checks when connectivity returns

#### Scenario: Back off transient role-probe failures
- **WHEN** an administrator-role probe fails while the browser still reports online
- **THEN** the client retries with bounded exponential backoff instead of issuing a fixed high-frequency request loop

### Requirement: Layered Reminder Delivery
The system SHALL keep the server authoritative for reminder scheduling and logical delivery identity while supporting Web Push, in-app delivery, and later native delivery targets through one idempotent contract.

#### Scenario: Schedule reminder delivery
- **WHEN** a reminder instant is accepted
- **THEN** the server creates one stable logical delivery occurrence and targets each registered delivery endpoint idempotently

#### Scenario: Manage a project reminder from the web
- **WHEN** a user saves or clears a reminder from an open project detail
- **THEN** the web interface uses the existing project-root reminder contract, owner planning time zone, daylight-saving ambiguity choice, connected-only mutation gate, and visible degraded-state explanation

#### Scenario: Report an in-app reminder claim failure
- **WHEN** an open connected client cannot claim due reminder deliveries
- **THEN** the interface shows a content-free degraded state, preserves scheduled reminders and any previously claimed items, and exposes a bounded explicit retry

#### Scenario: Bound a stalled in-app reminder claim
- **WHEN** a connected client's due-reminder claim does not settle within the configured request window
- **THEN** the client aborts the request, reports the content-free failure state, releases its in-flight guard, and leaves Retry available without changing reminder schedules or previously claimed items

#### Scenario: Report a reminder acknowledgement failure
- **WHEN** a visible or notification-opened reminder cannot be acknowledged
- **THEN** the interface reports fixed content-free failure copy, preserves the reminder for retry, and does not expose the underlying provider or transport error

#### Scenario: Protect schedules while the reminder projection is untrustworthy
- **WHEN** current reminder data is loading or fails to load
- **THEN** to-do and project reminder editors distinguish that state from local-only operation, disable reminder mutation, and do not treat an unknown current schedule as an empty schedule

#### Scenario: Read synchronized reminder time precision
- **WHEN** synchronization represents a canonical PostgreSQL reminder time with fractional-second precision
- **THEN** the client accepts it as the original wall-clock intent, renders the Tasks route, and does not reject the reminder projection

#### Scenario: Retry one delivery target
- **WHEN** a provider request is retried for the same occurrence and registered target
- **THEN** the system reuses the target-delivery identifier and does not create another logical delivery

#### Scenario: Open multiple browser tabs
- **WHEN** multiple tabs observe the same due reminder
- **THEN** the tabs share the logical occurrence and do not create duplicate server delivery records

#### Scenario: Deliver on multiple registered devices
- **WHEN** an owner has multiple explicitly registered delivery targets
- **THEN** each target may receive the same logical occurrence once under its own target-delivery identifier

#### Scenario: Delivery capability is unavailable
- **WHEN** notification permission is denied, platform support is missing, or a target expires
- **THEN** the task remains usable and the interface reports degraded reminder capability

#### Scenario: Register Web Push explicitly
- **WHEN** a user invokes the browser-reminder Enable action on a supported secure client and grants notification permission
- **THEN** the client reuses the Tasks service-worker registration to create one standards-based push subscription, the server stores its provider credentials outside the synchronized target projection, and repeated registration reuses the target identity

#### Scenario: Transfer one browser subscription between accounts
- **WHEN** a browser endpoint is registered by a different signed-in owner on the same installation
- **THEN** the server cancels pending delivery for the prior owner, removes the prior provider credential, marks the prior target revoked, and assigns that endpoint only to the current owner

#### Scenario: Invalidate browser delivery on sign-out
- **WHEN** a signed-in owner signs out from Tasks or another BathOS route on an installation with a browser subscription
- **THEN** the installation unsubscribes before completing sign-out, and the Tasks route also revokes the owner-scoped server target when that authenticated operation is available

#### Scenario: Inspect Web Push without implicit subscription
- **WHEN** a connected user opens Tasks before enabling browser reminders
- **THEN** the client may register or inspect the shared Tasks service worker for offline launch but does not request notification permission, create a push subscription, or register a delivery target until the user invokes Enable

#### Scenario: Keep browser reminder failures content-free
- **WHEN** browser-reminder inspection, registration, or revocation fails
- **THEN** the interface reports fixed degraded capability and operation-failure copy, does not expose the underlying provider or transport error, keeps in-app reminders available, and permits an explicit retry when safe

#### Scenario: Report delivery outcome
- **WHEN** a notification provider accepts a delivery request
- **THEN** the system records provider acceptance separately from user acknowledgement and does not claim that the user saw the reminder

#### Scenario: Fail to record a provider outcome
- **WHEN** the dispatcher cannot persist the provider-accepted or failed outcome after attempting delivery
- **THEN** the invocation reports failure with content-free diagnostics and does not report a fully successful run

#### Scenario: Reject an untrusted Web Push endpoint
- **WHEN** a claimed Web Push subscription endpoint is not an HTTPS endpoint owned by an approved browser push provider
- **THEN** the dispatcher makes no network request, records a content-free terminal failure, and revokes the target so it is not retried

#### Scenario: Prepare production Web Push configuration
- **WHEN** reminder delivery is activated in a production environment
- **THEN** the server and web build use one verified public VAPID key, the server keeps the matching private key and an independent high-entropy dispatch secret outside the repository, and the scheduled request resolves its matching header value from managed secrets without embedding it in the Cron command

#### Scenario: Acknowledge an opened notification
- **WHEN** the user opens a Web Push notification for a logical occurrence
- **THEN** the authenticated Tasks route acknowledges that occurrence and later in-app or provider claims do not create another delivery after acknowledgement

#### Scenario: Open a reminder without replacing unrelated BathOS work
- **WHEN** a user opens a Web Push notification while browser windows include another BathOS module, an existing Tasks route, or no Tasks route
- **THEN** the service worker accepts only a same-origin Tasks destination, reuses and focuses an existing Tasks client when available, otherwise opens a new Tasks window, and never navigates the unrelated BathOS module away from its current route

#### Scenario: Activate a published reminder worker promptly
- **WHEN** a backward-compatible Tasks reminder and offline-shell service worker update installs while BathOS tabs remain open
- **THEN** the worker requests immediate activation so future offline launch, push, and notification-click events use the published behavior without requiring every existing BathOS tab to close
