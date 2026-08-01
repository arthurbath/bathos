## MODIFIED Requirements

### Requirement: Shared Current-Period Star Indicators
Every BathOS date picker that uses the shared Calendar SHALL identify the resolved current day and current month with Lucide's `Star` icon while preserving independent selection styling, selected-state contrast, and complete accessible names.

#### Scenario: Mark the current day wherever visible
- **WHEN** the resolved current date is visible in the day calendar either in its own month or as an outside-day cell in an adjacent displayed month
- **THEN** that date control shows a Star icon in place of its numeric day label, retains its complete accessible date name, and exposes the current-date semantic

#### Scenario: Mark the current month
- **WHEN** the month picker displays the year containing the resolved current date
- **THEN** exactly one Star icon appears immediately to the right of the current month name and the month button retains its complete accessible month-and-year name

#### Scenario: Omit the current-month star in another year
- **WHEN** the month picker displays a year other than the year containing the resolved current date
- **THEN** no month shows the current-month Star icon

#### Scenario: Preserve selected-value styling
- **WHEN** the current day or current month is also the selected value
- **THEN** the Star icon and the existing subtle selected-value highlight appear together without changing selection semantics

#### Scenario: Preserve current-day eligibility styling
- **WHEN** the current day is selectable
- **THEN** its Star uses the semantic yellow current-period color regardless of selected-value or outside-month status
- **WHEN** the current day is not selectable
- **THEN** its Star uses the same solid muted text color as another disabled date without dimming its focus border

#### Scenario: Apply the convention to Tasks date pickers
- **WHEN** a user opens either Start or Deadline in BathOS Tasks
- **THEN** its shared day and month views use the same current-period Star convention without Tasks-specific icon rendering
