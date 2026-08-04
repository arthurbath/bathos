## Context

The Quick Entry controller distinguishes cold and warm web-document presentation. Cold presentation orders the panel on screen before loading finishes, but warm presentation keeps the panel hidden until the newly routed editor sends `quick-entry-ready` or the 12-second compatibility timeout fires. That optimization prevents stale content from flashing, but it also removes all immediate feedback after the global shortcut.

The panel already declares `isMovableByWindowBackground` and overlays a transparent 44-point AppKit view above WebKit. Its drag view only returns `mouseDownCanMoveWindow`, which has not proved reliable for this borderless `NSPanel` hosting hierarchy.

## Goals / Non-Goals

**Goals:**

- Order the panel on screen synchronously for both cold and warm shortcut invocation.
- Continue hiding WebKit until the fresh quick-entry editor is ready, leaving the existing single native spinner as the only interim content.
- Make the top drag region call AppKit's window-drag operation directly.
- Protect the behavior with focused macOS companion tests.

**Non-Goals:**

- Change the web editor readiness protocol or its compatibility timeout.
- Recreate the Quick Entry web view for every invocation.
- Permit dragging from interactive editor controls.
- Change panel size, styling, dismissal, or task persistence.

## Decisions

### Present the native shell in the same main-actor turn

Every `show()` call will synchronously reset presentation readiness, prepare the WebKit route, apply panel policy, center and activate the app, and call `makeKeyAndOrderFront` before returning from the shortcut handler's main-actor turn. The SwiftUI host therefore has the fresh hidden-content state before the panel becomes visible and keeps WebKit at zero opacity until `quickEntryPresentationReady` becomes true. This retains stale-content protection while restoring immediate visible acknowledgement.

Ordering the panel first is preferable to shortening the 12-second fallback because the fallback exists for compatibility with older deployed clients and does not address the user's need for immediate feedback.

### Use explicit AppKit dragging in the dedicated top region

The native drag view will override `mouseDown(with:)` and invoke `window.performDrag(with:)`. The region remains above WebKit only in the established noninteractive top padding, so form controls continue to own their ordinary pointer behavior.

Relying solely on `mouseDownCanMoveWindow` and `isMovableByWindowBackground` is insufficient because the borderless panel and embedded WebKit hierarchy can consume or reinterpret the initial event before AppKit begins window movement.

## Risks / Trade-offs

- **Risk:** Ordering before route preparation could briefly expose old WebKit content. -> **Mitigation:** `prepareForPresentation` resets `quickEntryPresentationReady` synchronously, and the host gates WebKit opacity on that state.
- **Risk:** A transparent drag strip can obscure web controls if it overlaps them. -> **Mitigation:** Keep it constrained to the existing 44-point noninteractive top region.
- **Risk:** Native tests cannot fully simulate a human pointer drag. -> **Mitigation:** Test the controller's immediate visibility and isolate the drag operation behind a small injectable seam while retaining manual installed-app verification as the final native check.
