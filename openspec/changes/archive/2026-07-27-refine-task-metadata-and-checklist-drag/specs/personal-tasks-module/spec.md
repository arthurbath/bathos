## ADDED Requirements

### Requirement: Nested Checklist Drag Ownership
Tasks SHALL treat a checklist-item drag as owned exclusively by the checklist within the open task and SHALL NOT expose task-list placement feedback for that nested drag.

#### Scenario: Drag a checklist item across task rows
- **WHEN** a user drags a checklist item or selected checklist-item group over other task rows
- **THEN** Tasks preserves the last valid checklist insertion position without showing a task-list placement bar or registering a task reorder

#### Scenario: Preserve native checklist drop finalization
- **WHEN** a checklist drag crosses a valid checklist insertion position and is released elsewhere inside BathOS
- **THEN** Tasks commits the checklist reorder at that retained position without activating the enclosing task drag system

### Requirement: Uniform Bulk Horizon Cycle
Tasks SHALL assign one shared Today horizon target to every task affected by one multi-target horizon command.

#### Scenario: Normalize mixed horizons
- **WHEN** the horizon command targets tasks whose effective horizon states differ
- **THEN** Tasks assigns every target to Today Now

#### Scenario: Advance a uniform horizon
- **WHEN** every target is already in Today Now, Today Next, or Today Later
- **THEN** Tasks advances every target together from Now to Next, Next to Later, or Later to Now

#### Scenario: Normalize non-cycle planning
- **WHEN** the horizon command targets only Inbox, unplanned, Someday, or future-start tasks
- **THEN** Tasks clears incompatible planning and assigns every target to Today Now

## MODIFIED Requirements

### Requirement: Task Row Temporal Metadata
The system SHALL present Deadline metadata in task rows with the semantic Lucide FlagTriangleRight icon, numeric time-direction copy, and destructive emphasis for deadlines due today or earlier, SHALL omit Start-date copy from collapsed task summaries, and SHALL present a Today horizon symbol only in Anytime secondary metadata.

#### Scenario: Omit Start dates from collapsed summaries
- **WHEN** a collapsed task has a Start date in any Tasks list
- **THEN** the task summary presents no Start date, Start-relative copy, or Lucide Play icon

#### Scenario: Present an Anytime horizon in secondary metadata
- **WHEN** an Anytime task belongs to Inbox, Now, Next, or Later
- **THEN** its canonical secondary metadata line presents the horizon's semantic icon and color after Area without repeating the icon in the Summary line

#### Scenario: Let other list structure communicate horizons
- **WHEN** Today groups a task by horizon or another list presents the same task
- **THEN** the row omits the secondary horizon marker because that marker is exclusive to Anytime

#### Scenario: Let list structure communicate future Start
- **WHEN** Upcoming groups a task by its Start date
- **THEN** the list bucket communicates that planning context without repeating it in the task's secondary metadata line

#### Scenario: Use a numeral for a one-day deadline offset
- **WHEN** a task row presents a Deadline one day before the owner-local planning date
- **THEN** the relative copy uses the numeral `1` in `1 day ago` and does not spell out `one`

#### Scenario: Emphasize an urgent deadline
- **WHEN** a task row has a Deadline equal to or earlier than the owner-local planning date
- **THEN** the Deadline icon and relative-date copy use the semantic destructive text color

#### Scenario: Keep a future deadline neutral
- **WHEN** a task row has a Deadline later than the owner-local planning date
- **THEN** the Deadline icon and relative-date copy retain the ordinary secondary metadata color

### Requirement: Concise Task View Presentation
The Tasks module SHALL keep Today, Upcoming, Anytime, Someday, Done, and Area views task-focused and compact while presenting full metadata only when it is needed.

#### Scenario: Mark an Anytime day horizon
- **WHEN** an active Anytime row has an Inbox, Now, Next, or Later horizon
- **THEN** the secondary metadata line displays compact Lucide iconography with a nonempty accessible name identifying that horizon without repeating a verbose sentence

#### Scenario: Omit an unavailable day-horizon marker
- **WHEN** an Anytime row has a null day horizon or the user is viewing another list
- **THEN** the row does not reserve empty marker space or show a decorative horizon icon

#### Scenario: Summarize nearby calendar dates relatively
- **WHEN** a task row displays a Deadline that differs from the owner-local planning date by no more than 10 days
- **THEN** the row uses Today, Tomorrow, `1 day ago`, N days ago, or N days left as appropriate

#### Scenario: Summarize a reminder by time
- **WHEN** a task row has an active reminder and valid Start planning
- **THEN** the row shows a Lucide reminder bell followed only by the reminder's 12-hour local time with an uppercase AM or PM marker

#### Scenario: Mask immediate dates in date controls
- **WHEN** a Start or Deadline input displays the owner-local date immediately before, equal to, or immediately after the planning date
- **THEN** the input respectively presents Yesterday, Today, or Tomorrow instead of an explicit calendar date

#### Scenario: Keep temporal input hover neutral
- **WHEN** a pointer hovers over an enabled Start or Deadline input
- **THEN** the control retains its ordinary input background while preserving its focus, keyboard, and popover behavior

#### Scenario: Summarize distant calendar dates compactly
- **WHEN** a displayed Deadline is more than 10 days before or after the owner-local planning date
- **THEN** the row uses a short month and numeric day such as Aug 27

#### Scenario: Arrange the open editor compactly
- **WHEN** a task editor is open
- **THEN** the card presents its summary row followed by Summary, Notes, Primary Link disclosure or input, Checklist disclosure or items, Start, Deadline, Area when available, and Actionability in DOM, visual, and keyboard order

#### Scenario: Identify drawer fields without visible labels
- **WHEN** the expanded metadata drawer presents its editable controls
- **THEN** it omits repeated visible field labels, presents Summary as the empty primary-text placeholder, uses field-identifying empty-state copy where applicable, and retains a nonempty programmatic name for every control

#### Scenario: Use the task card as the editor boundary
- **WHEN** a task editor expands
- **THEN** the form has no redundant top rule or checkbox-column indentation, uses only a small top gap, follows the card's ordinary responsive horizontal padding, and lets its controls fill the resulting content width

#### Scenario: Use shared BathOS form controls
- **WHEN** the expanded editor presents Notes, Area, or Actionability
- **THEN** Notes matches the standard Input and date-control border and focus treatment while both dropdowns use the shared BathOS Select trigger, popover, selection, and keyboard conventions

#### Scenario: Disclose an absent Primary Link
- **WHEN** an expanded task has no Primary Link
- **THEN** the editor presents an Add Primary Link action with the canonical Primary Link icon instead of an empty URL input

#### Scenario: Begin editing an absent Primary Link
- **WHEN** the user activates Add Primary Link
- **THEN** the editor reveals the standard full-size URL input above Checklist and places the text cursor in that input

#### Scenario: Present an existing Primary Link as a URL control
- **WHEN** the expanded task has a Primary Link or the user has disclosed its input
- **THEN** the editor uses a standard full-size URL input without a dedicated one-click clear button, hides the adjacent activation control while the input is empty, reveals that control as soon as any character is present, and enables activation only for a resolvable supported destination

#### Scenario: Browse Done without archive ceremony
- **WHEN** a user opens Done
- **THEN** the interface shows retained terminal work in reverse terminal order with its terminal reason, date, and one appropriate restore or reopen action

### Requirement: Consistent Tasks list density
The interface SHALL present Tasks list and grouping headings without item-count adornments, SHALL keep every collapsed task at a dense uniform height, and SHALL present optional task metadata in the stable order Area, Anytime horizon, Reminder, Deadline, Checklist, and Actionability as flat inline content without resting card or chip decoration or bold typography.

#### Scenario: Keep closed rows uniform
- **WHEN** a list contains collapsed tasks with different combinations of hierarchy, checklist content, actionability, deadline, reminder, or other secondary details
- **THEN** every collapsed task row occupies the same 44-pixel height

#### Scenario: Keep secondary details compact
- **WHEN** a collapsed task has one or more secondary details
- **THEN** the interface presents those details in one bounded nonwrapping metadata line without increasing the row height

#### Scenario: Omit absent task metadata
- **WHEN** any canonical secondary metadata item is unavailable or not applicable to a task
- **THEN** the item is absent without a placeholder and the remaining items preserve their relative canonical order

#### Scenario: Present Area quietly
- **WHEN** a task is assigned to an Area
- **THEN** its Area name is first in the metadata line and uses the ordinary secondary gray text color rather than informational blue

#### Scenario: Present checklist presence
- **WHEN** a task contains at least one checklist item
- **THEN** its metadata line presents the established Task checklist icon immediately before actionability without a count or written label

#### Scenario: Omit an empty checklist indicator
- **WHEN** a task has no checklist items
- **THEN** its metadata line does not present the Task checklist icon

#### Scenario: Present non-ready actionability as an icon
- **WHEN** a task is Waiting or Rechecking at any viewport width
- **THEN** the flat metadata line presents only that state's established symbol in semantic purple while preserving the complete actionability name for assistive technology

#### Scenario: Preserve actionable silence
- **WHEN** a task is Ready
- **THEN** the metadata line presents no actionability symbol or label at any viewport width

#### Scenario: Compress deadlines on mobile
- **WHEN** a mobile task row presents a Deadline
- **THEN** the flat metadata line presents the Deadline symbol, uses `Today` for a zero owner-planning calendar-day offset, and otherwise presents the signed offset followed by the correctly singular or plural `day` label, including `1 day`, `-1 day`, `4 days`, and `-4 days`

#### Scenario: Preserve desktop deadline metadata
- **WHEN** the task row renders at or above the standard small breakpoint
- **THEN** Deadline metadata retains its complete relative-date phrasing while remaining visually flat

#### Scenario: Use quiet task summaries
- **WHEN** an active, Done, or Trash task row renders its Summary
- **THEN** the Summary uses the ordinary interface weight while retaining foreground contrast and the established Summary text size

#### Scenario: Use compact internal spacing
- **WHEN** a collapsed task row renders its Summary, optional metadata, checkbox, source, and actions
- **THEN** it uses compact horizontal and vertical spacing with a slightly reduced leading inset, keeps source and actions controls smaller than the row height and vertically centered, preserves mobile operability, and gives the Summary and metadata lines a small visible separation without clipping controls or text

#### Scenario: Present resting tasks without cards
- **WHEN** an active, Done, or Trash task is collapsed, resting, unfocused, and unselected
- **THEN** the task row has no visible border, background fill, rounded card boundary, shadow, or gap separating it from the next task row

#### Scenario: Highlight focused and selected tasks consistently
- **WHEN** a collapsed task has whole-task keyboard focus or is selected individually or for a bulk action
- **THEN** the task uses the established quiet selection background highlight without adding an outline or focus ring around the row

#### Scenario: Preserve expanded editing containment
- **WHEN** a user opens a task
- **THEN** the complete editor expands beneath the fixed-height row header inside one quiet rounded background with a subtly increased horizontal content inset that visibly contains the summary and editor without a resting border or shadow
