## Context

The Tasks web interface has a canonical `TASK_ICONS` vocabulary backed by Lucide React. The Apple widgets currently combine hand-drawn list and horizon approximations with SF Symbols for task state, recurrence, links, add actions, empty states, and the watch complication. WidgetKit is not restricted to SF Symbols, but SwiftUI does not directly consume the React icon components.

The widget targets are intentionally dependency-free. The iOS and macOS list widgets share one Swift source, while the watch complication is a separate target.

## Goals / Non-Goals

**Goals:**

- Render the exact Lucide 24-by-24 path geometry selected by the Tasks application in every existing widget icon position.
- Preserve semantic tinting, template rendering, accessibility, sizing, actions, and dependency-free native builds.
- Make the native-to-web icon assignment explicit and testable.

**Non-Goals:**

- Replacing the native application icon or changing widget layouts and task behavior.
- Adding a general-purpose SVG runtime, JavaScript bridge, or third-party Swift package.
- Replacing platform chrome that has no canonical Tasks-domain icon assignment.

## Decisions

### Compile exact Lucide SVG geometry into a shared asset catalog

The native implementation will generate a bounded shared asset catalog directly from the installed `lucide-react` components selected by the canonical Tasks map. Each exact 24-by-24 Lucide SVG is compiled by Xcode as a vector-preserving template image, then rendered through a small typed SwiftUI wrapper. This keeps vectors sharp at every widget size, supports semantic `foregroundStyle`, and avoids runtime SVG parsing.

Raster PNGs were rejected because they lose vector fidelity and complicate tinting. Hand-translated SwiftUI paths were rejected because they create opportunities for geometry drift. A Swift package was rejected because the target is deliberately dependency-free and only needs a bounded icon set.

### Keep one explicit native icon contract

Native semantic roles will map to the same Lucide names exposed by `TASK_ICON_NAMES`, including list identities, horizons, task states, recurrence, Primary Link protocols, add, empty-state, and checkmark concepts. The asset generator's check mode and a focused repository test will compare the native contract with the web contract so later icon changes cannot silently diverge.

### Share the renderer across Apple widget targets

The generated asset catalog and typed SwiftUI wrapper will compile into the iOS widget, macOS widget, and watch complication targets. Platform-specific views will remain responsible for color, size, privacy, accessibility, and interaction. Accessory widgets and complications will continue accepting WidgetKit's monochrome or accented rendering treatment.

### Preserve system-owned widget constraints

Custom icon geometry is permitted inside ordinary SwiftUI widget content. For Control Center, the implementation will use a custom `Label` icon view if the installed SDK accepts it. If the Control Widget API requires an SF Symbol for that surface, the control will retain its system symbol and the tested exception will be documented rather than weakening other widget parity.

## Risks / Trade-offs

- [Lucide package upgrades change geometry] -> Keep the generated assets checked in, provide a deterministic check mode, and regenerate intentionally when the canonical web icon changes.
- [Tiny accessory rendering loses detail] -> Preserve Lucide geometry while scaling stroke width proportionally and validate the smallest lock-screen and complication sizes.
- [Target membership drifts] -> Add the shared source explicitly to every affected target and build each target in validation.
- [Control Widget rejects arbitrary icon views] -> Prove the API through compilation and retain the narrow platform exception only if required by the SDK.
