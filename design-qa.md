# Design QA: Compact Flat Task Rows

## Comparison Target

- Source visual truth: `/Users/Art/.codex/generated_images/019f7ceb-0996-77b2-89b6-068de9908343/call_kgudnwRfGjNxgjSk8VyhVicT.png`
- Rendered implementation: `/private/tmp/bathos-tasks-compact-expanded-fire-boze-top.jpg`
- Combined comparison: `/private/tmp/bathos-tasks-design-comparison.png`
- Route: `http://localhost:8080/tasks/anytime`
- State: Dark-mode Anytime list with compact collapsed rows and the `Fire Boze` task expanded

## Viewport and Normalization

- Source pixels: 923 x 1704. The generated source has no reliable CSS viewport or density metadata.
- Implementation pixels: 432 x 862 from a 432 x 862 CSS viewport at device pixel ratio 2. The in-app browser screenshot API returned one output pixel per CSS pixel.
- Comparison normalization: The source was aspect-preservingly fitted to 432 pixels wide, yielding 432 x 798 pixels, and top-aligned beside the unscaled 432 x 862 implementation. The different source aspect ratio remains visible rather than being stretched or hidden.
- The comparison judges the requested task-row density and state treatment, not false pixel precision across the source's unknown density.

## Full-View Comparison Evidence

- Collapsed tasks form a gapless, borderless, background-free stack in both source and implementation.
- Checkbox, title, metadata, source-link, and actions columns remain aligned, so adjacent content remains clearly associated without card boundaries.
- The implementation's collapsed task header measures exactly 44 CSS pixels.
- The expanded task uses one quiet rounded background that contains its summary row and editor, with zero-pixel borders and no shadow.
- Existing editor control heights differ from the generated source. This is an expected retained product constraint and was explicitly outside this row-presentation change.

## Focused Region Evidence

A separate crop was not required because task-row typography, spacing, and the expanded boundary are readable in the combined full-view comparison. Keyboard focus was additionally verified in `/private/tmp/bathos-tasks-compact-focused.jpg`:

- whole-task focus uses `rgba(235, 235, 235, 0.05)` background
- row height remains 44 CSS pixels
- box shadow is `none`
- no task focus-ring classes are present
- the row retains a subtle 6-pixel radius only while highlighted

## Required Fidelity Surfaces

- Fonts and typography: Existing BathOS Inter/system typography, weights, line heights, truncation, and metadata hierarchy are preserved.
- Spacing and layout rhythm: The requested 44-pixel rows, compact spacing, no resting gaps, and expanded containment match the selected direction.
- Colors and visual tokens: Resting rows use the page background. Focus, selection, and expansion use the existing quiet semantic foreground surface at 5% opacity.
- Image quality and asset fidelity: No raster assets were introduced into the product. Existing Lucide icons remain sharp and consistent.
- Copy and content: Existing task labels and realistic production-like content are unchanged.

## Findings

No actionable P0, P1, or P2 differences remain for the requested task-row redesign.

## Comparison History

- Pass 1: Compared the selected reference with the rendered expanded `Fire Boze` state. The flat density, alignment, focus surface, and expanded containment matched the selected direction. The implementation retained the existing editor control dimensions by design. No visual fix was required after this comparison.

## Interactions and Console

- Verified collapsed rendering, whole-task keyboard focus, opening a focused task, expanded editor containment, and scroll alignment.
- Browser console contained only Vite connection and React development-tool informational messages. No application errors were present.

## Follow-up Polish

None required for this change.

final result: passed

# Design QA: Compact Task Quick Find

## Comparison Target

- Source visual truth: `/Users/Art/Desktop/Screenshot 2026-07-30 at 11.38.11 AM.png`
- Initial rendered implementation: `/private/tmp/bathos-quick-find-mobile.png`
- Revised rendered implementation: `/private/tmp/bathos-quick-find-mobile-revised.png`
- Route: `http://localhost:8080/tasks/today`
- State: Dark-mode Today list with Quick Find open, a populated query, three results, and the second result preliminarily selected

## Viewport and Normalization

- Source pixels: 1179 x 2556 at 3x density, equivalent to a 393 x 852 CSS viewport.
- Implementation pixels: 393 x 852 at 1x density from a 393 x 852 CSS viewport.
- Density normalization: The source and implementation were compared at the same 393 x 852 CSS geometry. The source remained at its native 3x pixel density rather than being stretched.

## Full-View Comparison Evidence

- The implementation occupies a small centered region instead of presenting a titled, full-width modal.
- The input is the palette's only form control and remains visually dominant without taking over the viewport.
- Three quiet, borderless task rows and one Continue Search row use the same compact vertical rhythm.
- Ordinary task results omit repeated checkbox chrome. The established repeat icon is reserved for recurrence projections.
- The underlying task list remains visible without allowing an outside dismissal press to activate it.

## Focused Region Evidence

A separate crop was unnecessary because the Quick Find palette occupies the central, fully legible region of both full-view captures. The input, preliminary selection, result density, icon treatment, and Continue Search row can all be judged directly at equivalent CSS size.

## Required Fidelity Surfaces

- Fonts and typography: BathOS retains its established Inter/system stack, normal task-result weight, compact metadata hierarchy, truncation, and line height.
- Spacing and layout rhythm: The final palette measures 288 x 276 CSS pixels. Its input has approximately 2.8 inches of usable typing width, and the three results remain compact and evenly spaced.
- Colors and visual tokens: The palette uses existing background, popover, border, muted, foreground, and info-highlight tokens. The transparent dismissal layer avoids a full-screen takeover effect.
- Image quality and asset fidelity: No raster assets were introduced. The established Lucide Search and Recurrence icons remain vector-sharp.
- Copy and content: The palette contains only the Find Tasks input, matching task summaries and context, and Continue Search. It has no visible title or Close control.

## Findings

No actionable P0, P1, or P2 differences remain.

## Comparison History

- Pass 1: The initial implementation measured 320 CSS pixels wide. This exceeded the requested approximate three-inch typing space and made the palette feel closer to a mobile modal than a compact command surface.
- Fix: Reduced the palette width from 20rem to 18rem.
- Pass 2: The revised palette measures 288 CSS pixels wide, preserves three readable result rows, and occupies a distinctly smaller portion of the mobile view. No P0, P1, or P2 findings remain.

## Interactions and Console

- Verified that ordinary typing remains in the Quick Find input.
- Verified that Arrow Down changes preliminary selection while the DOM focus and text cursor remain in the input.
- Verified Escape dismissal.
- Verified outside-press consumption, Continue Search traversal, ordinary-task opening, and recurrence-projection focus through focused component coverage.
- The browser console contained no errors during the rendered checks.

## Follow-up Polish

None required for this change.

final result: passed

# Design QA: Tasks Lock Screen Widget

## Comparison Target

- Source visual truth: `/Users/Art/Desktop/Screenshot 2026-07-28 at 5.27.12 PM.png`
- Implemented surface: WidgetKit `accessoryRectangular` presentation in `ios/TasksCompanion/TasksWidgets/TasksListWidget.swift`
- Target device: Art's Phone
- State: Configurable Today, Upcoming, Anytime, or Someday list with up to three task summaries

## Implemented Visual Contract

- The compact widget omits the Home Screen widget header and count so the available height belongs to task summaries.
- Each task is one line with a quiet square status symbol and a single-line truncated summary.
- One- and two-task states remain top-aligned.
- The three-task state uses the same 16-point row height and 4-point separation as the shorter states, nearly fills the accessory height, and centers the complete trio vertically.
- Someday uses the established dashed-square treatment.
- The widget uses system Lock Screen foreground and vibrancy rather than decorative color.
- Empty and unavailable states retain the same compact top-aligned composition.

## Interaction Contract

- The entire rectangular surface opens the configured list in the native Tasks app.
- The existing App Intent configuration continues to offer Today, Upcoming, Anytime, and Someday.
- The Lock Screen presentation is intentionally non-interactive at the individual task level.

## Verification Evidence

- The WidgetKit target compiled in unsigned simulator and signed physical-device builds.
- The dedicated simulator suite passed all 24 tests, including the three-item limit and configured-list deep link.
- The signed app and widget extension installed and launched on Art's Phone.
- Art confirmed on the physical iPhone that the original Lock Screen widget rendered and deep-linked successfully.
- The revised row geometry passed all 24 simulator tests and strict OpenSpec validation, then built, signed, installed, and launched on the physical iPhone.
- The revised three-task spacing and alignment remain pending direct physical inspection.

## Required Final Check

- Confirm the revised three-task state fits without clipping.
- Confirm its first and second lines align approximately with their positions in the one- and two-task states.
- Confirm the complete trio feels vertically centered.

final result: blocked

# Design QA: Task Metadata Chips And Markdown Source Treatment

## Comparison Target

- Source visual truth: `/Users/Art/Desktop/Screenshot 2026-07-25 at 9.14.32 AM.png`
- Rendered implementation: `/private/tmp/bathos-tasks-markdown-link-treatment.png`
- Combined comparison: `/private/tmp/bathos-tasks-markdown-comparison.png`
- Mobile task-row evidence: `/private/tmp/bathos-tasks-mobile-metadata-chips.png`
- Route: `http://localhost:8080/tasks/anytime`
- State: Dark-mode Anytime list at mobile width, with an existing Mail-created task expanded to expose live Markdown source

## Viewport And Normalization

- Source pixels: 888 x 86.
- Implementation viewport: 390 x 844 CSS pixels.
- Combined comparison: 1080 x 926 pixels. The source remains aspect-preserving at the top. A focused implementation crop is enlarged beneath it so link-label, destination, and delimiter colors can be judged in one comparison input.
- Desktop responsive behavior was separately verified at 1280 x 720 CSS pixels.

## Full-View Comparison Evidence

- Mobile actionability and Deadline metadata use quiet compact chips without changing the 44-pixel collapsed task-row height.
- Compact Deadline offsets use the full `days` unit, including `0 days`, `4 days`, `6 days`, and `-4 days`.
- The expanded task editor uses 8-pixel horizontal padding at mobile width and 14-pixel horizontal padding at the desktop breakpoint.
- Desktop metadata retains its unchipped presentation.

## Focused Region Evidence

- Markdown markers render in the existing monospace stack at `rgb(140, 140, 140)`.
- Markdown link labels render in the standard BathOS foreground at `rgb(235, 235, 235)`.
- Markdown destinations render in semantic info blue at `rgb(66, 140, 215)`.
- The complete Markdown source remains one safe clickable link, and the stored source text is unchanged.
- Inline-code backticks use the same muted marker treatment while code contents retain their existing fixed-width presentation.

## Required Fidelity Surfaces

- Fonts and typography: Content retains BathOS Inter/system typography; syntax markers alone use the established monospace stack.
- Spacing and layout rhythm: Chips remain small enough to preserve row density, and the editor receives only the requested slight horizontal inset increase.
- Colors and visual tokens: All treatments use existing semantic BathOS tokens rather than new raw UI colors.
- Image quality and asset fidelity: No product image assets were introduced.
- Copy and content: Existing task content is unchanged; only compact Deadline unit copy changes from `d` to `days`.

## Findings

No actionable P0, P1, or P2 differences remain for the requested metadata-chip, drawer-padding, or Markdown-source treatment.

## Comparison History

- Pass 1: Compared the Things Markdown reference and the live BathOS editor in one combined image. The implementation matched the requested hierarchy: muted fixed-width markers, ordinary white label text, and blue destination text. No follow-up visual correction was required.

## Interactions And Console

- Verified task open and close behavior, responsive metadata treatment, existing safe link behavior, and unchanged task-row height.
- Browser console contained no warnings or errors during the mobile and desktop checks.

## Follow-Up Polish

None required for this change.

final result: passed
