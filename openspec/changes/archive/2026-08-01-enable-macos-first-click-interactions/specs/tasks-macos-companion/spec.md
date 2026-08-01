## ADDED Requirements

### Requirement: Native macOS First-Pointer Delivery
The native macOS Tasks companion SHALL allow a pointer press over its hosted Tasks web surface to activate an inactive Tasks window and reach the intended web interaction as the same pointer sequence.

#### Scenario: Activate a control with the first click
- **WHEN** the Tasks window is visible but inactive and the user clicks an interactive element in the hosted Tasks surface
- **THEN** the window becomes active and the element receives that initial click without requiring a second click

#### Scenario: Begin dragging with the first press
- **WHEN** the Tasks window is visible but inactive and the user presses and drags an eligible task or checklist item
- **THEN** the window becomes active and the hosted Tasks surface receives the original pointer sequence so its existing drag interaction can begin without a second attempt

#### Scenario: Preserve ordinary active-window interaction
- **WHEN** the Tasks window is already active
- **THEN** clicks, text selection, controls, and drag gestures retain their existing WebKit behavior without duplicated or synthetic events
