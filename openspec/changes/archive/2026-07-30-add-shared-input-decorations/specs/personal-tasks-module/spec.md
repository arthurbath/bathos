## ADDED Requirements

### Requirement: Task metadata controls use semantic leading decorations
The expanded Tasks metadata drawer SHALL identify its unlabeled single-line controls with pinned muted leading decorations while retaining placeholders and programmatic names.

#### Scenario: Decorate Primary Link
- **WHEN** the Primary Link input is visible
- **THEN** its decoration uses the recognized Mail, Jira, or Obsidian icon when applicable and otherwise uses Lucide `Link2`

#### Scenario: Decorate Start
- **WHEN** Start is empty or contains a future date
- **THEN** its decoration uses Lucide `Play`

#### Scenario: Decorate a Today Start
- **WHEN** Start represents Today
- **THEN** its decoration uses the task's current horizon-specific icon and semantic horizon color

#### Scenario: Decorate Deadline and Area
- **WHEN** Deadline or Area is visible
- **THEN** Deadline uses Lucide `Flag` and Area uses the canonical Lucide `Layers3` Area icon

#### Scenario: Emphasize an urgent Deadline control
- **WHEN** Deadline contains the owner-local planning date or an earlier date
- **THEN** its Lucide `Flag` decoration and visible date value use the same semantic destructive red as urgent Deadline metadata in a task row

#### Scenario: Keep a future Deadline control neutral
- **WHEN** Deadline is empty or contains a date later than the owner-local planning date
- **THEN** its decoration and visible value retain their ordinary muted or foreground control colors

#### Scenario: Decorate Actionability
- **WHEN** Actionability is visible
- **THEN** its decoration uses the current actionability value's canonical icon, including Lucide `ArrowBigRightDash` for Ready

#### Scenario: Emphasize a non-Ready Actionability decoration
- **WHEN** Actionability is Waiting or Rechecking
- **THEN** its decoration uses the same semantic purple as the corresponding task-row metadata

#### Scenario: Keep a Ready Actionability decoration neutral
- **WHEN** Actionability is Ready
- **THEN** its decoration retains the ordinary muted control-icon color

### Requirement: Task completion boxes use neutral color
Ordinary task and checklist completion controls SHALL use the established neutral gray in both open and checked states and SHALL NOT turn green on hover.

#### Scenario: Hover an ordinary completion box
- **WHEN** a user points at an open or checked task or checklist completion box
- **THEN** its icon retains the ordinary neutral gray rather than changing to semantic green

#### Scenario: Present a checked completion box
- **WHEN** a task or checklist item is shown as checked
- **THEN** its checked-square icon uses the same neutral gray family as its unchecked-square icon

#### Scenario: Preserve selection-mode color
- **WHEN** task or checklist selection mode replaces completion boxes with selection circles
- **THEN** those selection controls retain their established information-blue selection styling

### Requirement: Start-picker actions use compact label-free layout
The Tasks Start picker SHALL present Reminder as a full-width decorated input without a visible field label and SHALL center the Clear and Someday action labels.

#### Scenario: Present Reminder
- **WHEN** the Start picker renders Reminder
- **THEN** the ordinary time input fills its available row, uses the Bell decoration and Reminder placeholder, retains a nonempty programmatic name, and presents no visible Reminder label

#### Scenario: Present terminal Start actions
- **WHEN** the Start picker renders Clear and Someday
- **THEN** each action keeps its icon while centering its visible label within its available action area

## MODIFIED Requirements

### Requirement: Flexible Reminder Time Entry
The Tasks Start picker and bulk reminder surface SHALL accept a bounded grammar of reasonable time shorthand, normalize accepted input to one visible local time, persist only canonical 24-hour reminder intent, and provide concise rejection feedback without exposing resolution metadata.

#### Scenario: Normalize meridiem shorthand
- **WHEN** a user enters `1p`, `1pm`, `1 pm`, `1:3p`, `1:30p`, `1:30pm`, `1:30 pm`, or `130p`
- **THEN** Tasks interprets the value as 1:00 pm or 1:30 pm as applicable, displays the normalized lower-case meridiem time, and persists `13:00` or `13:30`

#### Scenario: Normalize numeric shorthand
- **WHEN** a user enters `1`, `13`, `130`, or `1300` for future work
- **THEN** Tasks interprets the values as 1:00 am, 1:00 pm, 1:30 am, and 1:00 pm respectively

#### Scenario: Reject malformed reminder input
- **WHEN** a user commits an impossible or unsupported value such as `25` or `asdf`
- **THEN** Tasks performs no reminder mutation, restores the last committed display value or empty bulk value, retains the active reminder surface, and briefly shows `Not allowed.`

#### Scenario: Reject an explicit elapsed Today time
- **WHEN** a Today reminder entry explicitly resolves to an owner-local instant that is not later than the current time
- **THEN** Tasks performs no reminder mutation, restores the last committed display value or empty bulk value, and briefly shows `Not allowed.`

#### Scenario: Resolve ambiguous Today shorthand to the remaining future meridiem
- **WHEN** an unsuffixed 1-12-hour reminder value has an elapsed AM interpretation but a future PM interpretation on the owner planning date
- **THEN** Tasks uses the PM interpretation and persists its canonical 24-hour time

#### Scenario: Reject fully elapsed ambiguous Today shorthand
- **WHEN** both AM and PM interpretations of an unsuffixed 1-12-hour value have elapsed on the owner planning date
- **THEN** Tasks performs no reminder mutation, restores the last committed display value or empty bulk value, and briefly shows `Not allowed.`

#### Scenario: Accept any valid time for future work
- **WHEN** a reminder belongs only to future Start dates
- **THEN** Tasks accepts every valid parser interpretation regardless of the current owner-local time

#### Scenario: Confirm reminder input in two Enter steps
- **WHEN** a user presses Enter while a Start-picker or bulk Reminder input contains a valid raw or changed value
- **THEN** Tasks normalizes the visible value and keeps the reminder surface open, then the next Enter on the unchanged normalized value closes the Start picker or submits the bulk reminder form

#### Scenario: Apply a bulk reminder with one pointer action
- **WHEN** a user enters a valid raw or normalized bulk Reminder value and activates Apply
- **THEN** Tasks resolves and applies the canonical time in one pointer action without requiring a preliminary normalization click

#### Scenario: Validate a mixed bulk selection atomically
- **WHEN** a bulk reminder targets both Today and future-starting tasks
- **THEN** Tasks accepts the shared time only when it is valid for the Today targets and otherwise applies no reminder to any selected task

#### Scenario: Preserve spaces in reminder input
- **WHEN** focus is inside Reminder and the user presses Space
- **THEN** the input receives a space rather than activating or closing the reminder surface

#### Scenario: Size Reminder for its surface
- **WHEN** the Start picker renders Reminder
- **THEN** its text input uses the ordinary text-field style and fills the available picker row

- **WHEN** the bulk reminder surface renders Reminder
- **THEN** its text input uses the ordinary text-field style and only the width needed for a time value

### Requirement: Task Row Temporal Metadata
The system SHALL present Deadline metadata in task rows with the semantic Lucide `Flag` icon, numeric time-direction copy, and destructive emphasis for deadlines due today or earlier, SHALL omit Start-date copy from collapsed task summaries, and SHALL present a Today horizon symbol only in Anytime secondary metadata.

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

### Requirement: Task Primary Link actions use canonical external-link iconography
Tasks SHALL use canonical protocol-specific identity icons for Primary Links in task rows, the metadata-editor decoration, and the iOS widget, defaulting to Lucide `Link2` or its closest native equivalent, while the metadata editor's adjacent launch action SHALL always use Lucide `ExternalLink`.

#### Scenario: Show a generic Primary Link
- **WHEN** a task has a generic HTTP or HTTPS Primary Link
- **THEN** its task-row and metadata-input decoration use Lucide `Link2` and its widget representation uses the closest native chain-link symbol

#### Scenario: Show a Mail message link
- **WHEN** a task Primary Link uses the recognized Mail message protocol
- **THEN** the task row, metadata-input decoration, and widget retain the established Mail message icon

#### Scenario: Show a Jira link
- **WHEN** a task Primary Link uses the Jira protocol or a recognized Jira HTTP or HTTPS URL
- **THEN** every task-row and metadata-input decoration uses Lucide `Zap`, the iOS widget uses the closest native system rendering, and activation opens the configured browser or registered Jira application as appropriate

#### Scenario: Show an Obsidian link
- **WHEN** a task Primary Link uses the Obsidian protocol
- **THEN** every task-row and metadata-input decoration uses Lucide `FileText`, the iOS widget uses the closest native system rendering, and activation opens the registered Obsidian application

#### Scenario: Keep the launch action stable
- **WHEN** a nonblank Primary Link appears in an expanded task
- **THEN** the activation control beside the Primary Link input always uses Lucide `ExternalLink` regardless of the Primary Link's identity icon
