## MODIFIED Requirements

### Requirement: Bulk Task Drag Group
On Today, Upcoming, Anytime, and Someday, the system SHALL allow a pointer drag that begins on a selected task to move the complete current task selection. The system SHALL derive group order from the tasks' current visual order rather than selection order and SHALL close a different open task through the safe autosave boundary when dragging begins.

#### Scenario: Close another open task when dragging begins
- **WHEN** one task is open and the user begins dragging a different task on Today, Upcoming, Anytime, or Someday
- **THEN** Tasks safely flushes pending edits, closes the open task without redirecting focus to it, and continues the native drag with the reclaimed list space

#### Scenario: Preserve an editor when safe close fails
- **WHEN** pending edits for the open task cannot be flushed after a drag begins on another task
- **THEN** Tasks preserves the open editor and its unsaved state rather than discarding work
