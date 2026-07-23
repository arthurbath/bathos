## Context

The open to-do editor currently presents Start Date, Day Horizon, and Reminder Time as separate controls. `TaskWhenDialog` duplicates part of that planning model, while the row menu combines structural movement, temporal planning, manual ordering, cancellation, and deletion. Reminders are server-owned records whose dates are currently forced to equal a root's future-only `start_date`.

Mail capture stores immutable provenance in source records and initializes a separate editable `primary_link`. The current `tasks_private.normalize_todo_primary_link` trigger treats a later explicit `NULL` exactly like a missing initial value and repopulates it from `source_url`, violating that separation.

The supplied Things screenshot is a structural interaction reference, not a visual system to copy. BathOS remains dark-only, neutral, Lucide-based, and composed from its existing Button, Popover, Calendar, Input, and semantic tokens.

## Goals / Non-Goals

**Goals:**

- Provide one compact Start field and keyboard-complete picker for Today horizons, future dates, reminder time, and clearing.
- Make Today reminders first-class and server-authoritative.
- Give the row menu a clear Move, Do, and Start information architecture.
- Preserve explicitly cleared Primary Links through synchronization, reopen, export, and restore.
- Keep immediate autosave, undo/redo, focus restoration, and module isolation intact.

**Non-Goals:**

- Change Deadline behavior or merge Deadline into Start.
- Remove cancellation from the underlying domain, MCP, history, or Done recovery model.
- Remove drag or Option/Alt-arrow manual ordering.
- Reproduce Things artwork, color, layout measurements, or platform-specific decoration.
- Add a reminder date independent from task planning.

## Decisions

### One Tasks-owned picker composed from shared primitives

Add a Tasks-local `TaskStartPickerField` that composes the shared Popover and Calendar primitives. It renders four semantic Today-horizon buttons, a future-only calendar, an inline time input, and one Clear action. The trigger summarizes the complete current intent. The shared Calendar gains only an opt-in `allowTabExit` behavior so ordinary date fields keep their established key handling.

This keeps Tasks-specific planning out of shared UI while preserving the established calendar implementation and BathOS appearance. Reusing the stock `DatePickerField` unchanged was rejected because it closes after one date selection and cannot own horizon or reminder controls.

### Immediate, ordered persistence

Picker selections call the editor's existing ordered mutation queue. Horizon and future-date choices persist the task patch immediately. Reminder time persists through the existing reminder service after its planning anchor is accepted. Clear cancels the reminder first when needed and clears `start_date` and `today_section` as one requested planning mutation.

For new local drafts, the same component updates draft state without remote mutation until a nonblank title creates the task.

### Effective reminder date

The effective reminder date is:

1. the future `start_date`, when present; otherwise
2. the owner's current planning date, when `today_section` is non-null; otherwise
3. unavailable.

The reminder save RPC and normalization trigger derive this date server-side from authenticated owner settings. Root-planning triggers rebind an active reminder when either `start_date` or `today_section` changes. Moving to truly undated work cancels the reminder. Reached-date activation preserves a reminder already anchored to that date.

This retains one reminder date source of truth without preventing Today reminders. Adding a nullable independent reminder date to the editor was rejected because it would recreate the fragmentation the unified picker removes.

### Menu surfaces match intent

The row menu keeps actionability and Delete, then exposes:

- Move: area/project placement
- Do: Today, Anytime, Someday, and related temporal destination actions
- Start: the same unified Start picker used in the editor

Cancel, Move Up, and Move Down disappear from the menu. Domain cancellation, drag ordering, and keyboard ordering remain available where already supported.

### Initial source default differs from later user intent

`normalize_todo_primary_link` trims all writes, but only initializes a Mail `source_url` during INSERT. An UPDATE that explicitly supplies null remains null. Export normalization similarly falls back from Mail provenance only when the `primary_link` key is absent in an older envelope, not when the key is present with a null value.

## Risks / Trade-offs

- **[Risk] Root planning and reminder writes race across two server mutations** → The client preserves ordered operations, and the reminder RPC derives the accepted root state rather than trusting a client-supplied date.
- **[Risk] A Today reminder time is already past** → The server still records the exact owner-local intent; existing due-claim behavior makes it immediately eligible rather than silently moving it.
- **[Risk] Shared Calendar Tab behavior changes other modules** → The new traversal behavior is opt-in and defaults to the current Tab interception.
- **[Risk] PowerSync projects a temporarily stale Primary Link or reminder** → Optimistic task/reminder overlays retain the requested value until the authoritative projection catches up, and acceptance tests reconcile both.
- **[Risk] Export restore revives a deliberately cleared legacy Mail link** → Presence-aware normalization distinguishes an absent historical field from explicit null.

## Migration Plan

1. Create and verify a private production backup immediately before mutation.
2. Apply one additive/replacement migration that:
   - changes Primary Link initialization to INSERT-only,
   - makes export normalization preserve explicit null,
   - derives reminder date from future Start or Today planning,
   - replaces reminder-save and root-rebind functions/triggers without changing table shape or PowerSync publication membership.
3. Regenerate checked-in Supabase types if the RPC signature or result types require it.
4. Deploy the matching web release.
5. Run an owner-scoped disposable fixture covering Mail-link clearing, Today reminder, future reminder, planning rebind, and clear/cancel behavior, then remove it.
6. Verify the PowerSync projection returns the accepted null Primary Link and reminder state.

Rollback restores the prior function and trigger definitions. It does not require a data rollback because no table shape or existing content is destructively rewritten.

## Open Questions

None. The requested interaction and the existing task domain provide sufficient constraints.
