## MODIFIED Requirements

### Requirement: Continuous Task Editor Disclosure
The Tasks module SHALL reveal and conceal an expanded task editor as one continuous disclosure without a secondary spacing expansion or persistent empty gap between the summary row and the first visible metadata field.

#### Scenario: Open an editor as one fluid motion
- **WHEN** a user opens a task and reduced motion is not requested
- **THEN** the editor expands through the existing disclosure transition without a delayed or separately visible top inset

#### Scenario: Keep the expanded editor compact
- **WHEN** a task editor is fully expanded
- **THEN** its title input begins at the editor region's top edge with no computed top padding or margin while the form retains its established horizontal inset, bottom padding, and 12-pixel spacing between visible fields

#### Scenario: Ignore nonvisual labels in field spacing
- **WHEN** an accessible label is visually hidden before the title input
- **THEN** that label does not introduce layout space between the summary row and title input

#### Scenario: Preserve reduced-motion behavior
- **WHEN** the operating system requests reduced motion
- **THEN** the editor appears or disappears without a disclosure transition and without introducing a top inset or title gap
