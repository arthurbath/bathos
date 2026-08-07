# tasks-watch-companion Specification

## Purpose
TBD - created by archiving change add-tasks-watch-capture-and-progress. Update Purpose after archive.
## Requirements
### Requirement: Canonical Lucide Complication Mark
The Tasks watch complication SHALL use the canonical Lucide checkmark geometry as the center mark of the Today progress ring.

#### Scenario: Render Today progress
- **WHEN** watchOS renders the Today progress complication at any supported progress fraction
- **THEN** the ring retains its existing progress meaning and contains the canonical Lucide checkmark rather than a platform-symbol substitute

#### Scenario: Apply complication rendering mode
- **WHEN** watchOS renders the complication in its active monochrome or accented mode
- **THEN** the custom checkmark accepts the platform tint without losing its Lucide geometry

### Requirement: Narrow Watch Task Capture
The Tasks watchOS companion SHALL let the signed-in companion owner create one open present task in Today Inbox from the system watch text-entry experience without exposing general task-management authority.

#### Scenario: Begin capture
- **WHEN** the user activates the watch app's plus control
- **THEN** watchOS presents its available system text-entry methods, including dictation, Scribble, or keyboard as supported by the device

#### Scenario: Submit a task
- **WHEN** the user finishes entry with a nonblank summary
- **THEN** Tasks creates one open present Anytime task whose explicit Start is the owner's current planning date, whose Today horizon is Inbox, and whose entry and mutation channel identify the native watch

#### Scenario: Cancel capture
- **WHEN** the user cancels system text entry or submits only whitespace
- **THEN** Tasks creates no task and returns to the plus control

#### Scenario: Retry a submitted request
- **WHEN** the same watch capture is delivered more than once with the same client mutation identifier
- **THEN** the server returns the original accepted result without creating a duplicate task

#### Scenario: Lack watch authority
- **WHEN** no valid owner credential has reached the watch from its paired iPhone
- **THEN** the watch creates no task and presents a bounded instruction to open the signed-in Tasks app on iPhone

### Requirement: Today Completion Complication
The Tasks watchOS companion SHALL provide one circular WidgetKit complication that visualizes completion progress for non-deleted tasks explicitly started on the owner's current planning date.

#### Scenario: Calculate Today progress
- **WHEN** the server calculates complication progress
- **THEN** the denominator contains every present task whose Start equals the owner's planning date regardless of open, completed, or canceled lifecycle, and the numerator contains only the completed subset
- **AND** deleted tasks and tasks without that explicit Start date are excluded

#### Scenario: Render nonempty progress
- **WHEN** the denominator is greater than zero
- **THEN** the complication renders the completion fraction as a circular progress ring with a simple checkmark in its center

#### Scenario: Render zero tasks
- **WHEN** no eligible task has Start equal to the planning date
- **THEN** the complication renders an empty progress ring with the same center checkmark rather than inventing progress

#### Scenario: Activate the complication
- **WHEN** the user taps the complication
- **THEN** watchOS opens the Tasks watch app at its plus control

### Requirement: Watch Progress Freshness
The watch app and complication SHALL preserve the last valid owner-scoped progress, refresh it when the watch app becomes active, and request later complication timelines within WidgetKit's system-controlled budget.

#### Scenario: Open the watch app
- **WHEN** the watch app becomes active with valid authority
- **THEN** it requests current Today progress, atomically caches a valid response, and asks WidgetKit to reload the complication timeline

#### Scenario: Receive a timeline request
- **WHEN** WidgetKit asks the complication provider for a timeline
- **THEN** the provider renders cached progress immediately, attempts one bounded current-progress request when authority is valid, and requests a conservative later refresh

#### Scenario: Fail a refresh
- **WHEN** the watch is offline, the credential is unavailable or rejected, or the response is invalid
- **THEN** the complication preserves the last valid cached progress and exposes no task content or cross-owner data

### Requirement: Reproducible Watch Build
The repository SHALL contain dependency-free watchOS app and WidgetKit targets with stable identifiers derived from `garden.bath.tasks`, automatic-signing compatibility, and the Apple Watch variant of the shared Tasks Apple native icon.

#### Scenario: Build without signing
- **WHEN** CI or a development Mac builds the watch targets for a generic watchOS Simulator with code signing disabled
- **THEN** the watch app, complication extension, shared models, and companion connectivity code compile using installed Apple SDKs without downloading third-party packages

#### Scenario: Configure private signing
- **WHEN** an eligible Apple Development team uses automatic signing
- **THEN** the iOS app embeds the watch app, the watch app embeds its WidgetKit extension, and the paired installation recognizes them as one companion family

#### Scenario: Show the watch icon
- **WHEN** watchOS presents the Tasks app in a round small-icon context
- **THEN** the app uses the Apple Watch rendering supplied by the shared Tasks Apple native Icon Composer asset
- **AND** the progress complication continues to use a simple checkmark in the center of its circular ring
