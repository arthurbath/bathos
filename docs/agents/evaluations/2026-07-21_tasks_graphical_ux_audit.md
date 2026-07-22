# Tasks Graphical and UX Audit

**Date:** 2026 Jul 21
**Category:** Product / UX / Accessibility
**Status:** Complete

## Audit Scope

This combined UX and accessibility audit covers the authenticated Tasks planning shell at desktop and mobile widths, the daily Today workflow, global Tasks navigation, synchronization diagnostics, and Projects management. Evidence comes from a disposable local account and local task data. No production task data was changed.

The requested outcome is a visually clean, approachable, and concise Tasks module that uses BathOS components and design language, limits mobile navigation to five destinations, keeps rarely used status and maintenance surfaces subordinate, and keeps settings on Config.

## Evidence

1. **Desktop Today**
   - Screenshot: `/Users/Art/.codex/visualizations/2026/07/20/019f7ceb-0996-77b2-89b6-068de9908343/tasks-ux-audit/before/01-desktop-today.png`
   - Health: Needs redesign
   - The nine-column navigation exceeds the available content width. Labels and icons compete inside narrow equal-width cells, and the selected view is harder to identify than it should be.

2. **Mobile Today**
   - Screenshot: `/Users/Art/.codex/visualizations/2026/07/20/019f7ceb-0996-77b2-89b6-068de9908343/tasks-ux-audit/before/02-mobile-today.png`
   - Health: Needs redesign
   - Seven persistent bottom destinations exceed the five-tab requirement. Small labels, repeated destinations, header maintenance controls, a page action cluster, and the reminder warning dilute the task list's priority.

3. **Synchronization Details**
   - Screenshot: `/Users/Art/.codex/visualizations/2026/07/20/019f7ceb-0996-77b2-89b6-068de9908343/tasks-ux-audit/before/03-mobile-sync-details.png`
   - Health: Healthy dialog in the wrong hierarchy
   - The diagnostic content is legible and structured, but synchronization history, conflict receipts, and backup/restore are maintenance surfaces. Their persistent header presence gives them more prominence than everyday planning.

4. **Mobile Projects**
   - Screenshot: `/Users/Art/.codex/visualizations/2026/07/20/019f7ceb-0996-77b2-89b6-068de9908343/tasks-ux-audit/before/04-mobile-projects.png`
   - Health: Functional but cluttered
   - Area and project creation controls occupy permanent space even though creation is occasional. Projects and Templates also appear as page toolbar links in addition to the already crowded navigation system.

## Confirmed Strengths

- Tasks already uses the BathOS dark theme, Inter typography, semantic color tokens, restrained borders, shared dialogs, shared buttons, and Lucide icons.
- Daily task rows have clear completion controls, readable titles, predictable dividers, and icon-only overflow actions with accessible names.
- Search, selection, keyboard help, quick capture, and destination links are available without redundant visible labels.
- Synchronization diagnostics use semantic description lists, headings, timestamps, and concise state labels.

## After Evidence

1. **Desktop Today**
   - Screenshot: `/Users/Art/.codex/visualizations/2026/07/20/019f7ceb-0996-77b2-89b6-068de9908343/tasks-ux-audit/after/07-desktop-today.png`
   - Comparison: `/Users/Art/.codex/visualizations/2026/07/20/019f7ceb-0996-77b2-89b6-068de9908343/tasks-ux-audit/compare-desktop-today.png`
   - Health: Healthy
   - The active route now names the page. Four primary destinations and More fit the available width without collision, and the daily surface begins with capture instead of maintenance state.

2. **Mobile Today and More**
   - Today screenshot: `/Users/Art/.codex/visualizations/2026/07/20/019f7ceb-0996-77b2-89b6-068de9908343/tasks-ux-audit/after/02-mobile-today.png`
   - More screenshot: `/Users/Art/.codex/visualizations/2026/07/20/019f7ceb-0996-77b2-89b6-068de9908343/tasks-ux-audit/after/03-mobile-more.png`
   - Comparison: `/Users/Art/.codex/visualizations/2026/07/20/019f7ceb-0996-77b2-89b6-068de9908343/tasks-ux-audit/compare-mobile-today.png`
   - Health: Healthy
   - The bottom navigation now has exactly five destinations. More exposes all six secondary routes in a keyboard-accessible real-link menu and closes after navigation.

3. **Config**
   - Desktop screenshot: `/Users/Art/.codex/visualizations/2026/07/20/019f7ceb-0996-77b2-89b6-068de9908343/tasks-ux-audit/after/01-desktop-config.png`
   - Mobile screenshot: `/Users/Art/.codex/visualizations/2026/07/20/019f7ceb-0996-77b2-89b6-068de9908343/tasks-ux-audit/after/04-mobile-config.png`
   - Health: Healthy
   - Browser Reminders, Synchronization, and Backup and Restore now occupy three concise maintenance sections. The existing diagnostic and portability dialogs remain available from their Config controls.

4. **Projects and Progressive Creation**
   - Projects screenshot: `/Users/Art/.codex/visualizations/2026/07/20/019f7ceb-0996-77b2-89b6-068de9908343/tasks-ux-audit/after/05-mobile-projects.png`
   - Add Project screenshot: `/Users/Art/.codex/visualizations/2026/07/20/019f7ceb-0996-77b2-89b6-068de9908343/tasks-ux-audit/after/06-mobile-add-project.png`
   - Health: Healthy
   - Permanent creation fields are gone. Compact, named Lucide controls open title-only BathOS dialogs with required-field treatment, keyboard submission, optional area selection, disabled incomplete saves, cancellation, and trigger focus restoration.

## UX Risks

1. The navigation treats nine destinations as equally important even though Inbox, Today, Upcoming, and Anytime are the dominant planning views.
2. The mobile navigation has seven tabs, creating small targets and truncated labels while exceeding the explicit five-tab maximum.
3. Projects and Templates receive duplicate mobile toolbar shortcuts because they are absent from the bottom navigation, adding more controls instead of resolving the navigation hierarchy.
4. Notification capability occupies a warning banner on every route, including when no action can be completed from the current state.
5. Backup/restore and synchronization diagnostics occupy the persistent module header despite being infrequent maintenance tasks.
6. Desktop pages repeat the generic heading `Tasks` rather than naming the current view, weakening orientation.
7. The Projects view permanently exposes two creation forms. This prioritizes setup over browsing and makes the empty state feel like a configuration form.

## Accessibility Risks

1. Seven 11 px mobile navigation labels are visually compressed and more likely to truncate at narrow widths or increased text size.
2. A dense set of adjacent icon-only actions can be understood by assistive technology through accessible names, but sighted users must infer several icons without a stable grouping or hierarchy.
3. The always-present notification warning uses valuable reading-order space before the primary task list on every route.
4. The desktop navigation's visible collision is a responsive-reflow failure at the audited width.

Screenshot evidence cannot establish complete keyboard traversal, focus restoration, screen-reader announcements, contrast ratios, reduced-motion behavior, or 200% zoom resilience. Those require implementation-level and interactive verification.

## Implementation Direction

1. Keep Inbox, Today, Upcoming, and Anytime as primary navigation destinations.
2. Add one More destination on mobile and desktop for Someday, Projects, Templates, Logbook, Trash, and Config.
3. Add a dedicated Config route containing browser-reminder settings, synchronization details, and backup/restore.
4. Remove backup/restore and synchronization controls from the persistent header.
5. Remove the browser-reminder capability banner from daily planning views.
6. Replace duplicate Projects and Templates toolbar shortcuts with the unified More menu.
7. Use the active view name as the desktop and mobile page heading.
8. Replace always-visible area and project creation forms with compact BathOS add buttons and modal forms.

## Acceptance Evidence

- Before/after screenshots at 1,440 by 900 and 390 by 844
- Exactly five mobile navigation destinations
- Working More navigation on desktop and mobile
- A working Config page with reminder, synchronization, and backup/restore surfaces
- No persistent notification-capability banner on daily views
- Keyboard and focus checks for More menus and creation dialogs
- Focused component tests, the full test suite, lint, production build, and strict OpenSpec validation

## Completion Verification

- Focused Tasks and shared navigation tests passed
- Full Vitest suite passed with 712 tests and 9 intentionally skipped tests
- ESLint passed
- Production build passed
- Strict OpenSpec validation passed with 8 items and no failures
- Browser interaction checks confirmed responsive navigation, menu closure after navigation, Config dialog access, dialog required states, and accessible control names

The audit found no remaining release-blocking graphical or UX defect in the reviewed scope. Screenshot evidence still cannot prove every screen-reader announcement, contrast ratio, reduced-motion path, or 200% zoom state, so those remain normal future accessibility test coverage rather than blockers for this change.
