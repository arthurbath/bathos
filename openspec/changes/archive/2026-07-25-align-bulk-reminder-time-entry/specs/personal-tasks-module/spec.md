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

#### Scenario: Keep Reminder compact
- **WHEN** the Start picker or bulk reminder surface renders Reminder
- **THEN** its text input uses the same ordinary text-field style and only the width needed for a time value

#### Scenario: Keep reminder resolution metadata internal
- **WHEN** Tasks presents reminder editing for a to-do, project, or bulk task selection
- **THEN** the interface omits repeated-time selection and time-zone display while persistence uses the deterministic earlier repeated-time instance and the authoritative planning time zone internally
