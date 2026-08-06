## Context

The main macOS Tasks window is a SwiftUI shell around one persistent `WKWebView`. Global Quick Entry currently creates a second `WKWebView` and navigates it to the deployed Today route with native query flags. The panel appears immediately, but its usable editor cannot appear until WebKit, the authenticated web session, React, PowerSync, task data, and the native readiness bridge all succeed. The resulting latency and blank or failed web states are intrinsic to that architecture.

The native app already receives an expiring owner-and-installation-bound credential from the authenticated web surface and stores it for native widget actions. The server already uses narrow `SECURITY DEFINER` RPCs for idempotent watch capture. These are useful precedents, but the existing widget token and Inbox-only RPC are not a sufficient contract for a complete Quick Entry form.

The web editor's field labels, defaults, validation, keyboard commands, and layout order currently live across React components and TypeScript domain files. A native editor copied from those files would drift silently. The replacement therefore needs an enforceable shared contract as well as a native rendering implementation.

## Goals / Non-Goals

**Goals:**

- Present a usable SwiftUI Quick Entry editor synchronously, without loading a second web document.
- Preserve the ordinary creation workflow's Summary, Notes, Link, checklist, Start, Deadline, Area, Actionability, reminder, validation, traversal, and Tasks Control commands.
- Keep platform-specific field implementations synchronized through a versioned neutral contract and automated parity checks.
- Submit the complete draft atomically and idempotently through a narrow owner-bound authority.
- Retain the established movable rounded panel, first-responder behavior, global-shortcut toggle, explicit Save and Cancel actions, and immediate cancellation.

**Non-Goals:**

- Replacing the main macOS Tasks web surface.
- Making the native overlay an offline-first task database or embedding PowerSync in the macOS target.
- Supporting completion, recurrence editing, task-list navigation, bulk selection, undo, or other commands that are nonsensical for an uncommitted task.
- Reusing React pixels inside the native panel. Native controls may differ where AppKit and SwiftUI conventions improve speed, focus, accessibility, or reliability.

## Decisions

### Use a native SwiftUI draft and never create a temporary task

The panel owns a `TaskNativeQuickEntryDraft` in memory. Checklist rows, reminder data, and every other field remain local until Save. Cancel, Escape, and a second global-shortcut invocation discard the draft with no cleanup request. This removes the web editor's temporary-parent workaround and makes cancellation reliable in every state.

Alternative considered: retain an invisible `WKWebView` only for persistence. That would preserve the same failure path and would not satisfy the native-speed objective.

### Establish one neutral Quick Entry contract

A checked-in versioned JSON contract defines:

- field identifiers, order, grouping, labels, optional disclosure behavior, and default values;
- enumerated Today horizons and Actionability values in display order;
- limits and normalization rules for Summary, Notes, Link, checklist titles, and reminder input;
- Tasks Control-command keys, target fields, and cycling behavior allowed in Quick Entry;
- payload schema version and required server capabilities.

TypeScript imports the contract for web Quick Entry metadata and validation. A deterministic generator produces a Swift representation used by the native form. Tests compare the generated Swift fingerprint and values to the source contract, so changing the web contract without regenerating native code fails validation. Platform-specific control implementations remain explicit, but their existence, order, semantics, and shortcuts cannot silently diverge.

Alternative considered: generate the whole SwiftUI form from React source. React and SwiftUI have incompatible control and state models, and generated UI code would be harder to review than a small explicit native renderer over a shared semantic contract.

### Use a dedicated Quick Entry credential stored in the app's Keychain

The authenticated main web surface issues a separate expiring Quick Entry credential bound to the owner, installation, and `native_quick_entry_v1` capability. The bridge stores it in the login Keychain for the macOS app, not in the widget-shared file. The credential grants only bootstrap reads and complete task creation. It does not grant general table access, task editing, deletion, recurrence changes, or widget completion.

The panel can always open and edit immediately. If no usable credential exists, Save remains available long enough to perform a bounded credential refresh through the already-running main window; if authority still cannot be recovered, the draft remains intact and the panel shows a concise retryable error.

Alternative considered: extend the widget credential. The widget extension shares its storage and would inherit a broader mutation capability that it does not need.

### Bootstrap small owner-scoped reference data and cache it locally

The native bootstrap response contains contract compatibility, planning date and time zone, ordered Areas, and any server limits that can vary by deployment. The app caches the last valid response in its private Application Support container. Opening the panel never waits for bootstrap; the cached Areas and planning context render immediately while a refresh reconciles in the background.

A server contract version newer than the installed native client disables Save with a refresh-required explanation rather than accepting a draft under unknown rules.

### Create the complete task in one idempotent transaction

The native action accepts a bounded versioned payload with Summary, Notes, Link, destination, Today horizon, Start, Deadline, Area, Actionability, reminder, and ordered checklist titles plus client mutation and operation UUIDs. A `SECURITY DEFINER` RPC validates credential ownership, date placement, Area ownership, URL normalization, reminder legality, limits, and task/checklist structure before creating anything. It inserts the task, checklist items, reminder, and history/audit metadata atomically. Retrying the same client mutation returns the original accepted receipt.

New native captures use `entry_channel = 'native'`. Placement and ordering match the ordinary Today new-task workflow: an unplanned task defaults to the Today list's Inbox horizon for Global Quick Entry, while explicit Start or Someday values clear incompatible Today placement.

### Keep native interaction state explicit

The SwiftUI view model owns focus targets, popover ownership, validation, submission state, and shortcut dispatch. Tab and Shift+Tab traverse the declared contract order. Return follows field ownership, Command+Return saves, and Escape closes only the innermost picker before canceling the panel. Control shortcuts dispatch semantic commands from the shared contract rather than synthetic keystrokes.

Notes uses a native multiline editor that preserves Markdown text and standard macOS selection/editing behavior. Checklist rows support Return insertion, deletion of abandoned blanks, reordering, and focus movement. Start and Deadline use native popovers that preserve BathOS date restrictions and preferred display formatting.

### Ship only the native implementation after parity acceptance

The native editor is the sole shipping Global Quick Entry implementation. The former hosted route, second `WKWebView`, readiness messages, JavaScript shortcut forwarding, and compatibility timeout are removed after native contract tests, RPC tests, signed macOS builds, and owner-scoped production acceptance pass. Keeping a hidden hosted fallback would let two implementations drift and would preserve the original latency and failure path.

## Risks / Trade-offs

- [Native and web controls can still differ visually] -> Treat semantic order, labels, defaults, validation, shortcuts, and payloads as contract data; maintain native screenshot and interaction tests for layout-specific parity.
- [A cached Area may be deleted or ownership may change] -> Refresh bootstrap opportunistically and validate Area ownership authoritatively during Save; preserve the draft if rejected.
- [The main web surface may not yet have issued a credential] -> Open the editor regardless, attempt bounded bridge refresh on Save, and expose a recoverable sign-in/refresh state without losing input.
- [An atomic RPC duplicates some client repository logic] -> Centralize normalization fixtures and cross-language payload tests; treat the server as final authority and keep the web repository tests as a second client conformance suite.
- [SwiftUI date and focus behavior can regress across macOS releases] -> Isolate controls behind small adapters and test focus/command state separately from visual rendering.
- [The migration expands a native credential surface] -> Use a distinct token namespace, hash-only storage, short expiry, owner-and-installation binding, capability checks, input size limits, RLS isolation, and no general-purpose SQL or table APIs.

## Migration Plan

1. Land the neutral contract, generator, TypeScript conformance tests, Swift models, and native form without changing the shipping implementation.
2. Add the private Quick Entry credential table/functions, bootstrap RPC, atomic creation RPC, Edge Function actions, and pgTAP/handler tests. Do not apply them to production until a fresh preflight confirms the expected schema and explicit rollout approval is received.
3. Update the authenticated native bridge to issue, rotate, revoke, and store the dedicated Keychain credential. Verify owner changes clear cached authority and bootstrap data.
4. Build and sign the macOS companion, run native unit tests, and validate every field, picker, keyboard command, error, retry, save, cancel, and warm/cold invocation against the web workflow.
5. Publish the matching web credential bridge and server functions, independently read back the authority, and create and clean up an owner-scoped complete-capture acceptance fixture.
6. Remove the hosted Quick Entry `WKWebView`, route, readiness messages, JavaScript shortcut forwarding, and compatibility timeout, then ship the native editor as the only implementation.

Rollback uses a previously signed application build rather than a second live implementation. Database additions are backward compatible and can remain dormant if the application is rolled back; issued Quick Entry credentials can be revoked without affecting widget credentials.

## Open Questions

- None blocking the first implementation slice. Exact native spacing and picker presentation will be tuned through rendered testing without changing the semantic contract.
