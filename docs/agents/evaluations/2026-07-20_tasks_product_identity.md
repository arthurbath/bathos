# Tasks Product Identity

**Date:** 2026 Jul 20
**Status:** Decided and implemented

## Decision

The permanent user-facing module name is `Tasks`. The launcher uses Lucide `SquareCheckBig`, a check mark in a square box. The PWA icon is the same mark in BathOS's standard monochrome icon treatment.

The route, source path, database namespace, and internal module identifier remain `/tasks`, `src/modules/tasks`, `tasks_`, and `tasks`.

## Rationale

BathOS modules are named directly for what they do, following the same straightforward grammar as Calendar, Reminders, Mail, Budget, Garage, and Wardrobe. `Tasks` tells the user exactly what the module is without asking a private utility to carry a separate metaphorical identity.

The module does not need custom imagery or visual distinction for its own sake. A familiar Lucide square-check icon is simple, honest, legible, and consistent with the rest of BathOS. Originality remains important in the implementation's copy and detailed interactions so the module honors Things without impersonating it.

## Superseded Exploration

The initial evaluation recommended `Aplomb` with a plumb-line symbol and retained `Forth` and `Espalier` as alternatives. That exploration optimized for a distinctive standalone product identity. The owner rejected that premise in favor of BathOS's established direct naming convention, so those recommendations are superseded.

The earlier availability screen also found task or adjacent-product collisions for `Docket`, `Tend`, `Helm`, `Keel`, `Slate`, `Morrow`, `Bearing`, and `Waypost`. Those findings no longer affect the private module name. If public App Store distribution becomes likely, store presentation and availability should receive a fresh review without presuming that the product needs a metaphorical name.

## Implementation

- Register `Tasks` in the BathOS launcher after `Snake` and before `Wardrobe`
- Use Lucide `SquareCheckBig` in the launcher
- Use a matching monochrome square-check asset for PWA, favicon, and Apple touch metadata
- Keep `/tasks/today` as the launch and install start path
- Keep `/tasks` as the stable PWA manifest identifier
