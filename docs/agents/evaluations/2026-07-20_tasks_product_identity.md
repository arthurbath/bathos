# Personal Tasks Product Identity

**Date:** 2026 Jul 20
**Status:** Recommendation prepared, owner selection required

## Purpose

Choose an original user-facing name and initial icon direction before the Tasks module enters the BathOS launcher, PWA metadata, or a future Apple bundle. The permanent technical route, source path, database namespace, and internal module identifier remain `tasks` regardless of the public name.

## Criteria

The identity should:

- Feel calm, dependable, and personal rather than managerial or performative
- Fit beside the concrete one-word BathOS names Budget, Drawers, Garage, Snake, and Wardrobe
- Remain legible as a launcher title, browser title, Home Screen label, and possible Apple app name
- Support a simple black-and-white symbol that works as both a Lucide launcher icon and a later original app icon
- Avoid generic tag, priority, hustle, or AI imagery
- Avoid copying Things branding, assets, checkbox treatment, or detailed visual expression
- Leave the neutral `/tasks` route and `tasks_` namespace stable if the user-facing identity changes later

## Recommendation

### Aplomb

`Aplomb` is the strongest candidate. The word appears naturally in the owner's original description of Things and names the outcome the product provides: Calm self-possession when work, time, and attention might otherwise feel disordered. It is memorable without sounding like a conventional productivity brand, and its personal origin gives the name meaning that a generated compound cannot reproduce.

Initial icon direction: A centered plumb-line motif, drawing on the word's older sense of balance and upright alignment rather than a task checkbox. The BathOS launcher can begin with Lucide `Focus`, while a later PWA or Apple icon should use an original vertical line and suspended geometric weight. The mark should remain monochrome and optically centered at small sizes.

Collision screen: Current products use Aplomb for GLP-1 tracking, construction measurement, ballet coaching, etiquette, translation, and broadcast software. The screen found no task-management product using the exact name. This is enough for a private module recommendation, not trademark clearance for public release.

## Alternatives

### Forth

`Forth` expresses forward movement without urgency, scoring, or productivity theater. It is short and strong in compact Apple labels.

Initial icon direction: A single open path moving up and right, using Lucide `MoveUpRight` for the launcher and an original continuous-line mark later.

Trade-off: The name is easily heard as `Fourth`, which is already the name of workforce software with task-management features. It also carries a strong programming-language association.

### Espalier

`Espalier` describes growth trained into a deliberate, supportive structure. It reflects the module's role in turning many sources and personal semantics into an orderly system without reducing the system to a checklist.

Initial icon direction: Three balanced branch points on a light vertical frame, using Lucide `Workflow` provisionally and an original simplified lattice later.

Trade-off: The word is less familiar, harder to spell, and less immediately legible as a task product. An unrelated analytics company currently uses the name.

## Rejected Directions

- `Tend`: Strong stewardship concept, but active farm-management, project, household-task, and recurrence products already use it
- `Docket`: Directly occupied by current GTD task products
- `Helm`, `Keel`, `Slate`, `Morrow`, and `Bearing`: Directly occupied in task, planning, focus, or adjacent productivity categories
- `Waypost`: Strong wayfinding metaphor, but already used by current Apple, roadmap, feature-flag, and AI-operations products
- `Tasks`: Acceptable as a hidden technical label only, not an original product identity

## Decision Boundary

Do not register the module in the launcher or replace provisional Tasks metadata until the owner selects a name and icon direction. If public distribution becomes likely, repeat the availability screen with formal trademark and App Store review before treating any name as commercially clear.

## Sources

- [Aplomb protein tracker](https://useaplomb.com/)
- [Docket task manager](https://apps.apple.com/us/app/docket-task-manager/id6762562443)
- [Tend farm task management](https://www.tend.com/feature/task-management)
- [Helm GTD productivity platform](https://helmtasks.com/)
- [Keel daily planner](https://apps.apple.com/us/app/keel-daily-ai-planner/id6758047689)
- [Slate task manager](https://slatetoday.app/)
- [Morrow task planning](https://onthemorrow.app/)
- [Bearing task and intention app](https://www.getbearing.app/)
- [Waypost photo organizer](https://apps.apple.com/us/app/photo-organizer-waypost/id6762027477)

## Changes Made

- Added this identity decision record
- Kept OpenSpec task 1.10 open pending owner selection
- Made no launcher, PWA, route, database, or production change
