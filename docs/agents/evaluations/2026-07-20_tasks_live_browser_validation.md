# Personal Tasks Live-Browser Validation

**Date:** 2026-07-20
**Category:** Browser / Responsive Interaction
**Status:** Passed

## Purpose

Validate the local-first Tasks module in a real browser runtime rather than JSDOM. The exercise used one disposable local Supabase account, local Vite, and local-only task storage. It did not connect personal task data, Things, production Supabase, PowerSync, reminder delivery, or Inbox Manager.

## Scenario

The browser opened `/tasks`, authenticated through the local BathOS sign-in flow, and resolved to `/tasks/today`. The following behavior was exercised:

- Render the Tasks shell with the local synchronization state and empty Today view
- Capture `Browser QA capture` through the keyboard-first task field and Enter
- Open the captured task, add notes, and save the inline editor
- Reopen the task and verify that the saved notes persisted
- Inspect the rendered interface at the default desktop viewport
- Inspect the rendered interface at a 390 by 844 mobile viewport
- Verify that the mobile document width remained 390 pixels with no horizontal overflow
- Inspect the page for Vite and React framework error overlays
- Inspect captured browser warnings and errors

## Results

Authentication, routing, local capture, inline editing, persistence, desktop rendering, and mobile rendering passed. The mobile layout exposed its dedicated bottom navigation, retained the Today task row and capture control, and did not overflow horizontally. No Vite or React error overlay was present.

The browser console contained no application error. It reported the two existing React Router v7 future-flag warnings for transition wrapping and relative splat-path resolution. These are dependency migration notices and did not affect the tested workflow.

The default desktop navigation and the 390-pixel mobile navigation remained usable without a blocking overlay or clipped primary control. The task title, completion control, action menu, capture field, reminder-readiness notice, projects entry point, templates entry point, and mobile planning views were all exposed through named interactive elements.

## Cleanup

The browser session and temporary viewport override were finalized, the Vite process was stopped, and the disposable local Supabase user was deleted. Cascade cleanup was verified with zero matching rows in `auth.users` and `tasks_todos`.

## Remaining Boundaries

- This pass validates the local in-app browser runtime, not production hosting, PowerSync, push delivery, Safari-specific behavior, or an installed iPhone shell.
- React Router v7 migration warnings should be handled as part of a deliberate router upgrade rather than folded into the Tasks feature change.
- Production synchronization, production reminder delivery, lived parallel use, product identity, and optional native Apple surfaces remain separate approval gates.
