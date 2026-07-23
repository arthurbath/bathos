# Shared Date Picker Indicators Specification

## Purpose

Define the current-period indicators that every BathOS date picker inherits from the shared Calendar while preserving selection, eligibility, and accessibility semantics.

## Requirements

### Requirement: Shared Current-Period Star Indicators
Every BathOS date picker that uses the shared Calendar SHALL identify the resolved current day and current month with Lucide's `Star` icon while preserving independent selection styling and complete accessible names.

#### Scenario: Mark the current day in its own month
- **WHEN** the resolved current date is visible in the day calendar for the month to which that date belongs
- **THEN** the date control shows a Star icon in place of its numeric day label, retains its complete accessible date name, and exposes the current-date semantic

#### Scenario: Keep an outside current date numeric
- **WHEN** the resolved current date appears only as an outside-day cell in an adjacent displayed month
- **THEN** the outside-day cell retains its numeric label and does not show the current-date Star icon

#### Scenario: Mark the current month
- **WHEN** the month picker displays the year containing the resolved current date
- **THEN** exactly one Star icon appears immediately to the right of the current month name and the month button retains its complete accessible month-and-year name

#### Scenario: Omit the current-month star in another year
- **WHEN** the month picker displays a year other than the year containing the resolved current date
- **THEN** no month shows the current-month Star icon

#### Scenario: Preserve selected-value styling
- **WHEN** the current day or current month is also the selected value
- **THEN** the Star icon and the existing subtle selected-value highlight appear together without changing selection semantics

#### Scenario: Apply the convention to Tasks date pickers
- **WHEN** a user opens either Start or Deadline in BathOS Tasks
- **THEN** its shared day and month views use the same current-period Star convention without Tasks-specific icon rendering
