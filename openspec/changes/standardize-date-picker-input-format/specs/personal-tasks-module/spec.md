## ADDED Requirements

### Requirement: Task date-picker inputs standardize explicit dates
Tasks start-date and deadline picker inputs SHALL display explicit calendar dates in the year-first `YYYY Mon D` format while preserving established semantic labels that communicate relative or special start states.

#### Scenario: Display an explicit Task date
- **WHEN** a Task start-date or deadline picker input displays the explicit calendar date 2026-08-07 outside its relative-label window
- **THEN** the input displays `2026 Aug 7`

#### Scenario: Preserve relative Task date labels
- **WHEN** the selected Task control date is yesterday, today, or tomorrow relative to the planning date
- **THEN** the input respectively displays Yesterday, Today, or Tomorrow

#### Scenario: Preserve special start states
- **WHEN** a Task start-date picker represents a semantic state such as Someday or a Today horizon
- **THEN** the input preserves that established semantic label instead of formatting it as an explicit calendar date
