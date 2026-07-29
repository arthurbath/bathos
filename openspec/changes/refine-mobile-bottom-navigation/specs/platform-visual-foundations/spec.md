## MODIFIED Requirements

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
