## MODIFIED Requirements

### Requirement: Continuous Task Editor Disclosure
The Tasks module SHALL reveal and conceal an expanded task editor as one continuous disclosure without a secondary spacing expansion while preserving a small fixed inset between the summary row and the first visible metadata field. The fixed inset MUST NOT increase the animated disclosure's intrinsic layout height.

#### Scenario: Open an editor as one fluid motion
- **WHEN** a user opens a task and reduced motion is not requested
- **THEN** the editor expands through one disclosure transition while its fixed Title inset remains visually constant and outside the animated layout-height calculation

#### Scenario: Keep the expanded editor compact
- **WHEN** a task editor is fully expanded
- **THEN** its title input begins after a four-pixel visual inset while the form retains its established horizontal inset, bottom padding, and 12-pixel spacing between visible fields

#### Scenario: Ignore nonvisual labels in field spacing
- **WHEN** an accessible label is visually hidden before the title input
- **THEN** that label does not introduce layout space beyond the explicit fixed Title inset

#### Scenario: Preserve reduced-motion behavior
- **WHEN** the operating system requests reduced motion
- **THEN** the editor appears or disappears without a disclosure transition while retaining the same fixed Title inset
