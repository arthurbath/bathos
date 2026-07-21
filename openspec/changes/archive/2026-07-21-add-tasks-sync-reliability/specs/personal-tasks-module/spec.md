## MODIFIED Requirements

### Requirement: Actionable Synchronization Diagnostics
The system SHALL expose trustworthy synchronization state without logging task content, including first-full-sync completion, durable queue depth, last successful synchronization, upload and download activity or errors, bounded degradation and recovery episodes, and conflict receipts.

#### Scenario: Inspect synchronization details
- **WHEN** a user opens the visible task synchronization status
- **THEN** the interface reports connection mode, first-full-sync completion, durable pending-change count, last successful synchronization, upload and download activity or failure independently, recent content-free degradation and recovery episodes, and recent content-free conflict receipts

#### Scenario: Withhold a premature synchronized claim
- **WHEN** a connected Tasks installation has not completed its first full synchronization
- **THEN** the interface reports that synchronization is preparing and does not label the installation `Synced`

#### Scenario: Report a healthy synchronized installation
- **WHEN** the client is connected, has completed a full synchronization, has no transfer error, has no active transfer, and has no pending upload
- **THEN** the interface labels the installation `Synced`

#### Scenario: Upload path fails while the client is otherwise active
- **WHEN** the task upload API is unavailable but the application and synchronization stream remain active
- **THEN** the client retains the queued mutation, reports the upload failure separately from its general connection state, and opens one content-free upload-error episode

#### Scenario: Persist another explicit degradation
- **WHEN** the connected Tasks runtime reports a download error or an offline state
- **THEN** the installation opens at most one content-free episode for that degradation category without storing a raw error, owner identifier, record identifier, task content, or source metadata

#### Scenario: Report persistent production degradation once
- **WHEN** one upload-error, download-error, or offline episode remains active for at least 2 minutes in the production Tasks runtime
- **THEN** the client sends Sentry one fixed content-free warning with allowlisted category and bounded state tags and records that the episode was reported

#### Scenario: Recover synchronization
- **WHEN** the explicit degradation clears or changes category
- **THEN** the client closes the prior episode with a resolution time, retains it in bounded local history, and does not report that episode again

#### Scenario: Reload during an active episode
- **WHEN** Tasks reloads while a content-free degradation episode remains open
- **THEN** the runtime resumes the same episode and its remaining report delay instead of creating or reporting a duplicate

#### Scenario: Inspect local-only storage
- **WHEN** the module has no approved synchronization endpoint
- **THEN** synchronization details identify the installation as local-only, create no remote-degradation episode, and explicitly withhold any implication of cross-device or MCP convergence
