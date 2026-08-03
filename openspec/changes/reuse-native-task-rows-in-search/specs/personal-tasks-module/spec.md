## ADDED Requirements

### Requirement: Full Search Native Row Parity
The full Tasks Search page SHALL present each matching task through the same canonical row and per-record interaction contract as the natural list where that task lives, while remaining a non-orderable, single-record navigation surface.

#### Scenario: Present an Anytime result
- **WHEN** Search returns an ordinary task whose natural planning route is Anytime
- **THEN** the result uses the canonical Anytime row presentation, metadata visibility, checkbox state, Primary Link treatment, and lifecycle-appropriate ellipsis actions

#### Scenario: Present an Upcoming result
- **WHEN** Search returns an ordinary task whose natural planning route is Upcoming
- **THEN** the result uses the canonical Upcoming ordinary-task row presentation and per-record actions

#### Scenario: Present a Someday result
- **WHEN** Search returns an ordinary task whose natural planning route is Someday
- **THEN** the result uses the canonical Someday row presentation, including the dashed open checkbox and the same metadata and per-record actions as Someday

#### Scenario: Present a Done result
- **WHEN** Search returns a completed, canceled, or deleted task whose natural route is Done
- **THEN** the result uses the canonical Done row presentation, terminal-state symbol, metadata, reopen action, and permanent-deletion action available for that state

#### Scenario: Present a recurrence prototype
- **WHEN** Search returns an active recurrence definition
- **THEN** the result uses the canonical dated or waiting Upcoming recurrence-prototype row, metadata, repeat symbol, and the same lifecycle-appropriate ellipsis actions available in Upcoming

#### Scenario: Inherit future native-row changes
- **WHEN** a canonical task or recurrence row changes its visual metadata or per-record ellipsis actions
- **THEN** a Search result rendered for the same natural list context receives that behavior without a separate search-only presentation contract

#### Scenario: Exclude list ordering
- **WHEN** a user presses or drags a Search result
- **THEN** Tasks does not expose a drag handle, reorder the Search collection, or persist task order from Search

#### Scenario: Exclude bulk selection
- **WHEN** a user interacts with one or more Search results using pointer or keyboard input
- **THEN** Tasks does not enter selection mode or expose bulk-selection controls for the Search collection

#### Scenario: Keep drawers out of Search
- **WHEN** a user clicks the main row of an ordinary Search result
- **THEN** Tasks navigates through its real natural-list link and opens the stable task record in that list instead of opening a metadata drawer on Search
- **AND** activating the result's checkbox, Primary Link, or ellipsis controls performs only that control's canonical action without triggering row navigation

#### Scenario: Enter results from the query
- **WHEN** the Search query input has focus and at least one result exists and the user presses Down
- **THEN** keyboard focus moves to the first canonical result row without changing task data

#### Scenario: Traverse and leave results
- **WHEN** a Search result has keyboard focus and the user presses Up or Down
- **THEN** focus moves to the adjacent result, and Up from the first result returns focus to the query input

#### Scenario: Activate a regular result
- **WHEN** an ordinary Search result has keyboard focus and the user presses Return
- **THEN** Tasks navigates through the result's real natural-list link, opens the stable task record there, and reveals it using the established search-destination behavior

#### Scenario: Activate a recurrence result
- **WHEN** a recurrence-prototype Search result has keyboard focus and the user presses Return
- **THEN** Tasks navigates to Upcoming, reveals and focuses that prototype, and keeps repeat management closed

#### Scenario: Ignore Tasks Control commands
- **WHEN** the full Search page is active and the user invokes a Tasks Control-key command that would act on a list or task
- **THEN** Tasks does not execute that command against any Search result
