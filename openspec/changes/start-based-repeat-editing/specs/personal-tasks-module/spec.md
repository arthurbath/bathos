## ADDED Requirements

### Requirement: Basis-oriented Repeat Editor
The Tasks repeat editor SHALL present repetition as one atomic form that first establishes cadence and deadline presence, then collects the Start or Deadline anchor appropriate to the selected basis.

#### Scenario: Present repeat context
- **WHEN** the user creates or edits a repeat
- **THEN** the modal title is Repeat Task or Edit Repeat and the task Summary appears beneath it as static unbordered context
- **AND** the form contains no independently editable recurrence name

#### Scenario: Select repeat type
- **WHEN** the repeat editor is open
- **THEN** the cadence phrase begins with `Repeat` followed by a shared Select offering After Completion and On a Schedule
- **AND** the selected value combines with the following cadence rows as one readable phrase without a shaded cadence container

#### Scenario: Present interval units
- **WHEN** interval count is exactly 1
- **THEN** the frequency unit is Day, Week, Month, or Year
- **AND** larger counts use Days, Weeks, Months, or Years

#### Scenario: Edit the repeat interval freely
- **WHEN** the user empties the repeat-interval field or leaves a value that is not a positive whole number
- **THEN** the editor permits that temporary value while the field remains focused
- **AND** replaces it with `1` when the field loses focus
- **AND** preview and save behavior never consume an invalid interval

#### Scenario: Configure generated dates
- **WHEN** the repeat editor is open
- **THEN** Tasks Have Deadlines is the first control after cadence
- **AND** the toggle has balanced major-concept separation above and below its row
- **AND** when deadlines are disabled the editor displays the sentence `Next Starts on` followed by the Next Start date picker
- **AND** when deadlines are enabled the editor displays `Next`, followed by a Starts or Due Select, the lowercase word `on`, and the corresponding anchor date picker
- **AND** Start basis displays With Deadlines, a nonnegative whole-day input, and Days After
- **AND** Deadline basis displays And Starts, a nonnegative whole-day input, and Days Prior

#### Scenario: Normalize an invalid deadline offset
- **WHEN** the user leaves the deadline-offset field empty or enters a value that is not a nonnegative whole number
- **THEN** the editor replaces that value with zero without showing validation messaging

#### Scenario: Default a new repeat basis
- **WHEN** a user enables deadlines while creating a new repeat
- **THEN** Schedule Based On defaults to Start

#### Scenario: Prevent an invalid Deadline basis
- **WHEN** deadlines are disabled
- **THEN** Deadline is not an allowable schedule basis

#### Scenario: Restrict a calendar anchor date
- **WHEN** the user opens Next Start or Next Deadline for a calendar repeat
- **THEN** only dates satisfying the selected weekly weekdays, monthly ordinal and day type, or yearly months, ordinal, and day type are selectable
- **AND** the selected date establishes the interval phase for schedules repeating every multiple of weeks, months, or years

#### Scenario: Allow any after-completion anchor date
- **WHEN** the user opens Next Start or Next Deadline for an after-completion repeat
- **THEN** every otherwise legal date is selectable because the completion date determines subsequent cadence

#### Scenario: Preview calendar repetition
- **WHEN** a calendar repeat has a valid cadence
- **THEN** the editor displays the next three derived Start and Deadline pairs after deadline controls and before reminder controls
- **AND** each displayed date uses the `YYYY Mon D` format

#### Scenario: Preview after-completion repetition
- **WHEN** an after-completion repeat has one definite next pair but later dates depend on completion
- **THEN** the editor displays only that definite Start and Deadline pair

#### Scenario: Present responsive weekday labels
- **WHEN** the repeat editor displays weekly cadence controls below the tablet breakpoint
- **THEN** weekday buttons display one-letter initials
- **AND** at the tablet breakpoint or wider they display three-letter weekday names
- **AND** all seven buttons divide the available weekday-row width evenly at every breakpoint

#### Scenario: Present phrasal scheduled cadence
- **WHEN** the user configures a weekly calendar schedule
- **THEN** the weekday row begins with `On`
- **AND** selected weekdays use the filled Success button treatment
- **WHEN** the user configures a monthly calendar schedule
- **THEN** the ordinal and day-type row begins with the sentence-cased phrase `On the`
- **WHEN** the user configures a yearly calendar schedule
- **THEN** the month row begins with `In`
- **AND** the ordinal and day-type row begins with the sentence-cased phrase `On the`

#### Scenario: Summarize selected yearly months
- **WHEN** the yearly month multi-select contains one through seven selected months
- **THEN** its trigger displays their three-letter names as a comma-separated list in calendar order
- **WHEN** it contains eight or more selected months
- **THEN** its trigger displays the first seven names followed by an ellipsis
- **AND** its menu continues to display full month names

#### Scenario: Group related phrase lines
- **WHEN** a cadence phrase or deadline phrase spans multiple rows
- **THEN** spacing between those related rows is tighter than spacing between separate major form concepts

#### Scenario: Configure generated reminders
- **WHEN** the repeat editor displays reminder configuration
- **THEN** the toggle is labeled Tasks Have Reminders
- **AND** the reminder-time field and hour menu use the same visual and selection paradigms as the Start picker reminder-time control

#### Scenario: Commit an invalid reminder time
- **WHEN** the user commits an empty or unparseable reminder-time value by leaving the field or pressing Enter
- **THEN** Tasks Have Reminders turns off
- **AND** the reminder-time field closes without restoring a prior reminder value

#### Scenario: Balance repeat-editor content padding
- **WHEN** the repeat editor displays its scrollable content body
- **THEN** the content has equal top and bottom padding between its controls and the surrounding modal header and footer

### Requirement: Canonical Monthly and Yearly Repeat Rules
Tasks SHALL represent newly created and edited monthly and yearly schedules with a version-2 ordinal and day-type rule and SHALL keep client preview and authoritative evaluation behavior equivalent.

#### Scenario: Configure monthly repetition
- **WHEN** the user selects a monthly frequency
- **THEN** the form displays an Ordinal Select and a Day Type Select containing Day, Weekday, Weekend Day, and Monday through Sunday

#### Scenario: Bound ordinal choices
- **WHEN** Day is selected
- **THEN** Ordinal offers First through 31st and Last
- **WHEN** Weekday is selected
- **THEN** Ordinal offers First through 23rd and Last
- **WHEN** Weekend Day is selected
- **THEN** Ordinal offers First through 10th and Last
- **WHEN** a named weekday is selected
- **THEN** Ordinal offers First through Fifth and Last

#### Scenario: Clamp an existing ordinal
- **WHEN** the user changes Day Type and the current numbered ordinal exceeds the new type's maximum
- **THEN** the editor reduces the ordinal to that maximum

#### Scenario: Clamp a numbered calendar day
- **WHEN** a numbered Day occurrence exceeds the number of days in an eligible month
- **THEN** the occurrence uses that month's final calendar day

#### Scenario: Skip a missing typed ordinal
- **WHEN** an eligible month does not contain the requested named weekday, Weekday, or Weekend Day ordinal
- **THEN** that month emits no occurrence

#### Scenario: Configure yearly months
- **WHEN** the user selects a yearly frequency
- **THEN** the form displays a required months multi-select before Ordinal and Day Type
- **AND** at least one month must remain selected

#### Scenario: Emit multiple yearly months
- **WHEN** a yearly rule selects multiple months
- **THEN** every eligible interval year emits one occurrence for each selected month in calendar order

#### Scenario: Realign the entered anchor
- **WHEN** cadence changes make the displayed Next Start or Next Deadline illegal
- **THEN** the editor advances that anchor to the first legal date on or after the displayed date

### Requirement: Dual-basis Recurrence Authority
Tasks SHALL store an immutable Start or Deadline basis on every recurrence revision and SHALL derive generated dates from the accepted revision without changing already generated ordinary task instances.

#### Scenario: Generate from a Start basis
- **WHEN** a recurrence revision uses Start basis with a nonnegative deadline offset
- **THEN** the cadence anchor is the generated Start and the generated Deadline is that anchor plus the offset

#### Scenario: Generate from a Deadline basis
- **WHEN** a recurrence revision uses Deadline basis with a nonnegative deadline offset
- **THEN** the cadence anchor is the generated Deadline and the generated Start is that anchor minus the offset

#### Scenario: Generate without deadlines
- **WHEN** a recurrence has no generated Deadline
- **THEN** it uses Start basis, persists the cadence anchor as Start, and persists no Deadline

#### Scenario: Derive a recurrence name
- **WHEN** a v2 recurrence is created or edited
- **THEN** its name is derived from the normalized prototype Summary and cannot diverge through a separate recurrence-name input

#### Scenario: Assign a Start-basis occurrence identity
- **WHEN** a new Start-basis calendar occurrence is created
- **THEN** it receives a deterministic versioned logical key that cannot collide with legacy calendar keys

#### Scenario: Preserve an existing generated task
- **WHEN** a recurrence revision or compatibility migration changes recurrence representation
- **THEN** every already generated ordinary task retains its current Start, Deadline, metadata, provenance, and occurrence identity

#### Scenario: Adopt the source task as the first occurrence
- **WHEN** the user creates a recurrence from an existing ordinary task
- **THEN** that same ordinary task becomes the first occurrence and receives the first Start and optional Deadline derived from the saved cadence, replacing its prior planning dates
- **AND** the recurrence prototype advances to the cadence after that adopted occurrence without generating a duplicate

#### Scenario: Activate an adopted occurrence that starts today
- **WHEN** the first pair of a newly created recurrence has a Start equal to the owner's planning date
- **THEN** the adopted source task retains that Start, receives Today Inbox, and receives the pair's optional Deadline in the same transaction

#### Scenario: Materialize a same-day prototype edit
- **WHEN** an active recurrence prototype is edited so the accepted first pair has a Start equal to the owner's planning date
- **THEN** the server generates that ordinary occurrence exactly once during the save transaction
- **AND** the generated task retains Start today, receives Today Inbox, receives the pair's optional Deadline, and the prototype advances to its next legal state

### Requirement: Recurrence Compatibility and Portability
Tasks SHALL read legacy and version-2 recurrence rules, SHALL expose versioned create/edit APIs for the Start-oriented contract, and SHALL preserve synchronized and portable recurrence data across supported clients.

#### Scenario: Save a v2 schedule
- **WHEN** a current client creates or edits a recurrence
- **THEN** it calls the versioned API with Next Start, date basis, deadline days after Start, and canonical rule config without an independent recurrence name

#### Scenario: Read a legacy schedule
- **WHEN** synchronized or restored recurrence data contains a legacy rule shape
- **THEN** preview, prototype projection, reminders, and authoritative evaluation retain its historical behavior

#### Scenario: Use a legacy API
- **WHEN** a cached client creates or edits a legacy Deadline-style recurrence
- **THEN** the preserved legacy RPC continues to apply its historical contract

#### Scenario: Reject an unsafe cached edit
- **WHEN** a cached client attempts to edit a newer Start-basis revision through a legacy RPC
- **THEN** the server rejects the mutation with a refresh-required error and leaves the revision unchanged

#### Scenario: Synchronize and export date basis
- **WHEN** recurrence revisions synchronize, export, restore, or hydrate
- **THEN** date basis and canonical rule configuration round-trip without loss while legacy payloads receive compatible defaults

### Requirement: Recurrence Compatibility Migration
The production compatibility migration SHALL preserve all existing recurrence projections and identities while explicitly protecting date-significant Deadline-based schedules.

#### Scenario: Backfill an existing deadline recurrence
- **WHEN** an existing recurrence revision has a generated Deadline offset
- **THEN** the migration marks it Deadline-based without rewriting its stored dates, rules, occurrences, logical keys, or generated instances

#### Scenario: Backfill an existing no-deadline recurrence
- **WHEN** an existing recurrence revision has no generated Deadline offset
- **THEN** the migration marks it Start-based without rewriting its stored dates, rules, occurrences, logical keys, or generated instances

#### Scenario: Protect birthdays and holidays
- **WHEN** the migration preflight identifies birthday, Christmas, Mother’s Day, or another holiday definition in the private stable-ID manifest
- **THEN** the migration requires that definition's current revision to remain Deadline-based and its controlling Deadline sequence to remain unchanged

#### Scenario: Abort on production drift
- **WHEN** exact preflight counts, protected IDs, projected pairs, occurrence identities, recurrence status, or prototype placement differ from the approved manifest
- **THEN** the migration aborts without committing partial changes
