## MODIFIED Requirements

### Requirement: Semantic mapping
The migration SHALL map supported Things meaning into native BathOS fields without embedding Things provenance or relationship metadata.

#### Scenario: Map planning
- **WHEN** a source task is Anytime, Someday, Today, or future-starting
- **THEN** the target is respectively horizon-free Anytime, Someday, Today Inbox, or future Start with no Today horizon

#### Scenario: Reconcile a snapshot across local midnight
- **WHEN** a private source snapshot contains a Start that has been reached or elapsed by the approved replacement date
- **THEN** the target enters Today Inbox with no persisted past Start

#### Scenario: Map actionability tags
- **WHEN** a source task has exact tag `⏳`, exact tag `🔄`, or neither tag
- **THEN** its target actionability is respectively Waiting, Rechecking, or Ready

#### Scenario: Preserve personal content
- **WHEN** a source task has a title, leading emoji, notes, supported link, deadline, reminder, area, native checklist, or meaningful manual order
- **THEN** the target preserves that supported value in the corresponding native field

#### Scenario: Preserve native checklist meaning
- **WHEN** an approved source task has native Things checklist rows
- **THEN** the target preserves each nonempty title verbatim, source order, checked state, and completion time under the exact deterministic task target

#### Scenario: Preserve recurrence checklist structure
- **WHEN** an approved live recurrence has native checklist rows
- **THEN** its current adopted task receives the current occurrence state and its native template snapshot receives unchecked checklist blueprints for future occurrences

#### Scenario: Reject an ambiguous checklist repair
- **WHEN** deterministic task identity and exact title do not both agree, an expected target already has unexpected checklist content, or a source checklist row has an unsupported state
- **THEN** reconciliation stops without mutating Tasks

#### Scenario: Exclude unrepresentable nested checklist rows
- **WHEN** a native checklist belongs to a former Things project-child task that was intentionally collapsed into a BathOS checklist item
- **THEN** the migration reports the bounded exclusion and does not flatten or discard the row silently

#### Scenario: Preserve extensible manual order
- **WHEN** source tasks, Areas, or checklist items are assigned deterministic target order
- **THEN** every generated key is valid for the shared fractional-indexing algorithm so ordinary post-cutover creation and reordering can append or insert records

#### Scenario: Omit Things metadata
- **WHEN** a target task is generated
- **THEN** it contains no Things ID, relationship description, tag label, heading, source-kind marker, provenance note, or other unstructured migration metadata
