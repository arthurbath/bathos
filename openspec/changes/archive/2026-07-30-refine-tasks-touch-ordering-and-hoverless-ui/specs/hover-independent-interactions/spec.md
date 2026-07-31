## ADDED Requirements

### Requirement: Hover-Independent BathOS Interaction
BathOS SHALL provide complete information, action discovery, and interaction feedback without requiring pointer hover.

#### Scenario: Use a pointer without hovering
- **WHEN** a user activates a BathOS control by click, tap, keyboard, assistive technology, or another supported input mode
- **THEN** the control remains discoverable and usable without a preceding hover state

#### Scenario: Preserve non-hover state feedback
- **WHEN** a control is keyboard-focused, pressed, open, selected, checked, disabled, invalid, or saving
- **THEN** BathOS retains the applicable non-hover semantic feedback

#### Scenario: Remove decorative hover feedback
- **WHEN** a component previously changed color, opacity, border, text decoration, transform, or visibility only while hovered
- **THEN** that hover-only visual change is absent

#### Scenario: Preserve an essential hover-disclosed action
- **WHEN** a control or information element was previously available only on hover and remains necessary
- **THEN** BathOS presents it persistently or through a deliberate click, tap, keyboard, or assistive-technology action

#### Scenario: Remove redundant hover disclosure
- **WHEN** a hover-disclosed element duplicates information or action already clearly available in the same context
- **THEN** BathOS removes the redundant disclosure without adding persistent clutter

#### Scenario: Keep essential tooltip content reachable
- **WHEN** a tooltip contains information needed to identify or safely operate a control
- **THEN** the same information is available through keyboard focus and deliberate touch or click activation without hover
