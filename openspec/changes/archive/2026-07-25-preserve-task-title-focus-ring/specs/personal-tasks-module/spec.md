## MODIFIED Requirements

### Requirement: Continuous Task Editor Disclosure
The Tasks module SHALL reveal and conceal an expanded task editor as one continuous disclosure without a secondary spacing expansion while preserving ordinary layout space between the summary row and the first visible metadata field.

#### Scenario: Open an editor as one fluid motion
- **WHEN** a user opens a task and reduced motion is not requested
- **THEN** the editor row, opacity, and ordinary Title inset expand concurrently through one shared transition without a delayed or separately visible spacing step

#### Scenario: Keep the expanded editor compact
- **WHEN** a task editor is fully expanded
- **THEN** its title input begins after four pixels of ordinary top padding while the form retains its established horizontal inset, bottom padding, and 12-pixel spacing between visible fields

#### Scenario: Preserve the Title focus ring
- **WHEN** the Title input receives focus in an expanded task editor
- **THEN** its complete focus ring paints inside the disclosure's reserved layout space without being clipped by an inner overflow boundary

#### Scenario: Ignore nonvisual labels in field spacing
- **WHEN** an accessible label is visually hidden before the title input
- **THEN** that label does not introduce layout space beyond the explicit Title inset

#### Scenario: Preserve reduced-motion behavior
- **WHEN** the operating system requests reduced motion
- **THEN** the editor appears or disappears without a disclosure transition while retaining the same ordinary Title inset and complete focus ring
