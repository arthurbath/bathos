## ADDED Requirements

### Requirement: BathOS uses one continuous dark application surface
BathOS SHALL use the application background color for the document root, React root, application shell, platform top navigation, and card surfaces so initial loading and transitions do not expose a light or contrasting intermediate background.

#### Scenario: Load before React mounts
- **WHEN** a BathOS route begins loading before React has mounted
- **THEN** the browser or installed WebView shows the same dark application background used by the mounted module

#### Scenario: Move between card and full-view layouts
- **WHEN** a user navigates between card-based and full-view module layouts
- **THEN** the platform header, page surface, and card backgrounds remain one continuous application background color

### Requirement: Mobile modules use shared floating-pill navigation
BathOS SHALL present the shared mobile bottom navigation as an opaque floating rounded outer pill containing smaller rounded navigation destinations, with the active destination visibly filled, complete safe-area clearance, and unchanged link semantics.

#### Scenario: Render a mobile module navigation
- **WHEN** a module supplies destinations to the shared mobile navigation
- **THEN** the destinations appear inside a floating pill inset from the viewport edges and safe area rather than inside a full-width bottom bar

#### Scenario: Activate and open navigation destinations
- **WHEN** a user taps, keyboard-activates, modified-clicks, or middle-clicks a mobile navigation destination
- **THEN** the destination preserves the established route and browser link behavior while its active state uses the nested-pill treatment

### Requirement: Generic external-link actions use canonical iconography
BathOS SHALL use Lucide `ExternalLink` for a generic icon action that opens an external destination and SHALL preserve an established protocol-specific icon when the destination's protocol conveys more useful meaning.

#### Scenario: Open a generic web destination
- **WHEN** an icon-only or icon-bearing action opens a generic external web destination
- **THEN** the action uses Lucide `ExternalLink` or its documented native-platform equivalent

#### Scenario: Open a protocol-specific destination
- **WHEN** an action opens a recognized protocol-specific destination such as a Mail message
- **THEN** the action may retain the established protocol-specific icon instead of generic `ExternalLink`
