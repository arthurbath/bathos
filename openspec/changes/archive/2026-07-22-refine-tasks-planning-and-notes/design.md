## Context

Tasks currently derives Today and Anytime from `start_date`, `today_section`, and lifecycle state, but Upcoming queries only future start dates. Drag ordering refuses a target in a different Today horizon, list rows use completion and selection shapes opposite the requested meaning, terminal actions remove rows immediately, and notes use a fixed-height textarea. The new 100-step undo cursor is reconstructed incrementally from independently synchronized task and history projections, which can temporarily expose the prior event while a newer task mutation has arrived without its matching history row.

The task model remains tagless and offline-first. Supabase remains authoritative for accepted mutations and exact history snapshots, while PowerSync can project related rows in either order. The UI must preserve single-click expansion, selection gestures, keyboard alternatives, semantic colors, reduced-motion behavior, and module isolation.

## Goals / Non-Goals

**Goals:**

- Make Today drag ordering update horizon and fractional order together when the drop target belongs to another visible horizon.
- Make Upcoming include future start or deadline relevance and present stable day, month, and year groups.
- Preserve the current Anytime availability rule and make Today membership legible with compact yellow leading icons.
- Give completion, bulk selection, and terminal removal the requested shapes and feedback.
- Prevent projection skew from presenting a stale history event as immediately undoable, without weakening exact server-side snapshot guards.
- Render complete safe Markdown notes while retaining plain-text storage, editing, keyboard access, and full-height content.

**Non-Goals:**

- Showing empty Today horizon headings or allowing a drop into a hidden empty horizon.
- Adding tags, a second notes format, raw HTML, embedded remote media, or arbitrary scriptable Markdown.
- Relaxing stale-revision, ownership, RLS, or exact history-snapshot enforcement.
- Changing Done retention, reminder scheduling, PowerSync publication membership, or project-hierarchy ordering.

## Decisions

### Derive one Upcoming controlling date

For each open present Anytime item, the client derives a controlling date as follows:

1. Use `start_date` when it is later than the owner-local planning date.
2. Otherwise use `deadline` when it is later than the planning date.
3. Otherwise omit the item from Upcoming.

This makes a future start date authoritative even when it falls after an inconsistent deadline, while still surfacing future deadlines for already available or undated work. The next seven owner-local dates receive individual day groups. Later dates through the calendar date 12 months after today receive month groups. Dates beyond that boundary receive year groups. One domain utility supplies selection, sorting, group keys, and labels so queries, tasks, projects, and tests do not drift.

Alternatives considered: grouping independently by both dates would duplicate one stable task and make ordering ambiguous. Always preferring any start date would hide an approaching deadline after the task became available.

### Treat a cross-horizon Today drop as one planning mutation

`reorderTaskTo` will permit a Today source and target in different sections. It computes the fractional key against the target section with the source removed, then updates `today_section` and `order_key` together. Ordinary keyboard and menu reordering remain section-bounded because they have no explicit cross-section target. The UI keeps rendering only nonempty headings, so a row can enter only another horizon already visible through a target row.

Alternative considered: rendering four permanent drop zones would violate the explicit request to hide empty horizons.

### Rebuild and validate the undo cursor against current projections

The client will rebuild its bounded cursor from the complete projected history slice whenever that slice changes instead of incrementally applying newly observed rows in arrival order. It will separately read the task referenced by the cursor tip and expose undo or redo only when the projected task snapshot matches the required source snapshot. A new local task mutation can therefore make history temporarily unavailable until its matching accepted event arrives, rather than submitting a known-stale inverse. Repository and database guards remain unchanged unless a synthetic failing fixture proves a separate server defect.

Alternative considered: skipping an unsafe cursor tip and undoing an older event would violate global action order. Weakening exact snapshot equality would risk overwriting intervening changes.

### Use semantic icon position and control shape

Today membership on Anytime rows uses `text-warning` and a leading Lucide horizon icon. Upcoming keeps a leading horizon indicator for its future placement. Inbox uses `Inbox`, Next uses `ListStart`, task completion uses `Square`, and bulk selection uses circular selected and unselected controls. Accessible names continue to state the actual horizon or action.

### Animate terminal removal locally before optimistic disappearance

The row enters a short grid-collapse and opacity transition before the terminal repository action removes it from the projected list. Reduced-motion clients skip the visual delay. A failed mutation restores the row and its focus rather than leaving hidden content. This keeps the database operation authoritative and avoids retaining terminal rows in application data merely for animation.

### Render notes safely from plain Markdown

Notes remain plain text in `tasks_todos.notes`. The expanded editor defaults nonempty notes to a full-height Markdown preview and exposes a compact Edit Notes control. Edit mode uses an auto-growing textarea with no internal scroll area. Preview uses `react-markdown` and `remark-gfm`, rejects raw HTML execution through the parser's default behavior, renders safe links as real new-tab anchors, and applies explicit BathOS classes to paragraphs, lists, emphasis, strong text, and inline code. Empty notes open directly in edit mode.

Alternative considered: a styled content-editable overlay would require lossy HTML-to-Markdown conversion and would make selection, links, and assistive technology less predictable.

## Risks / Trade-offs

- [Projection skew can briefly withhold undo] -> Report the command as unavailable until the task and history snapshots agree, then enable it automatically when synchronization converges.
- [Cross-horizon drops can change both order and meaning] -> Limit them to Today, use the visible target row as the explicit destination, and cover before and after placement in tests.
- [Calendar boundaries can be ambiguous] -> Use date-only arithmetic and the owner's planning date rather than browser instants.
- [Markdown can create unsafe or surprising links] -> Keep raw HTML disabled, use the parser's safe URL transform, add `noopener noreferrer`, and test disallowed protocols.
- [Completion animation can delay mutation slightly] -> Keep the duration short, skip it for reduced motion, and disable repeat actions while pending.
- [Installed clients can retain a prior atomic offline shell after a web release] -> Advance the versioned Tasks worker URL with each published shell, verify the deployed worker version, and reload an existing authenticated installation before closeout.

## Migration Plan

1. Implement and validate domain derivation, cursor gating, and React presentation locally.
2. Add a Supabase migration only if the reproduced undo failure requires database behavior beyond the projection-order fix.
3. Run focused Vitest, Tasks TypeScript, lint, production build, strict OpenSpec, and pgTAP when schema behavior changes.
4. Verify desktop and mobile rendered behavior with the Browser plugin, including cross-horizon drag, Upcoming buckets, animation, Markdown links, and console health.
5. Obtain explicit production approval for any new migration and for the matching web release, advance the versioned Tasks worker URL, then use cleanup-backed synthetic and existing-installation acceptance before archiving.

Rollback is a web release rollback when no schema change is needed. If a database migration is required, its replacement trigger or function will be versioned and reversible without rewriting personal task rows.

## Open Questions

None. The supplied screenshot confirms the implemented metadata, prose, bullet, long-link, and plain `message://` presentation contract.
