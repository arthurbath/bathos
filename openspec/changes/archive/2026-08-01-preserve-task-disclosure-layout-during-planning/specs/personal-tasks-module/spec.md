## MODIFIED Requirements

### Requirement: Concise Task View Presentation
The Tasks module SHALL keep Today, Upcoming, Anytime, Someday, Done, and Area views task-focused and compact while presenting full metadata only when it is needed.

#### Scenario: Mark an Anytime day horizon
- **WHEN** an active Anytime row has an Inbox, Now, Next, or Later horizon
- **THEN** the secondary metadata line displays compact Lucide iconography with a nonempty accessible name identifying that horizon without repeating a verbose sentence

#### Scenario: Omit an unavailable day-horizon marker
- **WHEN** an Anytime row has a null day horizon or the user is viewing another list
- **THEN** the row does not reserve empty marker space or show a decorative horizon icon

#### Scenario: Summarize nearby calendar dates relatively
- **WHEN** a task row displays a Deadline that differs from the owner-local planning date by no more than 9 days
- **THEN** the wider row uses Today, Tomorrow, `1 day ago`, N days ago, or N days left as appropriate
- **AND** the compact mobile row uses Today or a signed singular or plural day count as appropriate

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
- **WHEN** a displayed Deadline is more than 9 days before or after the owner-local planning date
- **THEN** both wider and compact mobile task rows use a short month and numeric day such as Aug 27

#### Scenario: Arrange the open editor compactly
- **WHEN** a task editor is open
- **THEN** the card presents its summary row followed by Summary, Notes, Primary Link disclosure or input, Checklist disclosure or items, Start, Deadline, Area when available, and Actionability in DOM, visual, and keyboard order

#### Scenario: Keep Notes visibly multiline
- **WHEN** Notes is empty or contains no more than two visible lines
- **THEN** the Notes control reserves a minimum of two text lines plus its ordinary vertical padding
- **AND** it continues growing for additional content rather than behaving as a single-line input

#### Scenario: Identify drawer fields without visible labels
- **WHEN** the expanded metadata drawer presents its editable controls
- **THEN** it omits repeated visible field labels, presents Summary as the empty primary-text placeholder, uses field-identifying empty-state copy where applicable, and retains a nonempty programmatic name for every control

#### Scenario: Use the task card as the editor boundary
- **WHEN** a task editor expands
- **THEN** the form has no redundant top rule or checkbox-column indentation, uses only a small top gap, follows the card's ordinary responsive horizontal padding, and lets its controls fill the resulting content width

#### Scenario: Use shared BathOS form controls
- **WHEN** the expanded editor presents Notes, Area, or Actionability
- **THEN** Notes matches the standard Input and date-control border and focus treatment while both dropdowns use the shared BathOS Select trigger, popover, selection, and keyboard conventions

#### Scenario: Pair absent metadata disclosures
- **WHEN** an expanded task has neither a Primary Link nor Checklist content
- **THEN** Add Primary Link and Add Checklist appear in one row as equal half-width controls with centered contents and one subtle divider between them
- **AND** Primary Link remains before Checklist in DOM and keyboard order

#### Scenario: Present one absent metadata disclosure
- **WHEN** an expanded task has either Primary Link or Checklist content but not the other
- **THEN** the remaining add action appears at automatic width on its own line with left-aligned contents and no divider

#### Scenario: Preserve disclosure layout during planning changes
- **WHEN** the user changes Start or destination while an expanded task already has Primary Link or Checklist content
- **THEN** the existing content and any remaining add action continue on separate full-width rows
- **AND** selecting Someday does not recombine them into the paired absent-metadata layout

#### Scenario: Preserve an open Anytime task's rendered placement
- **WHEN** the user changes Area, Start, Deadline, Actionability, ordering, or any other metadata that would change an expanded Anytime task's visible bucket or invisible automatic-sort position
- **THEN** the editor and summary row may display the current metadata immediately while the task remains in the exact Area bucket and within-bucket slot where it was rendered when opened
- **AND** the final metadata projection is allowed to rebucket or reorder the task only after the drawer closes

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
