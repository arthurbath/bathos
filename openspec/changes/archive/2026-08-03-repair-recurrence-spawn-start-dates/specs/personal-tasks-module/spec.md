## ADDED Requirements

### Requirement: Recurrence Generated-Date Authority
Tasks SHALL derive every generated recurrence instance's Start and Deadline from the accepted recurrence revision that produced the logical occurrence. Prototype snapshot scheduling offsets MUST NOT override, erase, or otherwise change those generated dates.

#### Scenario: Generate an instance with an earlier Start
- **WHEN** a recurrence revision assigns a Deadline cadence date and specifies a nonnegative number of days earlier for Start
- **THEN** the generated instance persists the cadence date as its Deadline and the cadence date minus that revision offset as its Start

#### Scenario: Ignore a stale snapshot Start offset
- **WHEN** a recurrence revision specifies a generated Start offset that differs from the offset retained in its prototype snapshot
- **THEN** preview, activation, and generated instance persistence all use the recurrence revision's offset

#### Scenario: Ignore a missing snapshot Start offset
- **WHEN** a recurrence revision specifies a generated Start offset but its prototype snapshot contains no Start offset
- **THEN** the generated instance still receives the Start derived from the recurrence revision

#### Scenario: Generate an instance without a Deadline rule
- **WHEN** a recurrence revision has no generated Deadline offset
- **THEN** the generated instance persists the cadence date as its Start and has no Deadline regardless of legacy snapshot scheduling fields

#### Scenario: Preserve existing generated instances
- **WHEN** the recurrence generated-date authority is repaired
- **THEN** already generated ordinary task instances retain their current Start, Deadline, and other editable metadata
