# Platform Visual Foundations Specification

## Purpose

Define BathOS application surfaces, shared mobile navigation geometry, and platform-wide icon conventions.
## Requirements
### Requirement: BathOS uses one continuous dark application surface
BathOS SHALL use the application background color for the document root, React root, application shell, platform top navigation, and card surfaces so initial loading and transitions do not expose a light or contrasting intermediate background.

#### Scenario: Load before React mounts
- **WHEN** a BathOS route begins loading before React has mounted
- **THEN** the browser or installed WebView shows the same dark application background used by the mounted module

#### Scenario: Move between card and full-view layouts
- **WHEN** a user navigates between card-based and full-view module layouts
- **THEN** the platform header, page surface, and card backgrounds remain one continuous application background color

### Requirement: Mobile modules use shared floating-pill navigation
BathOS SHALL present the shared mobile bottom navigation as a fully rounded, subtly translucent floating outer pill with a low-contrast border and backdrop blur, containing smaller rounded navigation destinations with the active destination visibly filled, complete safe-area clearance, and unchanged link semantics.

#### Scenario: Render a mobile module navigation
- **WHEN** a module supplies destinations to the shared mobile navigation
- **THEN** the destinations appear inside a complete pill with no flat side edges, inset from the viewport edges and safe area rather than inside a full-width bottom bar

#### Scenario: Preserve restrained depth over content
- **WHEN** page content passes beneath the floating mobile navigation
- **THEN** the navigation retains an opaque-enough semantic dark surface for legibility while slight translucency and backdrop blur softly obscure the underlying content and its border blends into that surface

#### Scenario: Activate and open navigation destinations
- **WHEN** a user taps, keyboard-activates, modified-clicks, or middle-clicks a mobile navigation destination
- **THEN** the destination preserves the established route and browser link behavior while its active state uses the nested-pill treatment
- **AND** the equal-width destinations have no inter-item gap so the longest persistent label receives the maximum horizontal breathing room without widening or overflowing the outer navigation pill

#### Scenario: Present mobile destination feedback
- **WHEN** the shared mobile navigation presents inactive destinations
- **THEN** it does not apply a pointer-hover color treatment
- **AND** active and keyboard focus-visible feedback remain available

### Requirement: Generic external-link actions use canonical iconography
BathOS SHALL use Lucide `ExternalLink` for a generic icon action that opens an external destination and SHALL preserve an established protocol-specific icon when the destination's protocol conveys more useful meaning.

#### Scenario: Open a generic web destination
- **WHEN** an icon-only or icon-bearing action opens a generic external web destination
- **THEN** the action uses Lucide `ExternalLink` or its documented native-platform equivalent

#### Scenario: Open a protocol-specific destination
- **WHEN** an action opens a recognized protocol-specific destination such as a Mail message
- **THEN** the action may retain the established protocol-specific icon instead of generic `ExternalLink`

### Requirement: BathOS presents compact toasts from the bottom
BathOS SHALL present every shared toast system from the bottom of the viewport with compact internal padding and consistent responsive placement rather than obscuring primary content at the top of the active view.

#### Scenario: Present a toast on a mobile view with navigation
- **WHEN** a toast appears while the shared floating mobile navigation is visible
- **THEN** the toast stack appears above the navigation with device-safe-area clearance
- **AND** the mobile navigation remains layered above the toast stack

#### Scenario: Present a toast on a wider view
- **WHEN** a toast appears at a tablet or desktop width
- **THEN** the toast stack appears at the bottom-right aligned with the inner right edge of the shared bounded content area

#### Scenario: Animate a toast
- **WHEN** motion preferences permit a toast to enter or leave
- **THEN** its motion originates from or returns toward the bottom edge associated with its placement

#### Scenario: Render either shared toast system
- **WHEN** BathOS presents an application toast or a network/system error toast
- **THEN** both systems follow the same bottom placement, compact spacing, and layering contract

### Requirement: Ordinary inputs use a solid muted outline
BathOS SHALL render ordinary non-DataGrid text inputs, textareas, selects, date triggers, and equivalent single-line form controls with one solid muted-gray outline whose contrast is lower than the active keyboard-focus treatment.

#### Scenario: Render an unfocused ordinary input
- **WHEN** an ordinary input is visible outside a DataGrid
- **THEN** it has the shared solid muted-gray outline and no component-specific bright white border

#### Scenario: Focus an ordinary input
- **WHEN** keyboard or pointer interaction focuses the ordinary input
- **THEN** the shared focus treatment is clearly distinguishable from the persistent muted outline

#### Scenario: Render a DataGrid editor
- **WHEN** a DataGrid cell control is neither focused nor actively edited
- **THEN** the ordinary persistent outline convention does not add a border to that grid control
