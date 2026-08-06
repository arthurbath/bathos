## MODIFIED Requirements

### Requirement: Layered Reminder Delivery
The system SHALL keep the server authoritative for reminder scheduling and logical delivery identity while supporting Web Push, in-app delivery, and native Apple local-notification projection through one reminder contract. Tasks Settings SHALL report the current surface's notification capability and SHALL NOT add a separate application-level notification on/off preference; browser and operating-system notification settings remain authoritative.

#### Scenario: Schedule reminder delivery
- **WHEN** a reminder instant is accepted
- **THEN** the server creates one stable logical delivery occurrence and every active client derives delivery from that canonical instant without independently recomputing the reminder schedule

#### Scenario: Recover an in-app reminder claim automatically
- **WHEN** an open connected client cannot claim due reminder deliveries
- **THEN** the interface preserves scheduled reminders and previously claimed items, presents no task-list warning or manual retry action, and performs the next automatic claim within one minute or when the tab next becomes visible

#### Scenario: Bound a stalled in-app reminder claim
- **WHEN** a connected client's due-reminder claim does not settle within the configured request window
- **THEN** the client aborts the request, releases its in-flight guard, preserves reminder state, and remains eligible for the next automatic claim

#### Scenario: Inspect current in-app reminder availability
- **WHEN** a user opens Synchronization Details from Tasks Config
- **THEN** the interface reports In-App Reminders as Available when the latest claim did not fail and Delayed while the latest claim failure remains unresolved, without exposing provider or transport diagnostics

#### Scenario: Report a reminder acknowledgement failure
- **WHEN** a visible or notification-opened reminder cannot be acknowledged
- **THEN** the interface reports fixed content-free failure copy, preserves the reminder for retry, and does not expose the underlying provider or transport error

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
- **WHEN** an owner has multiple explicitly registered delivery targets or enabled native companions
- **THEN** each surface may receive the same logical occurrence once through its own delivery mechanism

#### Scenario: Delivery capability is unavailable
- **WHEN** notification permission is denied, platform support is missing, or a target expires
- **THEN** the task remains usable, Settings reports the current surface's degraded capability, and an open Tasks module uses the persistent in-app toast fallback

#### Scenario: Await native authorization inspection
- **WHEN** an approved native companion is still determining the operating system notification authorization status
- **THEN** the Tasks surface waits for that result before claiming an in-app fallback delivery so it does not race a native notification

#### Scenario: Inspect notification capability without an application toggle
- **WHEN** the user opens Tasks Settings on a browser or native companion
- **THEN** Notifications & Badges reports whether that surface has notifications enabled and does not present an application-owned off switch

#### Scenario: Offer a browser permission workflow
- **WHEN** browser notifications are supported but not yet enabled
- **THEN** Settings offers Enable to invoke the browser permission workflow

#### Scenario: Explain blocked browser notifications
- **WHEN** the browser cannot expose an enablement workflow because notifications are unsupported or denied in browser settings
- **THEN** Settings reports that state without presenting a nonfunctional control and in-app reminder toasts remain available while Tasks is open

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
