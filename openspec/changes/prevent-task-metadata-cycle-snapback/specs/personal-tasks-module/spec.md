## ADDED Requirements

### Requirement: Stable Optimistic Metadata Feedback
The Tasks module SHALL keep the newest accepted local task revision continuously rendered while local and synchronized task projections converge, and SHALL allow a newer authoritative revision to replace it.

#### Scenario: Older synchronized metadata follows an accepted horizon change
- **WHEN** a keyboard command successfully changes a task's Today horizon and the watched task query subsequently emits an older revision
- **THEN** the newly selected horizon remains continuously visible without flashing back to the prior horizon

#### Scenario: Older synchronized metadata follows an accepted Area or Actionability change
- **WHEN** a keyboard command successfully changes a task's Area or Actionability and the watched task query subsequently emits an older revision
- **THEN** the newly selected value remains continuously visible without flashing back to the prior value

#### Scenario: Newer authoritative metadata arrives
- **WHEN** the watched task query emits a revision newer than the accepted local task revision
- **THEN** the Tasks module renders the newer authoritative metadata
