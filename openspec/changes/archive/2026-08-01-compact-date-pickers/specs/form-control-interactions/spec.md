## ADDED Requirements

### Requirement: Compact shared calendar geometry
Shared BathOS day calendars SHALL use a vertically compact, fixed six-week grid while preserving the established calendar width, seven-column layout, and all date-picker interaction behavior.

#### Scenario: Render compact date cells
- **WHEN** any shared BathOS date picker displays its day calendar
- **THEN** each date occupies a 32px-high visual cell within the existing fixed-width seven-column grid
- **AND** the six week rows use tighter vertical spacing than the prior ordinary-button layout

#### Scenario: Align weekday and date geometry
- **WHEN** a shared day calendar renders its weekday heading row
- **THEN** each weekday label occupies the same width and height as the date cell beneath it
- **AND** the heading row retains the established Monday-first order

#### Scenario: Distinguish unavailable dates
- **WHEN** a date shown in the current six-week calendar view is disabled
- **THEN** that date is rendered in italics whether it belongs to the displayed, previous, or next month
- **AND** an adjacent-month date that remains selectable is not italicized

#### Scenario: Present a compact Clear action
- **WHEN** a shared date picker exposes a Clear action
- **THEN** the action uses the shared small-button height
- **AND** its availability and clearing behavior remain unchanged

#### Scenario: Traverse the visible day grid
- **WHEN** the compact calendar is used by pointer, touch, or keyboard
- **THEN** Left, Right, Up, and Down navigate legal dates within the visible six-week grid without changing the displayed month merely because focus enters an adjacent-month date
- **AND** Up and Down can leave the day grid through its top and bottom boundaries to reach the date picker's composed controls
- **AND** date selection and closing behavior remain unchanged

#### Scenario: Page beyond the horizontal day-grid endpoints
- **WHEN** keyboard focus is on the top-left visible date and the user presses Left
- **THEN** the calendar pages to the preceding month when that direction is legal
- **AND** focus moves to the date immediately preceding the formerly focused date
- **WHEN** keyboard focus is on the bottom-right visible date and the user presses Right
- **THEN** the calendar pages to the following month when that direction is legal
- **AND** focus moves to the date immediately following the formerly focused date

#### Scenario: Page from calendar navigation controls
- **WHEN** keyboard focus is on the previous-month control and the user presses Left, or on the next-month control and the user presses Right
- **THEN** the day calendar pages in the matching direction when allowed
- **AND** focus remains on the corresponding navigation control when it remains available
- **WHEN** keyboard focus is on the previous-year control and the user presses Left, or on the next-year control and the user presses Right
- **THEN** the month picker pages in the matching direction when allowed
- **AND** the picker never pages beyond the date field's selectable limits

#### Scenario: Distinguish committed selection from provisional focus
- **WHEN** a date is the input's committed value
- **THEN** that date uses a rounded accent-gray background without a visible selection border
- **WHEN** month-picker mode shows the month containing the committed date
- **THEN** that month uses the same rounded accent-gray background without a visible selection border
- **AND** keyboard focus contributes the existing white border and ring without replacing either selected background
- **AND** focusing an unselected value does not add a selected background

#### Scenario: Color the Today star by availability
- **WHEN** the in-month Today date is selectable
- **THEN** its replacement star remains warning yellow whether Today is unselected, selected, focused, or both selected and focused
- **WHEN** the in-month Today date is disabled
- **THEN** its replacement star uses the same muted gray treatment as disabled date numbers
- **AND** the current-month star in month-picker mode follows the same selectable-versus-disabled color rule

#### Scenario: Preserve full-strength focus and selection on adjacent-month dates
- **WHEN** a date from the preceding or following month is shown in the current six-week grid
- **THEN** its muted appearance is produced with a semantic text color rather than whole-button opacity
- **AND** the provisional white focus border and ring remain at full opacity
- **AND** a committed adjacent-month date retains the same fully opaque rounded accent-gray background used for a committed in-month date
- **AND** disabled dates use semantic muted text without dimming any focus chrome applied by the calendar

### Requirement: Rich single-select popover menu styling
BathOS rich single-select popover menus SHALL distinguish the committed value from the provisional keyboard or pointer position using independent visual treatments.

#### Scenario: Show the committed menu value
- **WHEN** a rich single-select popover menu contains a committed value
- **THEN** that item displays a Lucide checkmark in the reserved leading indicator position
- **AND** unselected items reserve the same leading space without displaying a dot or other selection glyph

#### Scenario: Show provisional menu focus
- **WHEN** keyboard or pointer navigation provisionally highlights a menu item
- **THEN** that row uses the standard light-gray highlight background
- **AND** the highlight does not add, remove, or replace the committed-value checkmark
