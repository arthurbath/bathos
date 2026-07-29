## Context

The Tasks companion has one WidgetKit extension and one `AppIntentConfiguration` that currently supports the large Home Screen family. Its list-selection intent already offers Today, Upcoming, Anytime, and Someday, while the shared App Group snapshot contains the ordered leading tasks for each list. The supplied Things reference uses the Lock Screen's accessory rectangular slot to show three compact task rows without row-level interaction.

The Lock Screen controls the widget's color treatment, available dimensions, privacy redaction, and refresh budget. The presentation must therefore use native SwiftUI typography and system symbols while preserving the Tasks concepts and data boundaries.

## Goals / Non-Goals

**Goals:**

- Offer the existing Tasks widget in the accessory rectangular Lock Screen gallery.
- Reuse the existing per-widget list configuration and cached owner-scoped projection.
- Render up to three leading task summaries in a compact monochrome checklist.
- Make the complete widget open its configured list in the native companion.
- Preserve the current large Home Screen layout and interactions unchanged.

**Non-Goals:**

- Row-level completion, task opening, Primary Link actions, counts, deadlines, or metadata inside the Lock Screen widget.
- New native storage, web projection fields, server calls, credentials, migrations, or background refresh behavior.
- Circular or inline accessory widget families.
- Reproducing the surrounding Lock Screen, clock, status bar, or another application's assets.

## Decisions

### Extend the existing widget kind with a family-aware root view

`TaskListWidget` will support both `.systemLarge` and `.accessoryRectangular`. The configuration closure will read `widgetFamily` and select a dedicated view for each family.

This preserves one gallery identity, one configuration intent, one provider, and one cache. A second widget kind was rejected because it would duplicate configuration and timeline code without providing an independent data contract.

### Use the existing primitive list parameter

Each Lock Screen widget will use `TaskListSelectionIntent`, so the user can independently choose Today, Upcoming, Anytime, or Someday when adding or editing it. Done remains unavailable, matching the current public widget list allowlist.

### Treat the Lock Screen widget as one list-level link

The accessory view will set `widgetURL` to `TaskNativeRoute.list(entry.listID).deepLinkURL`. It will not place `Link`, `Toggle`, or App Intent controls inside individual rows. Tapping anywhere opens the native app on the selected list.

This matches the user's request and avoids implying touch targets that the compact surface cannot communicate clearly.

### Match the reference through native compact structure

The accessory rectangular view will render at most three vertically stacked rows. Each row uses a small neutral square indicator and one single-line, privacy-sensitive summary. Every populated state uses the same row height and separation so corresponding task lines occupy approximately the same vertical positions. When all three rows are present, that consistent geometry nearly fills the accessory height and is vertically centered as one group. One- and two-task states remain top-aligned so a short list does not float without enough content to establish a deliberate block. There is no header, task count, list name, divider, or metadata because those would displace the primary information in the constrained slot.

An empty cached list shows a short sentence-case empty state. A missing projection prompts the user to open Tasks. Lock Screen tint and vibrancy remain system-controlled.

### Keep presentation decisions independently testable

A small family-aware presentation policy will expose the task limit and configured list deep link to unit tests without snapshot-testing private task content. SwiftUI previews will cover populated, one-task, empty, and unavailable accessory states for visual inspection.

## Risks / Trade-offs

- **The system may redact summaries while the device is locked** -> Keep `.privacySensitive()` on every summary and rely on iOS privacy settings rather than bypassing redaction.
- **Three summaries may not all fit at larger accessibility text sizes** -> Use single-line rows, system-scaled compact typography, and allow the layout to show as many leading rows as fit without shrinking text below legibility.
- **WidgetKit refreshes are not immediate** -> Reuse the established shared cache and conservative timeline policy, with no claim of real-time Lock Screen synchronization.
- **One widget kind now has distinct interactions by family** -> Isolate the family-specific views so large-widget completion and Primary Link controls remain untouched.
- **Simulator rendering can differ from a physical Lock Screen** -> Require native tests and Xcode preview or simulator visual inspection, then treat physical installation as the final acceptance gate.
