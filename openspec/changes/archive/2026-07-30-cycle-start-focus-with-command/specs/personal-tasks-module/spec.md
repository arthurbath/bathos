## ADDED Requirements

### Requirement: Progressive Start Command Focus
The Tasks module SHALL let the Start keyboard command traverse increasingly later Start choices without changing task metadata until the user activates the focused choice.

#### Scenario: Focus the current Start choice
- **WHEN** Control+E on Mac or Alt+Shift+E on Windows opens Start for one eligible task
- **THEN** keyboard focus lands on the task's current Today horizon or future calendar Start date

#### Scenario: Begin an unplanned task at Inbox
- **WHEN** the Start command opens Start for a task with no Today horizon, future Start date, or Someday destination
- **THEN** keyboard focus begins on Today Inbox

#### Scenario: Advance from Today directly to tomorrow
- **WHEN** the Start picker is open with focus on Inbox, Now, Next, or Later and the user invokes the Start command again
- **THEN** focus advances directly to tomorrow without visiting another Today horizon or committing a Start value

#### Scenario: Advance through future dates
- **WHEN** the Start picker is open with focus on a future calendar date and the user invokes the Start command again
- **THEN** focus advances to the next selectable future calendar date without committing a Start value

#### Scenario: Advance across a calendar month
- **WHEN** the Start command advances focus from the final day of a displayed month
- **THEN** the calendar first displays the following month and then focuses its first selectable day

#### Scenario: Resume advancement after manual date navigation
- **WHEN** the user moves calendar focus with arrow keys and the next Start-command step is a date that the command previously focused
- **THEN** the Start command focuses that date again and continues its chronological traversal without committing a Start value

#### Scenario: Activate the traversed choice explicitly
- **WHEN** the user presses Enter or Space on a Start choice reached through command traversal
- **THEN** Tasks applies that horizon or date through the ordinary Start planning action and closes the picker
