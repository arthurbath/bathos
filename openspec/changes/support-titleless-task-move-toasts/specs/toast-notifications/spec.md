## ADDED Requirements

### Requirement: Titleless Content Toasts
BathOS SHALL allow shared toast notifications to present meaningful description content without a title and SHALL render that content without reserving an empty title region.

#### Scenario: Render one concise content line
- **WHEN** a caller creates a shared toast with one short description and no title
- **THEN** BathOS renders the description as the toast's only text block, retains balanced compact outer padding, and displays no empty title element or title-to-description gap

#### Scenario: Time titleless content normally
- **WHEN** a titleless toast's description is estimated to occupy one visible line
- **THEN** BathOS displays the toast for 1,000 ms under the shared content-proportional duration policy

#### Scenario: Preserve shared toast behavior
- **WHEN** a titleless toast is visible
- **THEN** it retains the shared semantic variant, close control, placement, motion, and interaction behavior
