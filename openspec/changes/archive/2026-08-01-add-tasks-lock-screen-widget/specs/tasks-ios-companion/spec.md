## ADDED Requirements

### Requirement: Configurable Lock Screen Task List Widget
The companion SHALL provide an accessory rectangular Lock Screen widget that lets the user choose one supported active task list, renders up to three leading cached task summaries, and opens the configured list in the native Tasks app.

#### Scenario: Add or edit the Lock Screen widget
- **WHEN** the user configures the Tasks accessory rectangular widget
- **THEN** the available list choices are Today, Upcoming, Anytime, and Someday

#### Scenario: Render three or more tasks
- **WHEN** the configured list has three or more cached tasks
- **THEN** the Lock Screen widget shows the first three summaries in authoritative list order with compact neutral task indicators
- **AND** each summary uses the native default system typeface at 13 points and regular weight, matching the Calendar Lock Screen event-title treatment
- **AND** the three rows use slight vertical separation and are vertically centered together inside the widget
- **AND** their row height and separation match the populated one- and two-task states so corresponding task lines occupy approximately the same vertical positions

#### Scenario: Render fewer than three tasks
- **WHEN** the configured list has one or two cached tasks
- **THEN** the Lock Screen widget shows only those tasks without inventing rows or vertically centering the content away from the top

#### Scenario: Render an empty list
- **WHEN** the configured list has a current projection with zero tasks
- **THEN** the Lock Screen widget shows a sentence-case empty state without a count or sample task

#### Scenario: Render without a projection
- **WHEN** no valid owner-scoped cache exists
- **THEN** the Lock Screen widget prompts the user to open Tasks and does not expose sample or prior-owner task content

#### Scenario: Open the configured list
- **WHEN** the user taps anywhere on the Lock Screen widget
- **THEN** the native companion opens the web route for the widget's configured list

#### Scenario: Respect Lock Screen privacy
- **WHEN** iOS redacts sensitive Lock Screen widget content
- **THEN** every task summary participates in system privacy redaction

#### Scenario: Preserve the large Home Screen widget
- **WHEN** the same widget kind renders in the large Home Screen family
- **THEN** it retains its existing header, list presentation, completion controls, task deep links, and Primary Link actions
