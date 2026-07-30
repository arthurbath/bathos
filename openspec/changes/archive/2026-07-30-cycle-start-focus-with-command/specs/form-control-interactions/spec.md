## ADDED Requirements

### Requirement: Cross-Month Date Arrow Navigation Reveals the Focused Month
Shared BathOS date pickers SHALL change their visible month whenever arrow navigation moves keyboard focus to a legal date belonging to an adjacent month.

#### Scenario: Arrow into a previous month
- **WHEN** keyboard focus is on a calendar date and an arrow key moves focus to a legal date in the previous month
- **THEN** the date picker displays that previous month and places keyboard focus on the navigated date without committing it

#### Scenario: Arrow into a future month
- **WHEN** keyboard focus is on a calendar date and an arrow key moves focus to a legal date in the following month
- **THEN** the date picker displays that following month and places keyboard focus on the navigated date without committing it

#### Scenario: Preserve legal-date restrictions
- **WHEN** an arrow direction does not expose a legal adjacent-month date
- **THEN** the date picker preserves its existing disabled-date and internal-control navigation behavior
