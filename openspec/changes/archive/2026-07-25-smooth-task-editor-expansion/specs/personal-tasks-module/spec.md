## ADDED Requirements

### Requirement: Continuous Task Editor Disclosure
The Tasks module SHALL reveal and conceal an expanded task editor as one continuous disclosure without a secondary spacing expansion at the top of the metadata form.

#### Scenario: Open an editor as one fluid motion
- **WHEN** a user opens a task and reduced motion is not requested
- **THEN** the editor expands through the existing disclosure transition without a delayed or separately visible top inset

#### Scenario: Keep the expanded editor compact
- **WHEN** a task editor is fully expanded
- **THEN** its form has no extra top padding while retaining its established horizontal inset, bottom padding, and inter-field spacing

#### Scenario: Preserve reduced-motion behavior
- **WHEN** the operating system requests reduced motion
- **THEN** the editor appears or disappears without a disclosure transition and without introducing a top inset
