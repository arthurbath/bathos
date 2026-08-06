## ADDED Requirements

### Requirement: Quick Entry clients share a versioned semantic contract
The Tasks module SHALL define one versioned Quick Entry contract for field identity, order, grouping, labels, defaults, enumerated values, validation limits, normalization, and allowed Tasks Control commands, and every shipped web or native Quick Entry client MUST prove conformance to that contract.

#### Scenario: Change shared task creation behavior
- **WHEN** a developer changes a contracted Quick Entry field, order, default, validation rule, enumerated value, or allowed metadata shortcut
- **THEN** automated validation fails until the web implementation, generated native contract, and server payload authority agree on the new contract version

#### Scenario: Preserve platform-specific controls
- **WHEN** web and macOS render the same contracted field with platform-native components
- **THEN** both clients preserve the contracted semantics and muscle-memory behavior even if their platform-specific visual geometry differs

#### Scenario: Traverse the native form
- **WHEN** the user presses Tab or Shift+Tab in native Quick Entry
- **THEN** focus follows the contracted field order, includes every disclosed editable control and action exactly once, and skips unavailable controls

#### Scenario: Invoke a native metadata command
- **WHEN** the user presses a contracted Tasks Control command in native Quick Entry
- **THEN** Swift dispatches the same semantic field focus, disclosure, clearing, or value-cycling behavior as web Quick Entry without synthesizing a JavaScript keyboard event

#### Scenario: Suppress an ambiguous task command
- **WHEN** the user invokes completion, task navigation, capture, selection, history, or view-navigation commands in native Quick Entry
- **THEN** the overlay performs no task or list mutation and preserves the draft

### Requirement: Native Quick Entry retains a complete local draft
The Tasks module SHALL let native Quick Entry draft Summary, Notes, Link, checklist items, Start, Deadline, Area, Actionability, Today horizon, and reminder data without creating a task before explicit submission.

#### Scenario: Draft a checklist before Summary
- **WHEN** the user adds and edits checklist items before entering a valid Summary
- **THEN** the native editor retains the ordered checklist locally, keeps Save unavailable, and creates no temporary task or orphaned checklist item

#### Scenario: Cancel a populated draft
- **WHEN** the user cancels a draft containing any combination of metadata or checklist items
- **THEN** Tasks discards the local values without issuing a task deletion or other cleanup mutation

#### Scenario: Normalize abandoned optional fields
- **WHEN** the user commits an empty Notes, Link, reminder, or checklist item field
- **THEN** the editor applies the ordinary task-creation normalization and disclosure behavior defined by the shared contract

### Requirement: Native Quick Entry creates complete tasks atomically
The Tasks service SHALL accept one bounded versioned native Quick Entry payload and SHALL validate and create the task, ordered checklist, and reminder as one owner-scoped idempotent transaction.

#### Scenario: Create a complete task
- **WHEN** a valid credential submits a compatible payload with Summary and any supported optional metadata
- **THEN** the service creates exactly one ordinary task with `native` provenance plus its ordered checklist and reminder, and returns an accepted receipt

#### Scenario: Retry after an ambiguous response
- **WHEN** the client retries an identical payload with the same client mutation and operation identifiers
- **THEN** the service returns the original task receipt and does not duplicate the task, checklist items, reminder, or history event

#### Scenario: Reject invalid ownership or structure
- **WHEN** the credential is invalid, expired, or bound to another owner, the Area is not owner-owned, or any payload field violates the shared contract
- **THEN** the service creates nothing and returns a bounded rejection code without exposing owner data

#### Scenario: Apply ordinary planning invariants
- **WHEN** a native draft selects Start, Someday, a Today horizon, Deadline, or reminder values
- **THEN** the service applies the same mutually exclusive placement, date, reminder, and normalization rules as ordinary web task creation
