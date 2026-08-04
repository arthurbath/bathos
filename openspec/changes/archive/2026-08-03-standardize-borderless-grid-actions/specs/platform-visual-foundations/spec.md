## ADDED Requirements

### Requirement: Borderless Buttons Provide a Canonical Low-Noise Action Treatment
BathOS SHALL expose a canonical Borderless button treatment through the shared button primitive. A Borderless button SHALL rest without a visible outline or contrasting background, SHALL inherit an appropriate foreground color for its context, and SHALL retain the shared disabled and keyboard-focus treatments. The Admin UI Testing showcase SHALL display the Borderless button in enabled and disabled states.

#### Scenario: Render a borderless action
- **WHEN** a surface renders a low-noise action using the shared Borderless button treatment
- **THEN** the control has no visible resting border or contrasting fill and remains visibly focusable from the keyboard

#### Scenario: Inspect shared button variants
- **WHEN** an administrator views the Button Variants section of the Admin UI Testing card
- **THEN** the showcase includes enabled and disabled Borderless examples

### Requirement: DataGrid Row Actions Use the Borderless Button Treatment
Every trailing DataGrid row-action ellipsis trigger SHALL use the shared Borderless button treatment while preserving the shared action-column dimensions, right-edge spacing, accessible name, keyboard navigation, focus treatment, and dropdown behavior.

#### Scenario: View DataGrid row actions
- **WHEN** a DataGrid row exposes an ellipsis action trigger
- **THEN** the ellipsis appears without a visible resting button border or contrasting fill

#### Scenario: Navigate to DataGrid row actions
- **WHEN** keyboard traversal focuses a DataGrid ellipsis action trigger and the user activates it
- **THEN** the standard focus treatment remains visible and the row-action menu opens with its established keyboard behavior
