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
