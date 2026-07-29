## Context

BathOS's shared `Input`, `SelectTrigger`, and `DatePickerField` primitives currently reserve space only for their native content and right-side affordances. Tasks removes visible labels from its compact metadata drawer, but each field still needs an immediately recognizable identity. The same capability should be reusable by future modules without making Tasks styling part of a shared component.

The Tasks web module also derives Primary Link icons by protocol, while its current generic icon and expanded-editor activation icon share one mapping. The iOS widget independently maps the link kind to an SF Symbol, so generic link identity must change on both sides without exposing the link value in the native projection.

## Goals / Non-Goals

**Goals:**

- Provide an optional leading-decoration API on the shared single-line Input, Select trigger, and date-picker trigger.
- Preserve refs, keyboard behavior, validation, native editing, and existing undecorated rendering.
- Keep decorations fixed, noninteractive, muted, and collision-safe.
- Apply the API to the requested Tasks fields and Start-picker Reminder.
- Establish consistent generic-link, Deadline, and Ready iconography across affected Tasks surfaces.

**Non-Goals:**

- Add decorations to other BathOS modules in this change.
- Change Tasks persistence, database schema, synchronization, reminders, or link routing.
- Replace the Primary Link launch action with the decoration.
- Add labels back to the compact task editor.

## Decisions

### Shared controls own decoration spacing

Each supported shared primitive will accept an optional `decoration` React node and render it in a noninteractive, `aria-hidden` leading slot. The primitive will add its own content inset or flex slot only when the decoration exists. This keeps collision prevention part of the shared contract instead of requiring every consumer to coordinate absolute positioning and padding.

Alternative considered: introduce a generic external wrapper modeled after Input Group. That composition is useful for mixed buttons and text, but it would allow callers to omit the required content inset and would not naturally cover Radix Select or the button-based DatePickerField. A small shared `ControlDecoration` rendering helper plus explicit primitive props provides one visual contract while preserving each control's semantics.

### Decorations are visual identity, not activation controls

Decorations use muted foreground styling, do not accept pointer events, are removed from the accessibility tree, and never enter the Tab order. Existing labels, placeholders, and `aria-label` values remain the accessible names. Right-side affordances and activation buttons retain their independent behavior.

### Primary Link identity and launch action are intentionally distinct

Task rows, the Primary Link input decoration, and widgets will use protocol-specific identity icons, defaulting to `Link2` on the web and the closest native chain-link symbol in WidgetKit. The editor's adjacent launch button will always use `ExternalLink` because it represents the action of leaving the current context rather than the link's type.

### Tasks derives decorations from accepted metadata

Start uses the existing horizon icon and semantic color for Today work and `Play` otherwise. Actionability uses the current value's icon, with Ready changed to `ArrowBigRightDash`. Area uses the existing canonical `Layers3` icon. Deadline uses `Flag`. These mappings stay in the Tasks iconography registry so the editor does not duplicate conceptual choices.

## Risks / Trade-offs

- [Risk] Wrapping the native Input can affect layouts that assume the input is the direct flex or grid child. → The wrapper is emitted only when `decoration` is provided, so existing callers remain structurally unchanged.
- [Risk] Long Select and date values can crowd both leading and trailing icons. → Decoration and trailing affordances remain `shrink-0`, while the value slot uses `min-width: 0` and truncation.
- [Risk] Native and Lucide icon sets cannot be pixel-identical. → The iOS widget uses the closest SF Symbol while preserving the same generic-versus-protocol-specific semantics.
- [Risk] Existing dirty work overlaps Tasks icon files. → Changes are narrow and additive, and validation covers the current combined working tree without discarding unrelated edits.
