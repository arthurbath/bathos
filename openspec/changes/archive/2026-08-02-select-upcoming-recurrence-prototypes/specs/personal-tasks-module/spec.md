## ADDED Requirements

### Requirement: Dated recurrence prototype selection
Tasks SHALL include every dated recurrence prototype in the Upcoming list's transient row-selection model alongside ordinary tasks while retaining recurrence-owned scheduling behavior.

#### Scenario: Enter selection from a prototype
- **WHEN** selection mode is inactive and a user Command-clicks a dated prototype on Mac, Control-clicks it on Windows, or Shift-clicks it as a new selection target
- **THEN** Tasks closes any open editor, enters selection mode, selects only that prototype, establishes it as the range anchor, and does not open the prototype editor

#### Scenario: Extend a mixed range
- **WHEN** selection mode is active and a user Shift-clicks an ordinary task or dated prototype with an existing anchor
- **THEN** Tasks selects the contiguous visible range across ordinary task and prototype rows in their rendered Upcoming order

#### Scenario: Toggle a prototype in active selection
- **WHEN** selection mode is active and the user activates a prototype summary or its circular selection control
- **THEN** Tasks toggles that prototype's membership without opening its editor and applies the same zero-selection exit behavior used by ordinary task rows

#### Scenario: Present a selected prototype
- **WHEN** a dated prototype renders while selection mode is active
- **THEN** it replaces its recurrence control with the canonical circular selected or unselected control, uses the canonical selected-row highlight when selected, communicates its selection state accessibly, and hides its ellipsis action button

#### Scenario: Select all Upcoming rows
- **WHEN** selection mode is active on Upcoming and the user activates Select All
- **THEN** Tasks selects every visible eligible ordinary task and dated recurrence prototype and includes both kinds in the reported count

#### Scenario: Edit metadata shared by tasks and prototypes
- **WHEN** a selection contains one or more dated recurrence prototypes
- **THEN** Tasks keeps Edit enabled and offers Area, Actionability, and Delete while omitting Start and Deadline

#### Scenario: Apply a shared metadata edit
- **WHEN** the user chooses an Area or Actionability value for a mixed or prototype-only Upcoming selection
- **THEN** Tasks applies that value to every selected ordinary task and recurrence prototype through the appropriate guarded persistence path and keeps every still-visible row selected

#### Scenario: Delete any Upcoming selection
- **WHEN** the user chooses Delete for any non-empty Upcoming selection of ordinary tasks, recurrence instances, and dated recurrence prototypes
- **THEN** Tasks moves every selected ordinary task or recurrence instance to Done, archives every selected recurrence prototype, removes successful targets from Upcoming, and restores any target whose mutation fails

### Requirement: Mixed Upcoming group reordering
Tasks SHALL allow a selected group containing ordinary tasks and dated recurrence prototypes to reorder through the Upcoming list while preserving every prototype's recurrence-owned date.

#### Scenario: Reorder a mixed group within one day
- **WHEN** selected ordinary tasks and dated prototypes are dragged to another position in their shared Upcoming day bucket
- **THEN** Tasks assigns the group consecutive Upcoming order keys in its existing visible relative order and persists ordinary-task and prototype ordering through their respective guarded mutation paths

#### Scenario: Start a group drag from a prototype
- **WHEN** a selected dated prototype begins a native drag
- **THEN** Tasks drags the complete selected group rather than only that prototype

#### Scenario: Reject illegal prototype movement across days
- **WHEN** a selected group contains prototypes from days other than the target day and is dropped into the target day bucket
- **THEN** Tasks leaves those prototypes in their recurrence-owned buckets without changing their occurrence dates or Upcoming order keys for the target bucket

#### Scenario: Move eligible ordinary tasks during a cross-day drop
- **WHEN** a mixed selected group is dropped into another Upcoming day bucket
- **THEN** Tasks may move selected ordinary tasks through the existing cross-day planning behavior while every schedule-ineligible prototype remains in its original bucket

### Requirement: Selection lasso toggle
Tasks SHALL keep the top-right selection lasso available as a visible toggle throughout selection-capable list interaction.

#### Scenario: Show active lasso state
- **WHEN** selection mode is active
- **THEN** the lasso remains visible, exposes an accessible pressed state, and uses the established information highlight to indicate that selection mode is active

#### Scenario: Cancel selection with the lasso
- **WHEN** the user activates the lasso while selection mode is active
- **THEN** Tasks clears selection membership and its anchor and returns to ordinary list interaction
