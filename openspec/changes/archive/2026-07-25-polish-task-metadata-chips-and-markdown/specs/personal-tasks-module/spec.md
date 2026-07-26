## MODIFIED Requirements

### Requirement: Readable Markdown Task Notes
The system SHALL retain task notes as plain text while presenting one complete, directly editable, live-styled Markdown source surface in an expanded to-do without separate editing and preview modes.

#### Scenario: Edit complete live-styled source
- **WHEN** a user opens a to-do and edits its notes
- **THEN** the interface keeps the complete plain-text source directly editable without an internal height limit, preserves every Markdown delimiter visibly, and updates recognized Markdown styling as the source changes without requiring an alternate mode

#### Scenario: Limit live Markdown recognition
- **WHEN** notes contain supported Markdown syntax
- **THEN** the editor recognizes headings introduced by one or more hashmarks and a space, single-asterisk italic, double-asterisk bold, asterisk-plus-space bullets, Markdown links, and single-backtick inline code while treating other Markdown constructs as ordinary text

#### Scenario: Style Markdown indicators
- **WHEN** the editor recognizes a heading, italic, bold, bullet, Markdown link, or inline-code delimiter
- **THEN** the original hashmark-and-space, asterisk, bracket, parenthesis, and backtick indicators remain visible in a fixed-width muted-foreground style while the marked content retains its recognized heading, italic, bold, bullet, link, or code presentation

#### Scenario: Differentiate Markdown link source
- **WHEN** the editor recognizes `[label](destination)` Markdown link source
- **THEN** the bracket and parenthesis indicators use the muted fixed-width indicator style, the label uses ordinary foreground text, the destination uses semantic link-blue text, and the complete source remains one safe clickable link

#### Scenario: Style inline code completely
- **WHEN** the editor recognizes text enclosed by single backticks on one line
- **THEN** the complete string uses a fixed-width font and a light semantic background while both backticks use the muted indicator color

#### Scenario: Continue an asterisk bullet
- **WHEN** a user presses Enter without Shift while editing a line that begins with `* `
- **THEN** the editor inserts a new line beginning with `* ` and wraps each bullet with a two-fixed-width-character hanging indent

#### Scenario: Follow a note link
- **WHEN** notes contain a Markdown link, bare HTTP(S) URL, or bare alphanumeric `scheme://` destination such as `message://`
- **THEN** the live editor exposes the safe destination with a pointer cursor and no hover underline, opens HTTP(S) in a new browser context, dispatches `message://` to Mail, and keeps known executable or content-injection schemes inert

#### Scenario: Preserve editing mechanics while styling
- **WHEN** the editor retokenizes changed source
- **THEN** it preserves the user's caret or selection, defers decoration during composition, accepts pasted content as plain text, yields documented undo and redo commands to Tasks, and autosaves the identical source to the same notes field

#### Scenario: Start empty notes directly
- **WHEN** an expanded to-do has empty notes
- **THEN** the same live editor presents its placeholder without requiring a separate preview step

### Requirement: Consistent Tasks list density
The interface SHALL present Tasks list and grouping headings without item-count adornments, SHALL keep every collapsed task at a dense uniform height, and SHALL use alignment, responsive metadata compression, and ordinary-weight titles rather than resting card decoration or bold typography to associate each task's primary and secondary content.

#### Scenario: Present count-free headings
- **WHEN** a Tasks list, section, grouping, search-results, project, area, or checklist heading is presented
- **THEN** the interface presents its descriptive label without a visible or programmatic numeric item count

#### Scenario: Keep closed rows uniform
- **WHEN** a list contains collapsed tasks with different combinations of hierarchy, actionability, scheduling, deadline, reminder, or other secondary details
- **THEN** every collapsed task row occupies the same 44-pixel height

#### Scenario: Keep secondary details compact
- **WHEN** a collapsed task has one or more secondary details
- **THEN** the interface presents those details in one bounded nonwrapping metadata line without increasing the row height

#### Scenario: Compress actionability on mobile
- **WHEN** a mobile task row presents Waiting or Rechecking actionability
- **THEN** the metadata line presents that state's established symbol inside a quiet compact chip while preserving the complete actionability name for assistive technology

#### Scenario: Preserve actionable silence
- **WHEN** a task is Actionable
- **THEN** the metadata line presents no actionability symbol or label at any viewport width

#### Scenario: Compress deadlines on mobile
- **WHEN** a mobile task row presents a Deadline
- **THEN** a quiet compact chip presents the Deadline symbol and signed number of owner-planning calendar days from Today followed by `days`, including `0 days` for Today, a positive value such as `4 days` for future work, and a negative value such as `-4 days` for overdue work

#### Scenario: Preserve complete desktop metadata
- **WHEN** the task row renders at or above the standard small breakpoint
- **THEN** Waiting, Rechecking, and Deadline metadata retain their complete established labels and relative-date phrasing without the mobile chip treatment

#### Scenario: Use quiet task titles
- **WHEN** an active, Done, or Trash task row renders its title
- **THEN** the title uses the ordinary interface weight while retaining foreground contrast and the established task-title size

#### Scenario: Use compact internal spacing
- **WHEN** a collapsed task row renders its title, optional metadata, checkbox, source, and actions
- **THEN** it uses compact horizontal and vertical spacing with a slightly reduced leading inset, keeps source and actions controls smaller than the row height and vertically centered, preserves mobile operability, and gives the title and metadata lines a small visible separation without clipping controls or text

#### Scenario: Present resting tasks without cards
- **WHEN** an active, Done, or Trash task is collapsed, resting, unfocused, and unselected
- **THEN** the task row has no visible border, background fill, rounded card boundary, shadow, or gap separating it from the next task row

#### Scenario: Highlight focused and selected tasks consistently
- **WHEN** a collapsed task has whole-task keyboard focus or is selected individually or for a bulk action
- **THEN** the task uses the established quiet selection background highlight without adding an outline or focus ring around the row

#### Scenario: Preserve expanded editing containment
- **WHEN** a user opens a task
- **THEN** the complete editor expands beneath the fixed-height row header inside one quiet rounded background with a subtly increased horizontal content inset that visibly contains the summary and editor without a resting border or shadow

#### Scenario: Preserve planning-project cards
- **WHEN** a primary planning view presents project navigation items alongside compact task rows
- **THEN** the project items retain their distinct card presentation and spacing
