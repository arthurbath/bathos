## ADDED Requirements

### Requirement: Task Modal Footer Discipline
Tasks dialogs SHALL render a footer only when the footer contains meaningful actions or information. A Tasks dialog with only a header and body SHALL omit redundant Escape guidance, the empty footer track, the footer chin, and the body’s bottom divider.

#### Scenario: Present a footerless informational or command dialog
- **WHEN** a Tasks dialog contains no footer actions or footer information
- **THEN** the dialog contains only its header and body, and the body reaches the rounded bottom edge without an empty chin or bottom divider

#### Scenario: Omit redundant Escape guidance
- **WHEN** any Tasks modal is rendered
- **THEN** it does not display “Escape Closes” or equivalent visible guidance

#### Scenario: Preserve a meaningful footer
- **WHEN** a Tasks modal provides Save, Cancel, Close, confirmation, or another explicit footer action
- **THEN** that action-bearing footer remains visible and operable

## MODIFIED Requirements

### Requirement: Shared Task Editor Form Commands
The Tasks expanded to-do editor SHALL act as an autosaving form scope under the shared BathOS form-control interaction contract. Its documented close commands SHALL flush pending valid autosave and close the editor because accepted task changes cannot be canceled retroactively.

#### Scenario: Close a task with the form-submit command
- **WHEN** a task editor is open and the user presses Command+Return on Mac or Control+Return on Windows outside active composition
- **THEN** Tasks suppresses the matching browser action, flushes pending autosave, closes the editor from any focused task field, and commits deferred completion through the ordinary close path

#### Scenario: Close a task with the alternate Mac form command
- **WHEN** a task editor is open and the user presses Command+Escape on Mac outside active composition
- **THEN** Tasks suppresses the matching browser action, flushes pending autosave, closes the editor from any focused task field, and commits deferred completion without claiming to revert accepted edits

#### Scenario: Keep plain Escape field-local
- **WHEN** a task editor is open and the user presses unmodified Escape
- **THEN** the deepest open task field layer may cancel or revert itself, but the task editor remains open when no field layer owns Escape

#### Scenario: Discard an untitled task draft on form close
- **WHEN** either task form command closes a draft whose title never became nonblank
- **THEN** Tasks removes the local draft without creating synchronized work, history, sources, reminders, or a success toast

#### Scenario: Present the revised close commands
- **WHEN** the user opens Keyboard Commands
- **THEN** the close action shows `⌘Return`, `⌘Escape`, or `⌃Q` on Mac and `⌃Return` or `⌃⇧Q` on Windows, and it does not promise that Windows Control+Escape can override the operating system

### Requirement: Cross-Platform Task Interaction Reference
The system SHALL present a visible interaction reference that documents the complete supported Tasks keyboard and pointer-selection contract for both Mac and Windows using compact, platform-recognizable key notation without plus signs between modifiers and keys.

#### Scenario: Compare platform commands
- **WHEN** the user opens Keyboard Commands
- **THEN** the interface shows Action, Mac, and Windows columns simultaneously and identifies the current platform when the runtime can detect it

#### Scenario: Show compact key notation
- **WHEN** the interaction reference renders a modifier, key, directional arrow, or pointer gesture
- **THEN** it concatenates the corresponding symbols and capitalized key or gesture name directly without inserting a plus sign, and renders the chord in the regular interface typeface at the table's normal text size

#### Scenario: Focus the command reference without decorating the container
- **WHEN** Keyboard Commands opens or its non-interactive dialog container receives focus
- **THEN** the container does not display an outline, focus ring, or focus shadow, while interactive descendants retain their ordinary focus indicators

#### Scenario: Discover the replacement keyboard map
- **WHEN** the interaction reference is open
- **THEN** it documents Command 1 through Command 6 view navigation on Mac, Control 1 through Control 6 navigation on Windows, the platform keyboard-help shortcut, every current application command, every current Tasks-specific metadata and traversal command, and pointer selection gestures
- **THEN** it does not list superseded Control-letter view navigation, removed aliases, Find, Projects, Templates, keyboard reordering, toggle-after-selection, or direct-reordering guidance

#### Scenario: Open Keyboard Commands by shortcut
- **WHEN** the user presses Command+/ on Mac or Control+/ on Windows outside active composition while Tasks is mounted
- **THEN** Tasks suppresses the matching browser action and opens Keyboard Commands even when a task text field is active

#### Scenario: Keep help discoverable on Config
- **WHEN** the user views Config
- **THEN** the interface presents a visible platform-aware cue that the slash chord opens the list of all keyboard commands

#### Scenario: Omit the persistent header trigger
- **WHEN** the Tasks persistent header renders
- **THEN** it does not contain a Keyboard Commands question-mark button

#### Scenario: Keep obsolete help aliases unbound
- **WHEN** the user presses bare `/`, bare `?`, Command+Shift+/, or an undocumented historical help chord
- **THEN** Tasks does not open Keyboard Commands or claim that chord

#### Scenario: Preserve commands outside supported contexts
- **WHEN** a chord is not documented for the active platform and context, an active composition owns input, or the browser or operating system consumes an event before it reaches Tasks
- **THEN** the reference does not imply that Tasks overrides that native or unavailable behavior
