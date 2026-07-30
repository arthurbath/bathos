## MODIFIED Requirements

### Requirement: Consistent Tasks list density
The interface SHALL present Tasks list and grouping headings without item-count adornments, SHALL keep every collapsed task at a dense uniform height, and SHALL present optional task metadata in the stable order Area, Anytime horizon, Reminder, Actionability, Deadline, Notes, and Checklist as flat inline content without resting card or chip decoration or bold typography, except that Anytime SHALL omit a task's Area from the metadata line when the visible Area bucket already communicates it.

#### Scenario: Keep closed rows uniform
- **WHEN** a list contains collapsed tasks with different combinations of hierarchy, notes, checklist content, actionability, deadline, reminder, or other secondary details
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
