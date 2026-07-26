## ADDED Requirements

### Requirement: Uniform Task List Bottom Clearance
The Tasks module SHALL reserve one consistent responsive bottom clearance across every Tasks view and selection state so fixed lower-viewport controls cannot cover the final task or project when the user reaches the end of a list.

#### Scenario: Preserve clearance outside selection mode
- **WHEN** a user scrolls to the end of any Tasks view without bulk selection active
- **THEN** the final list content can move completely above the floating creation control, mobile navigation, and safe-area boundary

#### Scenario: Preserve the same clearance during selection mode
- **WHEN** bulk selection activates or deactivates
- **THEN** the Tasks view retains the same responsive bottom clearance while the floating selection toolbar appears or disappears

#### Scenario: Apply clearance to every Tasks view
- **WHEN** a user navigates among planning, Done, Search, Config, Templates, area, or project views
- **THEN** each view uses the same responsive list-end clearance regardless of whether it currently presents a floating creation or selection control

## MODIFIED Requirements

### Requirement: Continuous Task Editor Disclosure
The Tasks module SHALL reveal and conceal an expanded task editor as one continuous disclosure without a secondary spacing expansion while preserving ordinary layout space between the summary row and the first visible metadata field.

#### Scenario: Open an editor as one fluid motion
- **WHEN** a user opens a task and reduced motion is not requested
- **THEN** the editor row, opacity, and ordinary Title inset expand concurrently through one shared transition without a delayed or separately visible spacing step

#### Scenario: Keep the expanded editor compact
- **WHEN** a task editor is fully expanded
- **THEN** its title input begins after six pixels of ordinary top padding while the form retains its established horizontal inset, bottom padding, and 12-pixel spacing between visible fields

#### Scenario: Preserve the Title focus ring
- **WHEN** the Title input receives focus in an expanded task editor
- **THEN** its complete focus ring paints inside the disclosure's reserved layout space without being clipped by an inner overflow boundary

#### Scenario: Ignore nonvisual labels in field spacing
- **WHEN** an accessible label is visually hidden before the title input
- **THEN** that label does not introduce layout space beyond the explicit Title inset

#### Scenario: Preserve reduced-motion behavior
- **WHEN** the operating system requests reduced motion
- **THEN** the editor appears or disappears without a disclosure transition while retaining the same ordinary Title inset and complete focus ring
