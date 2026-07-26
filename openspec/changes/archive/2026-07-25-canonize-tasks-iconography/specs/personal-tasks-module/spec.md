## ADDED Requirements

### Requirement: Canonical Tasks Iconography
The Tasks module SHALL maintain and consistently reuse a documented Lucide icon for every established Tasks product concept, while preserving accessible text or programmatic names independently from the icon.

#### Scenario: Use canonical entity icons
- **WHEN** Tasks represents a Task, Project, Area, combined Areas & Projects, Task Checklist, or Attachment concept with an icon
- **THEN** it uses Lucide `SquareCheckBig`, `CopyCheck`, `Layers3` (the Stack glyph), `Layers3` (the Stack glyph), `ListTree`, or `Paperclip`, respectively

#### Scenario: Use canonical lifecycle view icons
- **WHEN** Tasks represents Someday or Done with an icon
- **THEN** it uses Lucide `SquareDashed` or `ListChecks`, respectively

#### Scenario: Use canonical creation icons
- **WHEN** Tasks presents an icon for Add Task, Add Project, or Add Area
- **THEN** it uses Lucide `SquarePlus`, `Layers3` (the Stack glyph), or `SquarePlus`, respectively

#### Scenario: Preserve approved existing concepts
- **WHEN** Tasks renders an established concept that is not explicitly overridden
- **THEN** it uses the canonical Lucide component recorded in the Tasks iconography reference rather than choosing a new icon independently at the rendering site

#### Scenario: Reuse one concept across surfaces
- **WHEN** one established Tasks concept appears in navigation, search, a list, a picker, a dialog, or another module surface
- **THEN** every occurrence uses the same canonical icon unless the iconography reference explicitly defines a distinct action concept

#### Scenario: Keep icon meaning accessible
- **WHEN** a canonical icon appears without adjacent visible text
- **THEN** its control or containing semantic element retains a nonempty accessible name that communicates the concept without requiring icon recognition
