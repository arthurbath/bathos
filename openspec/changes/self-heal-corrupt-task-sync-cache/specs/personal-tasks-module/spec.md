## MODIFIED Requirements

### Requirement: Actionable Synchronization Diagnostics
The system SHALL expose trustworthy synchronization state without logging task content, including first-full-sync completion, durable queue depth, last successful synchronization, upload and download activity or errors, confirmed bounded degradation and recovery episodes, conflict receipts, and safe corrupt-cache recovery outcomes.

#### Scenario: Inspect synchronization details
- **WHEN** a user opens the visible task synchronization status
- **THEN** the interface reports connection mode, first-full-sync completion, durable pending-change count, last successful synchronization, upload and download activity or failure independently, recent content-free confirmed degradation and recovery episodes, and recent content-free conflict receipts

#### Scenario: Withhold a premature synchronized claim
- **WHEN** a connected Tasks installation has not completed its first full synchronization
- **THEN** the interface reports that synchronization is preparing and does not label the installation `Synced`

#### Scenario: Report a healthy synchronized installation
- **WHEN** the client is connected, has completed a full synchronization, has no transfer error, has no active transfer, and has no pending upload
- **THEN** the interface labels the installation `Synced`

#### Scenario: Upload path fails while the client is otherwise active
- **WHEN** the task upload API is unavailable but the application and synchronization stream remain active and the upload failure survives the confirmation interval
- **THEN** the client retains the queued mutation, reports the upload failure separately from its general connection state, and opens one content-free upload-error episode using the time the failure was first observed

#### Scenario: Persist another confirmed degradation
- **WHEN** the connected Tasks runtime reports a download error or an offline state that survives the confirmation interval
- **THEN** the installation opens at most one content-free episode for that degradation category using the time the failure was first observed, without storing a raw error, owner identifier, record identifier, task content, or source metadata

#### Scenario: Ignore a transient synchronization blip
- **WHEN** an upload error, download error, or offline state clears or changes before the confirmation interval ends
- **THEN** the interface reflects the current live state immediately but does not persist a degradation or recovery episode for the transient state

#### Scenario: Report persistent production degradation once
- **WHEN** one confirmed upload-error, download-error, or offline episode remains active for at least 2 minutes from its first observation in the production Tasks runtime
- **THEN** the client sends Sentry one fixed content-free warning with allowlisted category and bounded state tags and records that the episode was reported

#### Scenario: Recover synchronization
- **WHEN** a confirmed explicit degradation clears or changes category
- **THEN** the client closes the prior episode with a resolution time, retains it in bounded local history, and does not report that episode again

#### Scenario: Reload during an active episode
- **WHEN** Tasks reloads while a content-free confirmed degradation episode remains open
- **THEN** the runtime resumes the same episode and its remaining report delay instead of creating or reporting a duplicate

#### Scenario: Inspect local-only storage
- **WHEN** the module has no approved synchronization endpoint
- **THEN** synchronization details identify the installation as local-only, create no remote-degradation episode, and explicitly withhold any implication of cross-device or MCP convergence

#### Scenario: Recover a confirmed corrupt disposable cache
- **WHEN** PowerSync reports a recognized SQLite corruption failure and the durable upload queue is readable and empty
- **THEN** Tasks advances to a fresh installation-local database namespace, preserves the damaged namespace, performs at most one automatic rotation in the current recovery cycle, and records a content-free recovery outcome

#### Scenario: Preserve local intent when corrupt-cache safety is unknown
- **WHEN** PowerSync reports a recognized SQLite corruption failure but the durable upload queue is nonempty or cannot be read
- **THEN** Tasks does not clear, overwrite, or abandon the current database namespace and presents the recoverable error state for manual intervention

### Requirement: Online startup conceals stale cached task rows
Tasks SHALL distinguish locally available task rows from task rows that have been refreshed by the authoritative service during the current online launch. While an online connected launch awaits its first current-session completed sync, or while a confirmed corrupt cache is being replaced, Tasks SHALL show the centered loading indicator instead of revealing the locally cached list.

#### Scenario: Initial cacheless fetch
- **WHEN** a task-list query has no locally available rows and is still fetching
- **THEN** Tasks SHALL show the task loading indicator
- **AND** Tasks SHALL NOT show a no-tasks empty-state message

#### Scenario: Online launch has cached rows
- **WHEN** locally cached task rows are available during an online launch but PowerSync has not completed a sync in the current runtime session
- **THEN** Tasks SHALL show the centered task loading indicator
- **AND** Tasks SHALL NOT reveal the cached rows before current-session freshness is established

#### Scenario: Current-session sync completes
- **WHEN** the authoritative service completes the first sync of the current online runtime session
- **THEN** Tasks SHALL reveal the newly reconciled task list
- **AND** subsequent same-view background refreshes SHALL leave the currently rendered rows visible

#### Scenario: App launches offline
- **WHEN** Tasks launches without browser network connectivity and a locally cached projection is available
- **THEN** Tasks SHALL render the cached rows immediately as its offline fallback

#### Scenario: Online freshness cannot be established promptly
- **WHEN** a non-corruption download failure occurs or the bounded startup freshness wait expires before a current-session sync completes
- **THEN** Tasks SHALL release the loading gate and render the locally available projection
- **AND** existing synchronization diagnostics SHALL continue to communicate the degraded connection state

#### Scenario: Corrupt cached rows remain concealed during safe recovery
- **WHEN** an online client detects a confirmed corrupt cache and proves that its durable upload queue is empty
- **THEN** Tasks SHALL conceal the damaged projection while rotating the local database namespace
- **AND** Tasks SHALL reveal task rows only after the replacement database completes an authoritative current-session sync

#### Scenario: Settled empty list
- **WHEN** the startup freshness gate is released and the watched query has no rows and is no longer loading or fetching
- **THEN** Tasks SHALL show the applicable empty-state message
