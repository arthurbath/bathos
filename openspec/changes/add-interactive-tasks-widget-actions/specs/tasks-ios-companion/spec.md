## MODIFIED Requirements

### Requirement: Owner-Scoped Native Projection
The Tasks web application SHALL provide the native companion with one versioned, bounded, owner-scoped projection for every supported widget list while withholding general authentication material and detailed private task content.

#### Scenario: Publish an authenticated projection
- **WHEN** an authenticated companion session has loaded or changed its local synchronized Tasks data
- **THEN** the web module publishes Today, Upcoming, Anytime, Someday, and Done projections through the native bridge

#### Scenario: Bound projected content
- **WHEN** a supported list contains more tasks than the native cache limit
- **THEN** the projection includes the total count, includes only the bounded leading rows in authoritative list order, and marks the list as truncated

#### Scenario: Project an actionable Primary Link
- **WHEN** a projected task has a nonblank Primary Link that normalizes to a supported HTTP, HTTPS, or Mail-message URL
- **THEN** the row includes only the normalized href and its Mail-or-link kind needed for direct activation

#### Scenario: Withhold sensitive fields
- **WHEN** the web module creates a native projection
- **THEN** it omits notes, checklist text, Mail source metadata, reminder delivery credentials, Supabase access and refresh tokens, PowerSync credentials, native completion credentials, and every non-Tasks record

#### Scenario: Ignore an ordinary browser
- **WHEN** Tasks runs outside the native companion and no approved bridge exists
- **THEN** projection and credential publication perform no native call and do not change normal web behavior

#### Scenario: Preserve the installed read-only widget during rollout
- **WHEN** the web module detects the approved native bridge without a schema-version-2 installation identity
- **THEN** it continues publishing schema-version-1 snapshots and clear messages without Primary Links or a completion credential

#### Scenario: Reject an untrusted bridge message
- **WHEN** a message comes from a subframe, an untrusted origin, an unsupported schema version, or an oversized or malformed payload
- **THEN** the native host rejects it without changing the last accepted cache or native credential

#### Scenario: Change signed-in owners
- **WHEN** the native host receives a valid projection for an owner different from the cached owner
- **THEN** it atomically replaces the complete prior cache before reloading widget timelines

#### Scenario: Sign out
- **WHEN** the authenticated web session signs out
- **THEN** the web module asks the native host to clear cached task projections and the narrow native completion credential, the host attempts credential revocation without retaining prior-owner content, and the widgets stop showing the prior owner's tasks

### Requirement: Bounded Native Expansion
The iOS companion SHALL preserve extension points for later Apple-platform surfaces while permitting only explicitly specified native behavior.

#### Scenario: Evaluate an Apple Watch count complication
- **WHEN** lived use shows that a watch task count has recurring value
- **THEN** a later change can reuse the versioned list projection while separately specifying watchOS installation, refresh, privacy, and interaction behavior

#### Scenario: Limit the interactive widget action
- **WHEN** the widget receives native completion authority
- **THEN** that authority can only complete an owned present open task and cannot read, create, edit, delete, reopen, plan, search, or otherwise mutate Tasks data

#### Scenario: Avoid speculative native features
- **WHEN** no observed workflow yet requires additional widget families, native notifications, general App Intents, native task editing, or an Apple Watch complication
- **THEN** the companion omits those features and remains a web host plus bounded widget surface

## ADDED Requirements

### Requirement: Interactive Native Widget Completion
The Tasks widget SHALL let the user complete a visible open task from its checkbox without launching the containing app and SHALL apply the result through the authoritative Tasks lifecycle.

#### Scenario: Complete a visible widget task
- **WHEN** the user taps the completion control for a present open task while the server is reachable and the native credential is valid
- **THEN** the server accepts one idempotent completion, records ordinary task history and recurrence effects, and synchronizes the completed state to other clients

#### Scenario: Acknowledge and remove a completed task
- **WHEN** authoritative widget completion succeeds
- **THEN** the tapped control optimistically shows its completed state, the widget keeps that acknowledgement visible for approximately two seconds after authoritative acceptance, removes the task from active cached lists with a system-supported animation, reconciles it into Done, and reloads the Tasks widget timeline

#### Scenario: Revert an unconfirmed optimistic acknowledgement
- **WHEN** the completion request cannot be confirmed
- **THEN** the widget leaves the cached task in place and returns its completion control to the ordinary unchecked appearance without claiming completion

#### Scenario: Invoke one-way completion for either delivered Toggle value
- **WHEN** WidgetKit invokes an open task's completion intent with either the pre-tap or post-tap Boolean value
- **THEN** the intent treats the invocation as the same one-way request to complete that open task

#### Scenario: Retry one transient completion failure
- **WHEN** the first completion attempt has a transient transport failure or retryable HTTP response
- **THEN** the extension retries once with the same operation and mutation identifiers before retaining the task as open

#### Scenario: Retry the same completion
- **WHEN** the extension repeats a completion request with the same idempotency identifier after an ambiguous response
- **THEN** the server returns the original accepted outcome without adding another lifecycle or history transition

#### Scenario: Complete an already completed task
- **WHEN** a distinct valid request targets a task that is already completed
- **THEN** the endpoint returns a safe no-op completion outcome and the widget may reconcile the row without appending duplicate history

#### Scenario: Fail without connectivity or authority
- **WHEN** the completion request cannot reach the server or its credential is missing, expired, revoked, malformed, or bound to another owner
- **THEN** the app does not open, the cached task remains visible, and the widget does not claim completion

#### Scenario: Protect terminal rows
- **WHEN** a widget row represents completed, canceled, or deleted work
- **THEN** it shows its terminal symbol without exposing the interactive completion control

### Requirement: Direct Native Widget Primary Links
The Tasks widget SHALL expose a separate direct Primary Link action for a visible task without changing the task-summary deep link or completion control.

#### Scenario: Open a web Primary Link
- **WHEN** a widget task has a validated HTTP or HTTPS Primary Link and the user taps its trailing link icon
- **THEN** the operating system opens that URL in the configured browser without first opening BathOS Tasks

#### Scenario: Open a Mail Primary Link
- **WHEN** a widget task has a validated `message://` Primary Link and the user taps its trailing Mail icon
- **THEN** the operating system routes the URL to the application registered for that protocol without first opening BathOS Tasks

#### Scenario: Open the task independently
- **WHEN** the user taps the task summary rather than its checkbox or Primary Link icon
- **THEN** the companion opens the existing allowlisted task deep link and performs no completion or external-link action

#### Scenario: Omit an absent or unsafe Primary Link
- **WHEN** the task has no Primary Link or its value cannot normalize to an approved absolute URL
- **THEN** the widget omits the trailing action and does not expose an unusable or unsupported link

#### Scenario: Preserve widget privacy treatment
- **WHEN** iOS redacts sensitive widget content
- **THEN** the task summary and Primary Link action participate in the system privacy treatment without revealing the href as visible text

### Requirement: Native Widget List Presentation
The Tasks widget SHALL present the four active planning lists with compact, top-aligned, neutral native rendering that follows the canonical Tasks iconography.

#### Scenario: Offer supported widget lists
- **WHEN** the user configures a Tasks list widget
- **THEN** the available choices are Today, Upcoming, Anytime, and Someday, with Done omitted

#### Scenario: Render canonical list identity
- **WHEN** a widget renders a supported list
- **THEN** its title uses a neutral native rendering of the canonical Lucide concept for that list: Star for Today, CalendarRange for Upcoming, ListTodo for Anytime, and SquareDashed for Someday

#### Scenario: Keep short lists at the top
- **WHEN** a widget list does not fill the available vertical space
- **THEN** its header and task rows remain aligned to the top rather than being vertically centered

#### Scenario: Keep active completion controls neutral
- **WHEN** a widget renders an open task
- **THEN** its unchecked square uses the ordinary neutral gray treatment without inheriting Today horizon colors

#### Scenario: Omit an extraneous header count
- **WHEN** a widget renders its list header
- **THEN** it shows the canonical icon and list name without a task-count badge or number

### Requirement: Native Completion Credential Boundary
The system SHALL provision, store, rotate, revoke, and validate a purpose-built native credential whose sole authority is completing an owned present open task.

#### Scenario: Provision after authenticated companion use
- **WHEN** a trusted native companion session proves the current Supabase user and supplies its stable installation identifier
- **THEN** the server rotates one owner-and-installation-bound credential, stores only its cryptographic hash, and returns the raw credential once for protected native storage

#### Scenario: Keep the credential out of projections
- **WHEN** the web module publishes task data or the widget renders a timeline
- **THEN** the completion credential is absent from the task snapshot, visible UI, logs, browser persistence, PowerSync, and source control

#### Scenario: Revoke native authority
- **WHEN** the user signs out, the owner changes, or the credential is explicitly revoked
- **THEN** the local credential is removed immediately and future server requests using the revoked credential are rejected

#### Scenario: Preserve the replication boundary
- **WHEN** native widget credentials are stored centrally
- **THEN** their records remain outside the public PowerSync publication and the approved publication remains exactly 20 Tasks tables

### Requirement: Widget Deep-Link Runtime Continuity
The companion SHALL open widget deep links without creating overlapping local Tasks database runtimes and SHALL turn an unexpected startup stall into a recoverable state.

#### Scenario: Route through loaded companion content
- **WHEN** a widget deep link arrives after the companion has loaded Tasks content
- **THEN** the companion performs same-document route navigation without reloading the web document or reconstructing the PowerSync database

#### Scenario: Ignore a canceled replacement navigation
- **WHEN** WebKit reports a canceled navigation because another requested navigation replaced it
- **THEN** the companion does not treat the cancellation as a cold-start failure and does not start recovery

#### Scenario: Bound local runtime initialization
- **WHEN** opening the local Tasks database does not finish within the bounded startup window
- **THEN** Tasks replaces the central spinner with a recoverable error and offers Retry through a fresh database instance
