## Context

Global Quick Entry is a borderless AppKit `NSPanel` whose content is a SwiftUI wrapper around the same persistent `WKWebView` and React task editor used by the main Tasks application. Three independent implementation details currently degrade that experience: the panel no longer supplies its own rounded material boundary, the ordinary React outside-task listener closes the Quick Entry draft when the user clicks unused web content, and AppKit reveals the page as soon as WebKit navigation finishes even though the Tasks runtime is still showing its own loading indicator. The panel also forces a full navigation every time it is shown, even when its web document is already healthy.

## Goals / Non-Goals

**Goals:**

- Restore an unmistakably native rounded panel edge, subtle border, and restrained shadow.
- Increase horizontal breathing room without revisiting the established vertical geometry.
- Keep all interior panel clicks non-destructive.
- Present one uninterrupted native loading indicator until meaningful web content is ready.
- Reuse a warm Quick Entry document so later invocations begin immediately.
- Preserve compatibility with an older production web client during staged native/web deployment.

**Non-Goals:**

- Redesign the task editor, temporal pickers, or Quick Entry save/cancel rules.
- Change the main Tasks window geometry.
- Introduce a new spinner component or third-party dependency.
- Change task persistence, database schema, or Supabase behavior.

## Decisions

1. **Clip a transparent borderless panel to an AppKit-owned rounded content layer.** The `NSPanel` remains borderless and floating, but becomes non-opaque with a clear window background. Its content view owns the application-background fill, rounded corner radius, one-pixel dark-gray border, and clipping. `hasShadow` supplies the standard macOS window shadow outside that clipped content. This is more reliable than relying on SwiftUI background modifiers to define the actual window silhouette.

2. **Separate WebKit navigation completion from application readiness.** WebKit's `didFinish` only proves the HTML document loaded. The Tasks web surface will send a narrow versioned `content-ready` bridge message after either the signed-out authentication surface or the fully initialized Tasks shell is mounted. Native hosting keeps the WebView hidden and the native progress indicator visible until both navigation and content readiness are known. A bounded fallback releases the surface if the companion is temporarily paired with an older deployed web client that lacks the new message.

3. **Reuse healthy Quick Entry content with same-document routing.** When the Quick Entry model already has ready content, showing the panel routes the existing document back to the Quick Entry URL instead of clearing readiness and issuing a full `WKNavigation`. React's existing native-new-task signal then constructs a fresh draft. Cold launch, failure recovery, and terminated web content still use full navigation.

4. **Disable only the task-list outside-click close rule in Quick Entry.** The editor's ordinary nested popover dismissal behavior remains intact, while the document-level rule that closes an open list task is not installed for a native Quick Entry draft. This allows an interior background click to blur a control without canceling the panel.

5. **Adjust only horizontal web padding.** The Quick Entry `main` surface retains its current vertical padding and increases left/right padding, avoiding further changes to the top spacing that has proven sensitive to native hosting.

## Risks / Trade-offs

- **A readiness message could be absent during a staggered deployment** -> retain a short compatibility timeout after navigation completion, covered by native model tests.
- **Warm reuse could retain stale draft state** -> route through the existing `native_new_task=1` signal every time, which owns creation of a fresh draft and cancellation cleanup.
- **Rounded clipping could cut off the shadow** -> clip only the content layer and use the panel's native shadow outside that layer.
- **The shared browser model serves iOS and macOS** -> keep readiness behavior platform-neutral and regression-test existing loading/retry transitions as well as macOS Quick Entry reuse.

## Migration Plan

No data migration is required. Publish the web readiness signal before or with the rebuilt native apps. The compatibility timeout allows either deployment order. Rollback consists of reverting the native readiness gate and bridge signal together.

## Open Questions

None.
