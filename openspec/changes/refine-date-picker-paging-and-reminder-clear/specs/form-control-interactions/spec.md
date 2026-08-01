## ADDED Requirements

### Requirement: Calendar-scoped modified-arrow paging
Shared BathOS calendars SHALL page backward with Shift+Left and forward with Shift+Right only while keyboard focus is on a calendar date or month value, or on a calendar previous/next paging control.

#### Scenario: Page a day calendar from a date
- **WHEN** focus is on a calendar date and the user presses Shift+Left or Shift+Right with no other modifier
- **THEN** the calendar pages one legal month in the corresponding direction without committing a date
- **AND** focus remains within the day calendar

#### Scenario: Page a month calendar from a month
- **WHEN** focus is on a month value and the user presses Shift+Left or Shift+Right with no other modifier
- **THEN** the month picker pages one legal year in the corresponding direction without committing a month
- **AND** focus remains within the month picker

#### Scenario: Page from a calendar pager
- **WHEN** focus is on a previous or next month or year paging control and the user presses Shift+Left or Shift+Right with no other modifier
- **THEN** the calendar pages in the chord's corresponding direction when that page contains selectable values
- **AND** focus remains on the corresponding paging control when it remains available

#### Scenario: Preserve modified arrows in text entry
- **WHEN** focus is inside a text-entry subcontrol composed into a date picker and the user presses Shift+Left or Shift+Right
- **THEN** the calendar does not page or prevent the text control's native modified-arrow behavior

#### Scenario: Respect calendar bounds
- **WHEN** the user invokes the paging chord toward a page that contains no legal values
- **THEN** the calendar remains on its current page and preserves keyboard focus
