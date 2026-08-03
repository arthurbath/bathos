## MODIFIED Requirements

### Requirement: Narrow Watch Task Capture
The Tasks watchOS companion SHALL let the signed-in companion owner create one open present task in Today Inbox from the system watch text-entry experience without exposing general task-management authority.

#### Scenario: Present the capture control
- **WHEN** the watch app is ready for capture
- **THEN** it presents one fixed-size circular green plus control centered in the view
- **AND** capture feedback appears independently of the control's layout and therefore does not resize or displace it

#### Scenario: Begin capture
- **WHEN** the user activates the watch app's plus control
- **THEN** watchOS presents its available system text-entry methods, including dictation, Scribble, or keyboard as supported by the device

#### Scenario: Submit a task
- **WHEN** the user finishes entry with a nonblank summary and the watch has valid owner authority
- **THEN** the watch sends the summary directly to the Tasks server over its available internet connection
- **AND** Tasks creates one open present Anytime task whose explicit Start is the owner's current planning date, whose Today horizon is Inbox, and whose entry and mutation channel identify the native watch

#### Scenario: Confirm a task
- **WHEN** a submitted task is confirmed by the server
- **THEN** the watch presents `Added to Inbox` without displacing the capture control
- **AND** the confirmation fades away within two seconds

#### Scenario: Cancel capture
- **WHEN** the user cancels system text entry or submits only whitespace
- **THEN** Tasks creates no task and returns to the plus control

#### Scenario: Retry a submitted request
- **WHEN** the same watch capture is delivered more than once with the same client mutation identifier
- **THEN** the server returns the original accepted result without creating a duplicate task

#### Scenario: Recover missing watch authority
- **WHEN** the user submits a task and no valid owner credential is available locally
- **THEN** the watch requests the narrow credential from its paired iPhone in the background without including the task summary
- **AND** the paired iPhone responds without requiring its Tasks UI to become active when it already holds valid authority
- **AND** the watch sends the pending summary directly to the Tasks server after authority arrives

#### Scenario: Authority cannot be recovered
- **WHEN** neither the watch nor its paired signed-in companion can provide valid owner authority
- **THEN** Tasks creates no task and presents a bounded retryable message without relaying task content through the iPhone

### Requirement: Today Completion Complication
The Tasks watchOS companion SHALL provide one circular WidgetKit complication that visualizes completion progress for non-deleted tasks whose Start has activated into Today on the owner's current planning date.

#### Scenario: Calculate Today progress
- **WHEN** the server calculates complication progress
- **THEN** the denominator contains each present open task currently assigned to a Today horizon plus each present Today task completed on the owner's current planning date
- **AND** the numerator contains the completed subset of that denominator
- **AND** canceled tasks, deleted tasks, future-start tasks, and Today tasks completed before the current planning date are excluded
- **AND** the calculation remains correct after reached Start dates are normalized into Today horizons and the explicit `start_date` value is cleared

#### Scenario: Render nonempty progress
- **WHEN** the denominator is greater than zero
- **THEN** the complication renders one solid circular track and one solid progress stroke that begins at 12 o'clock and fills clockwise toward 12 o'clock
- **AND** the progress stroke is visibly brighter than its track in supported complication renderings
- **AND** the complication renders a bold simple checkmark in its center without extra gauge labels or segmented decoration

#### Scenario: Render zero tasks
- **WHEN** no eligible task has Start equal to the planning date
- **THEN** the complication renders an empty progress stroke over the full track with the same center checkmark rather than inventing progress

#### Scenario: Activate the complication
- **WHEN** the user taps the complication
- **THEN** watchOS opens the Tasks watch app at its plus control
