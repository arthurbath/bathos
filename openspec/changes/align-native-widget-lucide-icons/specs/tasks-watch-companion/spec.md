## ADDED Requirements

### Requirement: Canonical Lucide Complication Mark
The Tasks watch complication SHALL use the canonical Lucide checkmark geometry as the center mark of the Today progress ring.

#### Scenario: Render Today progress
- **WHEN** watchOS renders the Today progress complication at any supported progress fraction
- **THEN** the ring retains its existing progress meaning and contains the canonical Lucide checkmark rather than a platform-symbol substitute

#### Scenario: Apply complication rendering mode
- **WHEN** watchOS renders the complication in its active monochrome or accented mode
- **THEN** the custom checkmark accepts the platform tint without losing its Lucide geometry
