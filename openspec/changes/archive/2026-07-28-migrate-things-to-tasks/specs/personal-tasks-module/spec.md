## ADDED Requirements

### Requirement: Explicit Yearly Recurrence Cadence
Tasks SHALL support fixed-date, last-day-of-month, and ordinal-weekday yearly recurrence rules in both client preview and authoritative server evaluation.

#### Scenario: Repeat on a fixed yearly date
- **WHEN** a yearly recurrence specifies a month and calendar day
- **THEN** each eligible year schedules on that fixed date, clamped only when the date is not present in the year

#### Scenario: Repeat on an ordinal weekday of a month
- **WHEN** a yearly recurrence specifies an ordinal weekday and month such as the second Sunday of May
- **THEN** each eligible year schedules on the matching weekday occurrence in that month

#### Scenario: Repeat on the last day of a month
- **WHEN** a yearly recurrence specifies the last day of a fixed month
- **THEN** each eligible year schedules on that month's final calendar day

#### Scenario: Preserve yearly preview parity
- **WHEN** a yearly fixed-date or ordinal-weekday rule is previewed and later evaluated by the server
- **THEN** both paths produce the same bounded sequence of dates
