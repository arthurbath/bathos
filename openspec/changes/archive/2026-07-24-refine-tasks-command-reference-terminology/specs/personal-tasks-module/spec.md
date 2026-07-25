## ADDED Requirements

### Requirement: Canonical Tasks Language
The Tasks module SHALL use "task" for its work items, "Deadline" for their final acceptable date, and "Task's Start" for their planning-start control in user-facing copy and accessible names.

#### Scenario: Present task terminology
- **WHEN** the interface labels, counts, searches, or describes work items
- **THEN** it calls them tasks rather than to-dos

#### Scenario: Present planning terminology
- **WHEN** the interface labels or describes a task's temporal planning controls
- **THEN** it calls the planning-start control "Task's Start" and the final acceptable date "Deadline" without presenting "Start Date" or "Due Date"

### Requirement: Task Row Keyboard Reordering Is Deferred
The Tasks module SHALL NOT advertise or execute a dedicated task-row keyboard-reordering command until a later interaction contract explicitly introduces one.

#### Scenario: Leave former keyboard reorder chords unclaimed
- **WHEN** focus is on a task title and the user presses Option plus an arrow key on Mac or Alt plus an arrow key on Windows
- **THEN** Tasks does not reorder the task or advertise that chord as a task-row shortcut

#### Scenario: Preserve pointer drag reordering
- **WHEN** the current list supports pointer drag reordering
- **THEN** removing keyboard reordering does not remove or alter the existing pointer drag behavior

## MODIFIED Requirements

### Requirement: Cross-Platform Task Interaction Reference
The system SHALL present a visible interaction reference that documents the complete supported Tasks keyboard and pointer-selection contract for both Mac and Windows using compact, platform-recognizable key notation.

#### Scenario: Compare platform commands
- **WHEN** the user opens Keyboard Commands
- **THEN** the interface shows Action, Mac, and Windows columns simultaneously and identifies the current platform when the runtime can detect it

#### Scenario: Show compact key notation
- **WHEN** the interaction reference renders a modifier or directional arrow key
- **THEN** it uses the corresponding modifier symbol or up/down triangle while capitalizing every key or gesture name that must be written out

#### Scenario: Discover direct list interactions
- **WHEN** the interaction reference is open
- **THEN** it documents task undo and redo, selection, Copy, Cut, Paste, Duplicate, task creation, task traversal, task editing, direct view navigation, and pointer selection gestures without listing removed Find, Projects, Templates, keyboard-reordering, toggle-after-selection, or direct-reordering guidance

#### Scenario: Preserve commands outside supported contexts
- **WHEN** a chord is not documented for the active platform and context, an active composition owns input, or the browser or operating system consumes an event before it reaches Tasks
- **THEN** the reference does not imply that Tasks overrides that native or unavailable behavior
