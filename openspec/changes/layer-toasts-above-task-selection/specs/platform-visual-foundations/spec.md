## MODIFIED Requirements

### Requirement: BathOS presents compact toasts from the bottom
BathOS SHALL present every shared toast system from the bottom of the viewport with compact internal padding and consistent responsive placement rather than obscuring primary content at the top of the active view.

#### Scenario: Present a toast on a mobile view with navigation
- **WHEN** a toast appears while the shared floating mobile navigation is visible
- **THEN** the toast stack appears above the navigation with device-safe-area clearance
- **AND** the mobile navigation remains layered above the toast stack

#### Scenario: Present a toast during task selection mode
- **WHEN** a toast appears while the fixed Tasks selection-mode bar is visible
- **THEN** the toast remains visually layered above the selection-mode bar
- **AND** the mobile navigation remains layered above the toast stack when it is present

#### Scenario: Present a toast on a wider view
- **WHEN** a toast appears at a tablet or desktop width
- **THEN** the toast stack appears at the bottom-right aligned with the inner right edge of the shared bounded content area

#### Scenario: Animate a toast
- **WHEN** motion preferences permit a toast to enter or leave
- **THEN** its motion originates from or returns toward the bottom edge associated with its placement

#### Scenario: Render either shared toast system
- **WHEN** BathOS presents an application toast or a network/system error toast
- **THEN** both systems follow the same bottom placement, compact spacing, and layering contract
