## Context

Tasks currently renders nine equal-weight desktop navigation destinations inside a `max-w-3xl` content column and seven persistent mobile destinations through the shared `MobileBottomNav`. Projects and Templates are duplicated as mobile page actions. Backup/restore and live synchronization status occupy the persistent module header, while browser-reminder capability occupies every page body.

The audited interface already uses the correct BathOS tokens, typography, icons, buttons, dialogs, and dark-only visual language. The change therefore reorganizes existing capabilities instead of introducing a new visual system. It touches one shared navigation component through an optional backward-compatible overflow contract.

## Goals / Non-Goals

**Goals:**

- Make daily task planning the clear visual priority
- Limit persistent mobile navigation to five destinations
- Keep desktop navigation compact and readable
- Put maintenance, settings, and infrequent destinations behind More and Config
- Preserve real links, keyboard access, route-runtime stability, offline behavior, reminders, synchronization, and data recovery
- Use existing BathOS components and interaction conventions

**Non-Goals:**

- Change task data, planning semantics, synchronization topology, reminders, or recovery behavior
- Add tags, native Apple surfaces, new imagery, decorative styling, or another theme
- Redesign task rows, editors, search, command shortcuts, or hierarchy details beyond the audited clutter
- Change another module's existing navigation

## Decisions

### Use Four Primary Destinations and More

Inbox, Today, Upcoming, and Anytime remain persistent because they represent capture, current work, future planning, and available work. Someday, Projects, Templates, Logbook, Trash, and Config move to More.

This hierarchy is identical on desktop and mobile. The desktop surface remains a BathOS tab strip with four readable links and one More menu. The mobile surface contains four links and one More menu, satisfying the five-destination maximum.

Alternatives considered:

- A permanent sidebar would expose every destination but would introduce a new Tasks-only layout paradigm and consume more narrow-screen space
- Two rows of tabs would preserve direct access but would keep all destinations equally prominent
- Different desktop and mobile hierarchies would maximize each viewport independently but would increase relearning and test complexity

### Extend MobileBottomNav with Optional Overflow

The shared component gains an optional list of overflow items. Existing consumers that do not provide overflow items render exactly as they do now. Overflow destinations remain real anchors inside the shared dropdown menu, and ordinary left clicks use the existing SPA navigation callback.

This avoids a Tasks-specific copy of the visual-viewport, safe-area, zoom, and portal behavior already maintained by the platform.

### Make Config a Registered Tasks Route

`/tasks/config` renders inside the existing authenticated Tasks runtime. Config contains three concise maintenance sections:

1. Browser Reminders
2. Synchronization
3. Backup and Restore

The existing reminder model, diagnostics dialog, and portability service remain authoritative. The page changes discovery and prominence only.

### Remove Persistent Maintenance and Duplicate Shortcuts

The module header keeps app switching and user controls. It no longer renders backup/restore or synchronization diagnostics. Daily views no longer render browser-reminder capability, Projects, or Templates shortcuts.

Due reminders, reminder-claim failures, projection failures, and task-domain errors remain visible where they are actionable. This distinguishes a current task problem from a capability or maintenance status.

### Use Active View Headings

The main heading names the active route at every viewport. This removes the desktop-only generic `Tasks` heading and improves orientation without adding helper copy.

### Use Modal Hierarchy Creation

Projects replaces permanent creation fields with the standard compact green outline add controls. Each opens a title-only BathOS form dialog with a required title and, for projects, an optional area. Save remains disabled til the required field is complete.

The existing creation methods remain unchanged. Dialog submission supports Enter, complete Tab and Shift+Tab traversal, explicit Cancel, and focus restoration to the opening control.

## Risks / Trade-offs

- [Risk] Secondary destinations require one additional activation → Mitigation: Keep them available through a stable More control, search, and existing keyboard navigation commands
- [Risk] Removing persistent synchronization status could hide degradation → Mitigation: Keep the state clear on Config and preserve current task-operation error handling and content-free reliability reporting
- [Risk] Shared mobile navigation changes could affect other modules → Mitigation: Make overflow optional, preserve the existing code path, and add regression coverage for both modes
- [Risk] Dropdown portals can collide with the fixed mobile bar or safe area → Mitigation: Use the existing shared dropdown primitive and verify at 390 CSS pixels, keyboard focus, and increased text size
- [Risk] Modal creation adds one activation for frequent setup sessions → Mitigation: Keep the add buttons visually compact and keep Enter submission inside the dialog

## Migration Plan

1. Add the optional shared overflow contract and focused regression tests.
2. Register Config and implement the new navigation hierarchy.
3. Move reminder, synchronization, and portability surfaces to Config.
4. Replace Projects creation fields with dialogs.
5. Run focused and full validation, then compare before/after screenshots at the audited viewports.

There is no data, database, synchronization, or credential migration. Rollback consists of reverting the UI and route changes.

## Open Questions

None.
