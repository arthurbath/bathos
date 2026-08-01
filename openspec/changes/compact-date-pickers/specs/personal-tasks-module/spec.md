## ADDED Requirements

### Requirement: Compact Tasks Start picker presentation
The Tasks Start picker SHALL match the shared calendar width and reduce non-calendar space through a vertical Today rail, a compact Reminder row, and small terminal action buttons without changing their semantics or traversal order.

#### Scenario: Match the shared calendar width
- **WHEN** the Tasks Start picker opens
- **THEN** its Today, calendar, Reminder, and terminal-action sections share the regular date picker's width
- **AND** the four horizon labels, Reminder content, Clear, and Someday remain fully usable without horizontal clipping

#### Scenario: Present Today beside the horizons
- **WHEN** the Tasks Start picker is open
- **THEN** the Today label appears vertically in a narrow rail to the left of Inbox, Now, Next, and Later
- **AND** all four horizon buttons remain equal-width, labeled, colored, and directly selectable

#### Scenario: Present compact Reminder and terminal actions
- **WHEN** the Tasks Start picker renders Reminder, Clear, and Someday
- **THEN** the Reminder input group and the Clear and Someday buttons use the shared small-control height
- **AND** Reminder remains full-width while Clear and Someday remain equal-width sibling actions with their existing divider

#### Scenario: Preserve Start picker behavior
- **WHEN** a user navigates or activates the compact Start picker by keyboard, pointer, or touch
- **THEN** horizon selection, date selection, reminder entry, reminder-hour selection, Clear, Someday, focus traversal, and picker closure behave exactly as before

#### Scenario: Leave the calendar vertically for Start controls
- **WHEN** keyboard focus is on a date in the first visible calendar row and the user presses Up beyond the legal day cells in that column
- **THEN** focus moves to the appropriate calendar header control without paging to another month
- **WHEN** keyboard focus is on a date in the final visible calendar row and the user presses Down
- **THEN** focus moves to the Reminder input without paging to another month

#### Scenario: Align the Deadline picker to its field
- **WHEN** the Tasks Deadline picker opens from an ordinary task editor
- **THEN** the calendar's right edge aligns with the Deadline input's right edge
- **AND** the Start picker continues to align with the Start input's left edge

#### Scenario: Present the Reminder hour action as an appended button
- **WHEN** the compact Reminder input group is visible
- **THEN** the alarm-clock action has a visible divider only on its left edge
- **AND** its other edges rely on the containing input group's border
- **AND** its enabled icon uses the standard white foreground color without a hover effect
- **AND** its disabled, focus, and activation semantics remain unchanged

#### Scenario: Dismiss only the nested Reminder hour menu
- **WHEN** the Reminder hour menu is open and the user presses Escape, activates its trigger again, or interacts elsewhere inside the Start picker
- **THEN** only the Reminder hour menu closes
- **AND** the Start picker remains open
- **AND** the task metadata drawer remains open
