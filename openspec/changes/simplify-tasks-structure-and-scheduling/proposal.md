## Why

Tasks currently exposes more scheduling and hierarchy flexibility than the personal workflow needs: reminders can target arbitrary dates, day horizons can exist without start dates, deadline validation forbids intentionally overdue work, and headings add a fourth organizational layer. The module should instead make start dates the single scheduling anchor, keep the hierarchy deliberately loose and shallow, preserve useful Markdown source cues, and model every required actionability state directly.

## What Changes

- **BREAKING** Redefine Start Date as a future-only deferral date. Active work stores no reached or past start date, future work remains only in Upcoming, and activation clears the date while retaining its chosen `inbox`, `now`, `next`, or `later` day horizon.
- **BREAKING** Tie each to-do or project reminder to its future start date and one local reminder time. Clearing a future date cancels its reminder, while automatic activation preserves an already-scheduled same-day occurrence long enough to deliver it.
- **BREAKING** Make day horizon nullable and independent for active work. A future start date always has a horizon, defaulting to `next`; an active undated item may retain a horizon for Today or null for Anytime.
- Allow a start date later than the deadline so overdue work can remain deliberately scheduled and active.
- Show Day Horizon for active Today or deferred work, and show Reminder Time only while an item has a future start date.
- **BREAKING** Remove headings from the database, synchronized projection, MCP surface, templates, export/restore, history, deletion, search, UI, and documentation while preserving each heading task as an ordinary task in its existing project.
- Preserve the shallow optional hierarchy: a to-do has at most one area and at most one project; a project has at most one area; every relationship is optional.
- Replace separate notes preview and editing modes with one directly editable, live-styled Markdown source surface. Support headings, italic, bold, asterisk bullets, Markdown links, and inline code while keeping every source symbol visible and rendering Markdown indicator symbols in a fixed-width font. Continue recognizing non-executable alphanumeric `scheme://` note links such as `message://` alongside HTTP(S).
- Replace explicit to-do Save and Cancel actions with serialized autosave. Debounce free-text changes, persist discrete controls immediately, flush the final draft when an editor closes, expose no routine saving indicator, and retain every accepted autosave batch in app-level undo and redo history.
- Animate each to-do editor's quick expansion and collapse, smoothly reveal the opened row when scrolling is required, and close the autosaved editor when a pointer interaction lands outside its row or an editor-owned overlay.
- Keep an open to-do pinned to its original visible position and planning group until its editor closes, even while autosaved metadata changes its eventual view membership.
- Add one editable Primary Link beneath notes. Mail capture initializes it from the audited `message://` source without making provenance mutable, and row iconography and activation follow the editable value.
- Make safe note links explicitly clickable inside the live editor, use pointer affordance without hover underlining, and open web or Mail destinations through their appropriate platform behavior.
- Use compact paired editor rows and relative date summaries, and reveal a keyboard-traversed task by its focused title rather than the bottom of a long editor.
- Replace global single-character shortcuts with modifier-based Tasks commands that suppress matching browser actions, provide direct numbered view navigation, move forward and backward through visible to-dos, defer completion while an editor remains open, and close an editor without leaving page focus behind.
- Add `rechecking` as the third structured actionability value next to default `actionable` and `waiting`, representing blocked work whose availability the owner must deliberately test again without expecting an outside signal.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Change reminder, day-horizon, calendar-order, hierarchy, notes, actionability, template, export/restore, synchronization, accessibility, and MCP-facing Tasks behavior.
- `mcp-module-actions`: Remove heading tools and fields, accept the three actionability states, enforce future-only scheduling with independent day horizons and Start-Date-anchored reminders, and allow deliberately overdue work.

## Impact

- Tasks React views, autosave sequencing, editor state, live Markdown source editing, domain derivation, repositories, hooks, templates, search, accessibility labels, and tests.
- Supabase tables, checks, triggers, RPCs, export schema, restore compatibility, reminder occurrences, MCP Edge Function, pgTAP coverage, and generated client types.
- PowerSync schema and sync rules: `tasks_headings` leaves the approved publication and client schema, reducing the synchronized Tasks topology from 22 tables to 21.
- Existing heading rows and heading references require a preserving migration; existing reminders and day horizons require deterministic normalization rather than deletion of user task content.
- The Tasks human guide, README surface descriptions, durable readiness evidence, and external consumers of the Tasks MCP contract.
