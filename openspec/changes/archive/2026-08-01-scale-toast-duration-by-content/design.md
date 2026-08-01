## Context

BathOS currently exposes two shared toast renderers. Most modules use the Radix-based toast service in `src/hooks/use-toast.ts`, while a small number of network-error paths use Sonner. Both systems use a fixed display duration unless a caller supplies an override. That makes concise confirmations remain visible longer than necessary and asks individual modules to solve a shared readability concern.

The mobile Radix toast viewport leaves approximately 296 px for title and description text after viewport and toast padding. At the shared 14 px type size, approximately 42 average characters fit on one line. The duration estimate does not need DOM measurement precision. It needs a stable approximation that produces a predictable reading interval.

## Goals / Non-Goals

**Goals:**

- Give every shared BathOS toast a centrally calculated duration.
- Use one second per estimated title or description line, with a one-second minimum.
- Apply the policy to both shared toast renderers.
- Preserve manual dismissal and the renderers' existing interaction behavior.
- Make the timing calculation deterministic and independently testable.

**Non-Goals:**

- Measure actual rendered line wrapping in the browser.
- Change toast content, visual styling, placement, animation, or concurrency.
- Add module-specific timing controls.
- Add a maximum display duration that the product specification does not currently request.

## Decisions

### Estimate text lines with a shared pure utility

A shared utility will convert toast title and description content into plain text, split explicit line breaks, and estimate wrapped lines with a 42-character mobile line capacity. Title and description are counted as separate blocks because they render on separate rows even when both are short. Empty content contributes no line, while the final result retains a one-line minimum.

This approach is deterministic, inexpensive, and usable by both renderers. Measuring DOM dimensions would be more exact, but it would couple dismissal timing to layout, require post-render measurement, and risk timing changes after fonts load or the viewport changes.

### Assign one second per estimated line

The shared duration will be:

`max(1, estimated title lines + estimated description lines) * 1,000 ms`

This directly implements the requested initial pacing. The constants will be named and isolated so a later decision to use a two-second base can be made without changing call sites.

### Enforce the policy in shared rendering paths

The Radix toaster will calculate and assign the duration when it renders each toast. The Sonner error helper will calculate the same duration before calling Sonner. Routine module-level duration overrides will be removed so callers describe content and the shared service controls timing.

Applying the duration at the renderer boundary prevents existing or future module callers from drifting away from the global policy. Specialized persistent notifications are outside this change and would require a separately specified exception.

### Preserve renderer-owned interaction behavior

The change will only set each toast's automatic duration. Radix and Sonner will continue to own manual dismissal, hover/focus pausing, swipe behavior, and animation.

## Risks / Trade-offs

- [Character count differs from actual wrapping] → Base the estimate on the narrow mobile text region and cover explicit line breaks, separate title/body blocks, and boundary lengths in unit tests.
- [Wide glyphs wrap earlier than expected] → Use a conservative 42-character capacity rather than a desktop-derived value.
- [Long diagnostic messages remain visible for many seconds] → Preserve manual dismissal. Do not add an unrequested maximum that could make a long message unreadable.
- [Two toast systems drift] → Import the same shared utility and constants in both rendering paths.
- [Explicit caller durations conflict with the policy] → Calculate duration at the shared boundary and remove known routine overrides.

## Migration Plan

1. Add the shared duration utility and focused unit tests.
2. Integrate it into the Radix and Sonner toast paths.
3. Remove known routine caller duration overrides.
4. Update the human-facing BathOS style guide with the shared rule.
5. Validate focused tests, the full relevant test suite, lint, build, OpenSpec, and rendered behavior.

Rollback consists of reverting the shared renderer integrations. No data migration, dependency change, or persistent-state cleanup is required.

## Open Questions

None. The user has explicitly selected a one-second initial baseline and plans to evaluate whether that baseline should later increase.
