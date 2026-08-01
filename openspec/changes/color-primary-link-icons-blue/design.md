## Context

The Tasks app derives generic and protocol-specific Primary Link icons in `TaskSourceIndicator`, while the shared SwiftUI large-widget renderer displays the corresponding native symbols on both iOS and macOS. Both surfaces currently color these actionable controls with a neutral secondary/metadata color.

## Goals / Non-Goals

**Goals:**

- Give actionable Primary Link icons one consistent semantic blue treatment.
- Preserve existing icon identity, link destinations, accessibility, hit areas, and Apple-platform parity.
- Prevent immutable source provenance from synthesizing an icon in the task-row Primary Link slot after the editable Primary Link is cleared.

**Non-Goals:**

- Changing the Primary Link input decoration or its adjacent External Link launch button.
- Changing link normalization, supported protocols, cache contents, or widget actions.
- Introducing a new color token or native asset.

## Decisions

- Apply BathOS `text-info` only when `TaskSourceIndicator` renders an actionable Primary Link anchor. When the editable Primary Link is blank or invalid, render no task-row icon from source provenance.
- Use SwiftUI's native `.blue` foreground style in the shared large-widget renderer. The shared source is compiled by both Apple widget targets, so one edit preserves iOS/macOS parity and adapts appropriately to the system widget environment.
- Assert the web class in focused component coverage and validate the native renderer through both platform builds rather than introducing a view-only test seam for a single color modifier.

## Risks / Trade-offs

- [Risk] Protocol-specific icons become visually uniform in color even when their glyphs differ. → Mitigation: preserve the established Mail, Jira, Obsidian, and generic glyphs and accessibility labels.
- [Risk] Retained source provenance could be mistaken for an active Primary Link after the shortcut is cleared. → Mitigation: make a valid nonblank Primary Link the sole condition for rendering the task-row icon slot while retaining provenance in the data model.
