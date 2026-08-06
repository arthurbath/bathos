## MODIFIED Requirements

### Requirement: Chronological Upcoming Presentation
The system SHALL present the complete Upcoming view from the nearest controlling date to the latest controlling date for every dated ordinary task and scheduled recurrence prototype.

#### Scenario: Order exact Starts inside month groups
- **WHEN** ordinary tasks or recurrence prototypes with different explicit or implicit Starts fall within the same Upcoming month group
- **THEN** the interface orders all rows by effective Start from earliest to latest so every row sharing one Start remains contiguous

#### Scenario: Preserve deterministic equal-date order
- **WHEN** ordinary tasks or recurrence prototypes share the same effective Start inside a month group
- **THEN** the interface uses their stable Upcoming rank and identity tie-breaker without moving any later-dated row above an earlier-dated row

#### Scenario: Preserve manual daily order
- **WHEN** multiple Upcoming rows appear in one of the seven individual day buckets
- **THEN** the interface preserves their stable mixed-row Upcoming rank without applying an additional date sort

### Requirement: Task Row Temporal Metadata
The system SHALL present Deadline metadata in task rows with the semantic Lucide `Flag` icon, signed nearby countdown copy, and destructive emphasis for deadlines due today or earlier, SHALL present effective Start metadata for Upcoming month-bucket rows using the same temporal formatting rules, and SHALL present a Today horizon symbol only in Anytime secondary metadata.

#### Scenario: Omit redundant Starts from daily buckets
- **WHEN** Upcoming groups a collapsed ordinary task or recurrence prototype in one of the seven individual date buckets
- **THEN** the bucket communicates the effective Start and the task's secondary metadata omits Start copy

#### Scenario: Present effective Starts in month buckets
- **WHEN** Upcoming groups a collapsed ordinary task or recurrence prototype in a month bucket
- **THEN** the secondary metadata presents the explicit Start or deadline-implied or recurrence-projected Start with the Lucide Play icon

#### Scenario: Present an Anytime horizon in secondary metadata
- **WHEN** an Anytime task belongs to Inbox, Now, Next, or Later
- **THEN** its canonical secondary metadata line presents the horizon's semantic icon and color after Area without repeating the icon in the Summary line

#### Scenario: Let other list structure communicate horizons
- **WHEN** Today groups a task by horizon or another list presents the same task
- **THEN** the row omits the secondary horizon marker because that marker is exclusive to Anytime

#### Scenario: Use signed nearby date countdowns
- **WHEN** a Start or Deadline differs from the owner-local planning date by no more than 9 days and is not Today or Tomorrow
- **THEN** desktop metadata presents `N days` for a future date and `-1 day` or `-N days` for an overdue date without `left` or `ago`

#### Scenario: Use calendar copy outside the countdown window
- **WHEN** a Start or Deadline differs from the owner-local planning date by more than 9 days
- **THEN** desktop metadata presents the abbreviated month and unpadded day

#### Scenario: Emphasize an urgent deadline
- **WHEN** a task row has a Deadline equal to or earlier than the owner-local planning date
- **THEN** the Deadline icon and relative-date copy use the semantic destructive text color

#### Scenario: Keep a future deadline neutral
- **WHEN** a task row has a Deadline later than the owner-local planning date
- **THEN** the Deadline icon and relative-date copy retain the ordinary secondary metadata color

### Requirement: Consistent Tasks list density
The interface SHALL present Tasks list and grouping headings without item-count adornments, SHALL keep every collapsed task at a dense uniform height, and SHALL present optional task metadata in the stable order Area, Start when required by Upcoming month context, Anytime horizon, Reminder, Actionability, Deadline, Notes, and Checklist as flat inline content without resting card or chip decoration or bold typography, except that Anytime SHALL omit a task's Area from the metadata line when the visible Area bucket already communicates it.

#### Scenario: Keep closed rows uniform
- **WHEN** a list contains collapsed tasks with different combinations of hierarchy, notes, checklist content, actionability, Start, Deadline, reminder, or other secondary details
- **THEN** every collapsed task row occupies the same 44-pixel height

#### Scenario: Keep secondary details compact
- **WHEN** a collapsed task has one or more secondary details
- **THEN** the interface presents those details in one bounded nonwrapping metadata line without increasing the row height

#### Scenario: Omit absent task metadata
- **WHEN** any canonical secondary metadata item is unavailable or not applicable to a task
- **THEN** the item is absent without a placeholder and the remaining items preserve their relative canonical order

#### Scenario: Present Area quietly outside Anytime
- **WHEN** a task assigned to an Area appears on a view other than Anytime
- **THEN** its Area name is first in the metadata line and uses the ordinary secondary gray text color rather than informational blue

#### Scenario: Omit redundant Anytime Area metadata
- **WHEN** an Anytime task appears inside its visible Area bucket
- **THEN** its secondary metadata line omits the Area name while preserving every other applicable metadata item and its canonical order

#### Scenario: Place actionability between Reminder and Deadline
- **WHEN** a task has Reminder, non-Ready actionability, and Deadline metadata
- **THEN** the metadata line presents Actionability immediately after Reminder and immediately before Deadline

#### Scenario: Present Notes presence
- **WHEN** a task's Notes contain at least one character
- **THEN** its metadata line presents the canonical Lucide `NotepadText` icon immediately before Checklist without a count or written label

#### Scenario: Omit an empty Notes indicator
- **WHEN** a task's Notes are empty
- **THEN** its metadata line does not present the Notes icon

#### Scenario: Present checklist presence
- **WHEN** a task contains at least one checklist item
- **THEN** its metadata line presents the established Task checklist icon after Notes without a count or written label

#### Scenario: Omit an empty checklist indicator
- **WHEN** a task has no checklist items
- **THEN** its metadata line does not present the Task checklist icon

#### Scenario: Present non-ready actionability as an icon
- **WHEN** a task is Waiting or Rechecking at any viewport width
- **THEN** the flat metadata line presents only that state's established symbol in semantic purple while preserving the complete actionability name for assistive technology

#### Scenario: Preserve actionable silence
- **WHEN** a task is Ready
- **THEN** the metadata line presents no actionability symbol or label at any viewport width

#### Scenario: Compress temporal metadata on mobile
- **WHEN** a mobile task row presents a Start or Deadline
- **THEN** the flat metadata line presents `Today` for a zero owner-planning calendar-day offset, a signed offset with the `d` suffix within 9 days, and an unpadded numeric month-day outside that window

#### Scenario: Preserve desktop temporal metadata
- **WHEN** the task row renders at or above the standard small breakpoint
- **THEN** applicable Start and Deadline metadata retains its complete countdown or abbreviated month-day phrasing while remaining visually flat

#### Scenario: Use quiet task summaries
- **WHEN** an active, Done, or Trash task row renders its Summary
- **THEN** the Summary uses the ordinary interface weight while retaining foreground contrast and the established Summary text size

#### Scenario: Use compact internal spacing
- **WHEN** a collapsed task row renders its Summary, optional metadata, checkbox, source, and actions
- **THEN** it uses compact horizontal and vertical spacing with a slightly reduced leading inset, keeps source and actions controls smaller than the row height and vertically centered, preserves mobile operability, and gives the Summary and metadata lines a small visible separation without clipping controls or text

### Requirement: Upcoming Date-Section Ordering
The Tasks module SHALL permit manual ordering of ordinary tasks and scheduled recurrence prototypes inside each of the seven individual Upcoming date sections and among equal-date rows in a month section through one stable mixed-row rank, while chronological effective Start remains the primary month-section order.

#### Scenario: Preserve a direct mixed-row drop in a daily section
- **WHEN** a user drags an ordinary task or scheduled recurrence prototype before or after any eligible row in its current individual Upcoming date section
- **THEN** Tasks persists the exact displayed placement and retains it through asynchronous save and synchronization

#### Scenario: Preserve an equal-date mixed-row drop in a month section
- **WHEN** a user reorders an ordinary task or scheduled recurrence prototype among rows with the same effective Start in an Upcoming month section
- **THEN** Tasks persists the displayed same-date placement without allowing that rank to separate rows with another effective Start

#### Scenario: Upload an ordinary task's Upcoming rank
- **WHEN** an ordinary task reorder changes `upcoming_order_key` in the local synchronized database
- **THEN** the Tasks mutation connector uploads that rank as a supported mutable task field instead of rejecting the queued mutation and restoring the prior remote rank

#### Scenario: Preserve a section-edge drop around prototypes
- **WHEN** a user drops at the beginning or end of an Upcoming date section containing ordinary tasks, recurrence prototypes, or both
- **THEN** Tasks derives the boundary from the complete displayed mixed-row sequence rather than from ordinary tasks alone

#### Scenario: Preserve an ordinary task's cross-section prototype placement
- **WHEN** a user drags an ordinary task from one Upcoming date section before or after a recurrence prototype in another date section
- **THEN** Tasks moves the ordinary task to the target date section and persists its requested placement among rows sharing the resulting effective Start

#### Scenario: Reconcile a concurrent prototype revision
- **WHEN** a prototype metadata save or recurrence evaluation advances the recurrence revision while an Upcoming reorder is being committed
- **THEN** Tasks retries the orthogonal rank mutation against the authoritative recurrence definition without flashing the prototype back to its stale position

#### Scenario: Order tied mixed rows consistently
- **WHEN** ordinary tasks or recurrence prototypes share the same effective Start and fractional order key
- **THEN** rendering and reorder calculations apply the same stable identity tie-breaker
