## Context

Tasks Config currently composes one established BathOS card, Areas, with several icon-prefixed utility sections. Browser reminder capability, automatic sorting, native macOS quick entry, synchronization diagnostics, and portability controls are each presented through different layouts even though they are all settings. The synchronization hook also exposes a larger diagnostic model than the ordinary user needs.

## Goals / Non-Goals

**Goals:**

- Use the shared headed Card pattern for all Tasks settings groups.
- Put everyday feature controls first, preserve Areas as the second card, and show a concise Sync Status card third.
- Keep notification state surface-specific without pretending native notification delivery already exists.
- Keep the macOS shortcut bridge authoritative while making its setting compact and clearable.
- Make the existing keyboard-command reference discoverable from Settings on point-and-click devices without showing irrelevant hardware guidance on touch devices.
- Remove backup and deep synchronization diagnostics from the frontend without deleting backend recovery or logging infrastructure.

**Non-Goals:**

- Implement native macOS, iOS, or watchOS notification delivery or authorization.
- Delete task portability services, synchronization event stores, or diagnostic logging.
- Change synchronization, reminder, automatic sorting, or account data contracts.

## Decisions

### Compose settings from shared Cards and setting rows

Features and Sync Status will use the same `Card`, `CardHeader`, `CardTitle`, and `CardContent` structure already used by Areas and Account. Feature rows will use a reusable two-column layout with bold title and muted description on the left and a fixed control region on the right. This avoids bespoke card variants and keeps controls aligned at narrow and wide viewports.

### Keep browser notification capability in the existing Web Push model

The browser row will translate existing Web Push states into an Enable action, an enabled toggle, or a bounded unavailable/blocked message. Native surfaces will show an unavailable future-native state rather than exposing a browser permission control inside a native wrapper. This keeps permission requests user-initiated and avoids introducing incomplete native notification bridges.

### Derive a lightweight synchronization summary

A lightweight summary hook will read PowerSync status and the Tasks runtime without querying reliability-event or conflict-receipt history. Sync Status will render only Health, Pending Changes, and Last Successful Sync. Existing diagnostic stores and logs remain available to engineering, but no synchronization modal will be mounted from Config.

### Preserve backend portability without a frontend entry point

The Config route will stop importing or rendering the portability dialog. Runtime portability services and tests remain intact so the capability can be reinstated or used by controlled recovery tooling later.

### Treat an empty macOS shortcut as disabled

The shortcut control will send an explicit clear request through the existing native bridge and will remain in recording mode until the bridge returns success or failure. Re-entering the current shortcut still sends the request and a successful response closes recording, so equal values do not create a UI dead end.

### Reuse the existing keyboard-command dialog from Settings

Features will end with a Keyboard Shortcuts row when the active device exposes point-and-click interaction. Its description uses the platform's compact keyboard notation (`⌘/` on Mac and `⌃/` on Windows). Its Show action opens the same keyboard-shortcut dialog used by the global shortcut, so command content remains single-sourced. The dialog selects only the current platform's shortcuts and renders action-shortcut rows without a redundant column-heading row. Touch-capable devices omit the feature row rather than advertising hardware commands that are not applicable to their primary interaction mode.

## Risks / Trade-offs

- [Native notification expectations] A generic Notifications row could imply native support exists → Native surfaces show a clear unavailable/future state and no operative toggle.
- [Loss of self-service recovery] Removing backup UI reduces user-facing recovery options → Backend portability remains unchanged for controlled support and possible later reinstatement.
- [Sync status ambiguity while offline] Offline operation is valid but not converged → Health explicitly reports Offline while Pending Changes and Last Successful Sync provide context.
- [Native shortcut clear bridge mismatch] Older installed companions might not recognize clear → Keep the bridge request schema bounded and show a non-destructive failure without clearing the displayed shortcut until native confirmation.

## Migration Plan

No database or service migration is required. Deploy the web settings refactor first. Native macOS builds continue using the existing shortcut configuration bridge, extended with the explicit clear request. Rollback consists of restoring the prior Config composition; backend state remains compatible throughout.

## Open Questions

None.
