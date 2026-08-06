## ADDED Requirements

### Requirement: Shared switch thumbs have balanced endpoint insets
BathOS SHALL position the shared switch thumb with an intentional one-pixel inset from the adjacent track edge in both unchecked and checked states.

#### Scenario: Render an unchecked switch
- **WHEN** the shared switch is unchecked
- **THEN** its thumb is inset one pixel from the left endpoint rather than sitting flush against it

#### Scenario: Render a checked switch
- **WHEN** the shared switch is checked
- **THEN** its thumb is positioned one pixel closer to the right endpoint than the previous checked treatment
- **AND** the shared track dimensions, semantic colors, and keyboard-focus treatment remain unchanged

## MODIFIED Requirements

### Requirement: BathOS presents compact toasts from the bottom
BathOS SHALL present every shared toast system from the bottom of the viewport with compact internal padding and consistent responsive placement rather than obscuring primary content at the top of the active view.

#### Scenario: Present a toast on a mobile view with navigation
- **WHEN** a toast appears while the shared floating mobile navigation is visible
- **THEN** the toast stack appears above the navigation with device-safe-area clearance
- **AND** the mobile navigation remains layered above the toast stack

#### Scenario: Present a toast on a wider view
- **WHEN** a toast appears at a tablet or desktop width
- **THEN** the toast stack appears at the bottom-right of the viewport with the shared window-edge inset
- **AND** its right edge is not constrained by the shared bounded content width

#### Scenario: Animate a toast
- **WHEN** motion preferences permit a toast to enter or leave
- **THEN** its motion originates from or returns toward the bottom edge associated with its placement

#### Scenario: Render either shared toast system
- **WHEN** BathOS presents an application toast or a network/system error toast
- **THEN** both systems follow the same bottom placement, compact spacing, and layering contract
