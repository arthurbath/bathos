## Context

The native macOS companion embeds Tasks in a persistent `WKWebView`. AppKit normally withholds the first mouse-down event from a view in an inactive window unless that view opts into first-mouse delivery, so WebKit receives activation without the pointer sequence that the user intended as a click or drag.

## Goals / Non-Goals

**Goals:**

- Let one pointer press both activate the native Tasks window and reach the hosted web surface.
- Preserve native WebKit event delivery so clicks, caret placement, and HTML drag interactions receive their ordinary mouse-down, movement, and mouse-up sequence.
- Cover the opt-in with a native regression test.

**Non-Goals:**

- Do not synthesize DOM events or create a custom pointer-based drag system.
- Do not make clicks pass through a window that is covered by another window.
- Do not change web, iOS, widget, or task-persistence behavior.

## Decisions

- Host Tasks in a small `WKWebView` subclass that overrides AppKit's `acceptsFirstMouse(for:)` and returns `true`. This is AppKit's supported click-through hook and preserves the original event rather than replaying it.
- Instantiate the subclass from the existing `NSViewRepresentable`. The subclass remains otherwise behaviorally identical to `WKWebView`, so navigation, storage, accessibility, JavaScript, and existing delegates remain unchanged.
- Test the policy directly and verify that the representable constructs the accepting web-view type through the macOS build and test suite.

## Risks / Trade-offs

- [Risk] An accidental click on a visible but inactive Tasks window can now activate a control immediately. -> This is the requested native interaction and is bounded to the Tasks web surface.
- [Risk] Custom event replay could duplicate clicks or break drag thresholds. -> Use only AppKit's first-mouse opt-in and do not synthesize events.
- [Risk] Future WebKit changes could alter hit testing. -> Keep a focused native test for the host's first-mouse contract and manually verify both click and drag after installation.
