## ADDED Requirements

### Requirement: Native new-task capture presents visible Summary editing focus
Tasks SHALL visibly identify the Summary field and insertion point while a declared native host's keyboard bridge accepts initial new-task typing.

#### Scenario: Begin a new task from a native creation action
- **WHEN** a native creation action opens a blank task and the native keyboard bridge accepts Summary input
- **THEN** the Summary input displays the standard focused border and ring
- **AND** a visible caret appears at the end of the current Summary value while mirrored typing continues to update that field

#### Scenario: Enter ordinary WebKit editing
- **WHEN** the user directly taps the Summary input after native capture begins
- **THEN** the synthetic native-capture focus presentation ends and WebKit presents its ordinary text cursor and focus state

### Requirement: Open tasks use one darker editor surface
Tasks SHALL present the summary row and metadata drawer of an open task as one continuous semantic surface that remains darker than the shared floating mobile navigation.

#### Scenario: Open a task beneath mobile navigation
- **WHEN** a task editor is open and the floating mobile navigation overlaps its viewport area
- **THEN** the task summary and metadata drawer share the same darker background
- **AND** the lighter translucent navigation remains visually distinct above the task

#### Scenario: Preserve closed and selected task treatments
- **WHEN** a task is closed, keyboard-focused, or selected for bulk actions
- **THEN** Tasks retains the established closed, focus, and selection treatments rather than applying the open-editor surface
