## 1. Native Control And Routing

- [x] 1.1 Add the availability-gated New Task ControlWidget and square-plus system symbol
- [x] 1.2 Add the shared OpenIntent and URL-representable Today Inbox target to the app and widget extension
- [x] 1.3 Extend TaskNativeRoute with the allowlisted single-use new-task route
- [x] 1.4 Register the control in the Tasks widget bundle without changing iOS 17 behavior

## 2. Web Task Creation Handoff

- [x] 2.1 Add bounded native-new-task query parsing and removal helpers
- [x] 2.2 Consume the signal once in TasksShell and open the existing Today Inbox creation draft
- [x] 2.3 Preserve existing unsaved-draft behavior and remove the signal before invoking creation

## 3. Verification And Release

- [x] 3.1 Add native route, intent, bundle-registration, and iOS-availability coverage
- [x] 3.2 Add web parsing, idempotence, Today Inbox placement, and Summary-focus coverage
- [x] 3.3 Update the companion README with Control Center installation and behavior
- [x] 3.4 Run focused and full tests, signed and unsigned builds, lint, build, and strict OpenSpec validation
- [x] 3.5 Rebuild, sign, install, and launch the matching companion and control on the user's iPhone
- [x] 3.6 Replace the rejected custom-scheme URL representation with an OpenIntent plus single-use private App Group handoff, and harden warm in-page routing against top-level JSON string crashes
- [x] 3.7 Verify the physical Control Center control launches one focused Today Inbox draft
- [x] 3.8 Keep Summary actively focused on capture launch and show the visible empty-row `New Task` placeholder
- [x] 3.9 Add the bounded native Summary-focus handshake and expose checklist creation in the new-task editor
- [x] 3.10 Run focused and full web/native validation, rebuild the signed companion, and install it on the user's iPhone
- [x] 3.11 Publish the matching web release and physically verify keyboard presentation, checklist creation, and placeholder replacement
- [x] 3.12 Synchronize and archive the OpenSpec change, commit, push, and prove repository synchronization
