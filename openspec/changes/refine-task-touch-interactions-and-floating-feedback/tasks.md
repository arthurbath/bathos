## 1. Shared task-row interactions

- [x] 1.1 Share the ordinary open-task alignment helper and apply it to Upcoming recurrence prototypes.
- [x] 1.2 Add touch-scroll intent handling to ordinary-task and recurrence-prototype ellipsis triggers without blocking native scrolling.
- [x] 1.3 Preserve a single-task Today self-target drop indicator and make the corresponding drop an intentional no-op.
- [x] 1.4 Serialize prototype-to-prototype title activation so the first editor closes and the target editor opens.
- [x] 1.5 Reuse the ordinary to-do drawer-motion lifecycle and transition surface for recurrence-prototype opening and closing.
- [x] 1.6 Compact mobile task-row reminder, Start, and Deadline metadata while retaining full wider and accessible copy.
- [x] 1.7 Show effective Start metadata for ordinary tasks and recurrence prototypes in generic Upcoming month buckets.

## 2. Shared visual foundations

- [x] 2.1 Anchor both shared toast systems to the viewport's bottom-right edge on wider screens.
- [x] 2.2 Balance the shared switch thumb transforms in unchecked and checked states.

## 3. Verification

- [x] 3.1 Add focused tests for recurrence opening, touch ellipsis scrolling, Today self-target dropping, toast placement, and switch transforms.
- [x] 3.2 Run targeted Vitest suites plus lint, build, and OpenSpec validation.
- [x] 3.3 Exercise the affected desktop and touch-sized Tasks flows in the rendered application and record any limitations.
- [x] 3.4 Add a prototype-to-prototype replacement regression test and verify the rendered Upcoming interaction.
- [x] 3.5 Add recurrence-prototype opening and closing animation parity coverage and verify both directions in the rendered Upcoming list.
- [x] 3.6 Add formatter and rendered-row regression coverage for mobile compact metadata, then verify the mobile and wider presentations.
- [x] 3.7 Add rendered regression coverage for explicit, deadline-implied, and recurrence-prototype month-bucket Starts while retaining omission in date-specific buckets.

Rendered verification confirmed recurrence alignment, exact ordinary/recurrence drawer-motion class and duration parity, delayed recurrence closing unmount, the ordinary ellipsis tap path, viewport-relative toast positioning, and the balanced checked switch inset. The browser runner cannot generate a genuine operating-system touch-scroll gesture, so the movement threshold and menu-dismissal path are covered by focused pointer-event tests and still warrant a final pass on physical touch hardware.

Rendered verification also confirmed that the live wider Upcoming view continues to show reminder times and natural-language Start and Deadline copy while the compact mobile values remain hidden. Focused row and formatter tests cover the inverse mobile breakpoint state: reminder time is hidden, distant Start and Deadline dates use numeric month-day copy, nearby Deadline offsets use `d`, and recurrence prototypes share the same compact Deadline treatment. The current browser runner does not expose viewport resizing, so a final visual pass on a physical mobile-width surface remains appropriate.

Rendered verification confirmed that live ordinary tasks and recurrence prototypes in the August and September month buckets now expose their effective Start dates, including Release notes, Cash out accounts, Pay rent, and birthday prototypes. Nearby recurrence prototypes in date-specific buckets continue to omit redundant Start metadata. Focused tests additionally prove the deadline-only implicit-Start path without altering the task's stored Start.
