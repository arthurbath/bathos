## Context

Persisted and draft checklist rows already share the same boundary-navigation contract for plain Left Arrow and Right Arrow. React exposes macOS Option as `KeyboardEvent.altKey`, but that same flag represents Alt on Windows and Linux, where Alt+Left Arrow and Alt+Right Arrow commonly navigate browser history.

## Goals / Non-Goals

**Goals:**

- Extend checklist line continuity to Option-modified horizontal arrows on Mac-like platforms.
- Preserve native Option word navigation until the caret is already at the applicable boundary.
- Keep persisted and draft checklist rows behaviorally identical.
- Preserve non-macOS Alt navigation and all selection or additional-modifier behavior.

**Non-Goals:**

- Changing horizontal traversal for ordinary inputs outside task checklists.
- Replacing native word navigation inside a checklist item.
- Adding a new cross-platform shortcut for Windows or Linux.

## Decisions

- Reuse the shared `isMacLikePlatform` utility and evaluate the current browser platform at the keyboard-event boundary. This avoids duplicating platform heuristics and prevents the macOS-specific interaction from consuming Windows browser-history shortcuts.
- Treat Option as eligible only when it is the sole modifier on a Mac-like platform. Command, Control, Shift, and combinations such as Option+Shift continue through native input behavior.
- Retain the existing collapsed-caret and adjacent-item checks. An Option arrow away from the boundary remains untouched, so the browser performs its native word movement first. A subsequent Option arrow at the boundary crosses to the adjacent checklist row.
- Apply the same predicate to persisted and draft inputs and cover both boundary traversal and preserved-native cases with component tests.

## Risks / Trade-offs

- **Risk:** Browser platform reporting can vary on Apple devices. → **Mitigation:** Use BathOS's existing Mac-like platform utility, which already recognizes macOS, iPhone, iPad, and iPod platform identifiers.
- **Risk:** Consuming Alt arrows on non-Apple platforms would break browser history navigation. → **Mitigation:** Require a Mac-like platform before treating `altKey` as Option.
- **Trade-off:** Option+Shift at a boundary does not cross between inputs. → This preserves native text selection and avoids surprising cross-field selection behavior.
