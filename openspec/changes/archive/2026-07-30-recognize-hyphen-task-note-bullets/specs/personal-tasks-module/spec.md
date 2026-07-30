## MODIFIED Requirements

### Requirement: Readable Markdown Task Notes
The system SHALL retain task notes as plain text while presenting one complete, directly editable, line-aware Markdown surface in an expanded to-do without separate editing and preview modes.

#### Scenario: Reveal source on the active line
- **WHEN** the user's collapsed caret is on a task-note line
- **THEN** the interface keeps that line's complete plain-text source directly editable, preserves every recognized Markdown delimiter visibly in its live-styled source presentation, and semantically presents every other line

#### Scenario: Reveal source across a selection
- **WHEN** the user selects source across more than one task-note line
- **THEN** the interface reveals the complete Markdown source of every line crossed by the selection and preserves the exact selected source range

#### Scenario: Select source backward
- **WHEN** the user begins a task-note selection at a later source position and extends it backward or upward across Markdown lines
- **THEN** line-aware redecoration preserves the later anchor and earlier moving edge so the selection continues extending naturally in that direction

#### Scenario: Present inactive inline Markdown
- **WHEN** a supported heading, italic, bold, or inline-code construct is on a line that does not contain the caret or active selection
- **THEN** the editor hides its Markdown delimiters while retaining the recognized heading, italic, bold, or code presentation of its content

#### Scenario: Present an inactive bullet
- **WHEN** an asterisk-plus-space or hyphen-plus-space bullet is on a line that does not contain the caret or active selection
- **THEN** the editor presents the same ordinary bullet marker in place of either source marker and retains the line's semantic hanging indentation

#### Scenario: Present an inactive Markdown link
- **WHEN** `[label](destination)` source is on a line that does not contain the caret or active selection
- **THEN** the editor hides its brackets, parentheses, and destination, presents only the label in semantic link-blue, and exposes the safe underlying destination as an actionable link

#### Scenario: Edit a Markdown link source
- **WHEN** the caret or active selection enters a line containing `[label](destination)` source
- **THEN** the editor reveals the complete source with muted fixed-width bracket and parenthesis indicators, ordinary foreground label text, and semantic link-blue destination text without navigating from an ordinary editing click

#### Scenario: Limit live Markdown recognition
- **WHEN** notes contain supported Markdown syntax
- **THEN** the editor recognizes headings introduced by one or more hashmarks and a space, single-asterisk italic, double-asterisk bold, asterisk-plus-space bullets, hyphen-plus-space bullets, Markdown links, and single-backtick inline code while treating other Markdown constructs as ordinary text

#### Scenario: Style visible Markdown indicators
- **WHEN** the editor reveals a heading, italic, bold, bullet, Markdown link, or inline-code delimiter on an active source line
- **THEN** the original hashmark-and-space, asterisk, hyphen-and-space, bracket, parenthesis, and backtick indicators remain visible in a fixed-width muted-foreground style while the marked content retains its recognized heading, italic, bold, bullet, link, or code presentation

#### Scenario: Style inline code completely
- **WHEN** the editor reveals source text enclosed by single backticks on one active line
- **THEN** the complete string uses a fixed-width font and a light semantic background while both backticks use the muted indicator color

#### Scenario: Continue a Markdown bullet
- **WHEN** a user presses Enter without Shift while editing a line that begins with `* ` or `- `
- **THEN** the editor inserts a new line beginning with the same two-character marker and wraps each bullet with a two-fixed-width-character hanging indent

#### Scenario: Follow an inactive note link
- **WHEN** an inactive line contains a Markdown link, bare HTTP(S) URL, or bare alphanumeric `scheme://` destination such as `message://`
- **THEN** the live editor exposes the safe destination with a pointer cursor and no hover underline, opens HTTP(S) in a new browser context, dispatches `message://` to Mail, and keeps known executable or content-injection schemes inert

#### Scenario: Preserve editing mechanics while styling
- **WHEN** the editor retokenizes changed source or changes which lines expose source
- **THEN** it preserves the user's caret or selection by exact source offset and direction, defers decoration during composition, accepts pasted content as plain text, yields documented undo and redo commands to Tasks, and autosaves the identical source to the same notes field

#### Scenario: Present unfocused notes semantically
- **WHEN** the Notes control does not own the caret or an active selection
- **THEN** every nonempty line uses its semantic inactive presentation while the same live editor remains available for direct activation and editing

#### Scenario: Start empty notes directly
- **WHEN** an expanded to-do has empty notes
- **THEN** the same live editor presents its placeholder without requiring a separate preview step
