## MODIFIED Requirements

### Requirement: Single-line Return submits ordinary forms
Unmodified Return in an ordinary single-line text-entry control SHALL submit its nearest owning form by default outside active composition. Textareas and field-owned composite or list-editor interactions SHALL retain Return for their native or declared field behavior, Command+Return SHALL remain available for form submission, and an exceptional form MAY explicitly opt out of unmodified Return submission.

#### Scenario: Submit an ordinary form
- **WHEN** a user presses unmodified Return in a single-line text-entry control whose field does not own Return and whose form has not opted out
- **THEN** BathOS submits the nearest form through the same validation-aware path as its visible submit action

#### Scenario: Preserve multiline Return
- **WHEN** a user presses Return in a textarea or another multiline text-entry surface
- **THEN** the control retains its native newline behavior and does not submit the form

#### Scenario: Preserve composite Return
- **WHEN** a user presses Return on or within a dropdown, date picker, time parser, checklist list editor, or another control that explicitly owns Return
- **THEN** the field performs its declared open, selection, parsing, row-creation, or confirmation action without submitting the form

#### Scenario: Preserve explicit form command
- **WHEN** a user invokes the platform form-submit command from within a declared form scope
- **THEN** BathOS submits that form through the same validation-aware path regardless of which descendant control is focused

#### Scenario: Opt out an exceptional form
- **WHEN** a form explicitly declares that unmodified Return does not submit and a user presses Return in one of its single-line text-entry controls
- **THEN** BathOS prevents implicit submission while preserving the input value and focus
