## Context

The native Mac companion already declares a 360-by-420-point content minimum, inserts the resizable window style, and marks its main window full-screen-primary. Its durable spec also requires macOS Split View support. The live installed app exposes macOS's two-up full-screen commands while windowed and successfully enters the tiling flow, but the implementation does not explicitly opt into AppKit's dedicated full-screen-tiling behavior and its test only covers a single synthetic policy application.

SwiftUI owns the scene and can reconcile AppKit window properties after the representable view first receives its window. Full-screen transitions are another lifecycle boundary at which implicit behavior is unnecessarily fragile.

## Goals / Non-Goals

**Goals:**

- Make full-screen tiling an explicit native window invariant rather than an incidental consequence of full-screen-primary behavior.
- Preserve the narrow mobile-class minimum and resizable style after scene updates and full-screen transitions.
- Test both positive tiling eligibility and removal of opposed collection behaviors.
- Keep the installed app eligible for the ordinary macOS two-up flow without custom window management.

**Non-Goals:**

- Implement a custom Split View user interface or choose the second application on the user's behalf.
- Change the web module layout, native quick-entry panel, iOS companion, or widgets.
- Override macOS behavior while the user is already in a standalone full-screen Space.

## Decisions

### Declare the complete AppKit window contract

`TasksMacWindowPolicy` will insert `.resizable`, `.fullScreenPrimary`, and `.fullScreenAllowsTiling`. Before inserting the allowed behaviors it will remove `.fullScreenNone` and `.fullScreenDisallowsTiling`, so a stale or framework-assigned opposed flag cannot silently win.

Alternative considered: continue relying on `.fullScreenPrimary`. Rejected because AppKit exposes a specific tiling behavior and the user requires this capability to be durable rather than implicit.

### Reapply policy at native lifecycle boundaries

The SwiftUI configurator will retain a coordinator for the resolved window and observe window lifecycle notifications that can follow scene reconciliation or full-screen transitions. Each relevant transition reapplies the idempotent policy.

Alternative considered: set properties only in `makeNSView` and `updateNSView`. Rejected because those callbacks do not constitute a durable guarantee after AppKit changes the window's full-screen state.

### Verify the real system entry surface as acceptance evidence

Automated tests will cover the policy invariants and repeated application. Native acceptance will verify the installed app exposes macOS's Full Screen Tile commands and can enter the system tiling flow at the narrow responsive layout.

## Risks / Trade-offs

- [Risk] Reapplying policy during transitions could interfere with AppKit animation → Mitigation: keep the policy idempotent and change only resizability, the two tiling flags, opposed flags, and the minimum size.
- [Risk] macOS may disable tiling while a window already occupies a standalone full-screen Space → Mitigation: preserve ordinary AppKit behavior and verify the supported windowed-to-two-up entry flow rather than introducing custom Space management.
- [Risk] A future framework version introduces another opposed window behavior → Mitigation: keep the explicit positive and negative invariants together in the policy and regression tests.
