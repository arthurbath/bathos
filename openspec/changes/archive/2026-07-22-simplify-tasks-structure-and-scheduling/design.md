## Context

BathOS Tasks currently stores `today_section` as a non-null value independent from `start_date`, stores each reminder's own local calendar date, validates `deadline >= start_date`, and synchronizes a dedicated headings table plus `heading_id` references. Those choices were intentionally broad but do not match the owner's simpler Things-derived workflow. The changes cross PostgreSQL constraints and functions, PowerSync, the MCP Edge Function, export/restore, templates, recurrence, React editing and presentation, and external capture compatibility.

The production database currently uses Tasks export schema 11 and an exact 22-table PowerSync publication. Existing user content must be preserved, current integrations must fail safely during rollout, and the public repository must not acquire deployment secrets.

## Goals / Non-Goals

**Goals:**

- Make `start_date` the future-only anchor for reminder time while retaining independent day horizons for active Today work on both to-dos and projects.
- Preserve a simple optional Area → Project → To-do organization while allowing unattached projects and to-dos.
- Remove headings from every active product, API, persistence, synchronization, and documentation surface without deleting the to-dos they formerly grouped.
- Permit a start date later than a deadline and preserve the overdue signal.
- Add the `rechecking` actionability state as a first-class structured value.
- Present notes in one directly editable Markdown source surface whose punctuation remains visible, whose indicator symbols use a fixed-width font, and whose safe custom schemes are actionable.
- Keep legacy export restore and deployment sequencing deterministic and testable.

**Non-Goals:**

- Add generic tags, multiple project or area membership, arbitrary hierarchy depth, multiple reminders, or reminder recurrence.
- Change deadline-based Upcoming fallback when no future start date exists.
- Migrate Things content or make BathOS Tasks authoritative for the owner's work.
- Add native Apple reminder surfaces or publish an App Store application.

## Decisions

### Start date is a future-only deferral date

`tasks_todos.today_section` and `tasks_projects.today_section` remain nullable, but they no longer require a stored start date. The valid planning states are:

- Someday with no start date, day horizon, or reminder;
- active Anytime with no start date and no day horizon;
- active Today with no start date and one `inbox`, `now`, `next`, or `later` horizon; or
- deferred Upcoming work with a future start date, one horizon, and an optional reminder time.

Assigning a future start date without an explicit horizon writes `next`. Assigning today or an earlier date is rejected at every user or automation boundary. When the owner-local date arrives, an idempotent activation operation clears `start_date`, retains `today_section`, and leaves the item in Today and Anytime. Web clients activate synchronized due work at startup and date rollover so offline planning remains coherent, while a once-per-minute server job provides the same transition for MCP and background-only use. Read projections remain defensive and treat an unnormalized reached date as active until the durable transition catches up.

Ordinary capture writes no start date and the `next` horizon. Removing work from Today clears only the horizon. Moving to Someday clears the date, horizon, and reminder. Templates, recurrence, restore, and legacy data normalize reached dates into the active undated state while retaining or defaulting the horizon.

Alternative considered: retain today and past dates as historical availability facts. That would make Start Date mean two different things and would keep irrelevant dates visible in Anytime, contrary to the requested deferral-only model.

### Reminder input is a local time, resolved against the future start date

Each to-do or project retains at most one active reminder. The save contract accepts local time, IANA time zone, and daylight-saving ambiguity choice, but not an independently editable date. PostgreSQL reads the owned parent item's future `start_date`, rejects a missing or reached date, and resolves the instant from that date plus the supplied time. Changing a future date re-resolves an existing reminder and replaces its pending occurrence. Manually clearing or replacing the future date cancels or rebinds the schedule.

Automatic date activation is the narrow exception to ordinary clearing. It clears the parent date without canceling that date's immutable scheduled occurrence, so a 3:00 PM reminder still delivers after the task activates at the beginning of the day. The active reminder record remains delivery-authoritative for that one occurrence but is hidden from editing once the parent has no future date. A later explicit future schedule may replace it through the normal revision boundary.

Existing active reminders whose parent has a start date are rebound to it while retaining local time and time zone. Any active reminder whose parent lacks a start date is canceled rather than inventing a date.

Alternative considered: continue storing an arbitrary reminder date while merely hiding it. That would leave invalid states available to MCP, restore, synchronization, and future clients.

### Deadline and start date are independent facts

All database, UI, MCP, template, recurrence, bulk-planning, and restore checks that require `deadline >= start_date` are removed. A deadline remains an informational boundary and overdue indicator even when the item is deliberately rescheduled after it. Date syntax and owner-local calendar validation remain unchanged.

### Heading removal preserves child work

Before dropping `tasks_headings` and `tasks_todos.heading_id`, the migration clears each heading reference while retaining the task's existing `project_id`, `area_id` relationship, hierarchy order, stable identifier, planning state, checklist, history, and source metadata. Heading records themselves are removed after a private predeployment backup and content-free row-count review.

New export schema 12 omits headings and heading references. Replacement and merge restore accept schemas 3 through 11 by discarding legacy heading objects and placing their to-dos directly in the referenced project; schema 12 validates only areas, projects, to-dos, and checklist items. Immutable historical JSON may retain legacy keys for audit compatibility, but no current row, tool, view, generated snapshot, or user-facing label exposes headings. Project-template revisions normalize legacy heading nodes away during instantiation, preserving descendant to-dos directly beneath the project.

PowerSync removes `tasks_headings` from the client schema, Sync Streams, publication, role grants, topology verifier, and disposable fixtures as one exact change, yielding 21 synchronized tables.

Alternative considered: hide headings only in React. That would preserve unnecessary complexity and allow automation or restore to recreate a concept the user explicitly removed.

### The shallow hierarchy is represented by single nullable foreign keys

A to-do has nullable `area_id` and nullable `project_id`; a project has nullable `area_id`. Each field is scalar and owner-scoped, so multiple membership is impossible. When a to-do belongs to a project, the project is the canonical area path and a conflicting direct `area_id` is cleared. Unattached to-dos and projects remain valid.

### Rechecking is the third actionability state

The closed actionability set becomes `actionable`, `waiting`, and `rechecking`. `actionable` remains the default. `waiting` means another party or external event is expected to unblock the item; `rechecking` means no signal is expected and the owner must deliberately test availability again. The value participates in history, templates, export/restore, filters, search, MCP, synchronization, and accessibility labels exactly like the existing values.

### Notes use one live-styled source editor

An expanded to-do renders one content-editable, source-preserving notes surface. It stores plain text and applies styling while the user types without changing the saved source, moving the caret, or requiring an Edit Notes or Preview Notes action. The supported Markdown subset is intentionally narrow: one or more leading hashmarks plus a space for headings, single-asterisk italic, double-asterisk bold, asterisk-plus-space bullets, Markdown links, and single-backtick inline code. Every delimiter remains visible. Heading, emphasis, strong, bullet, and link indicators use a fixed-width font. Inline code uses a fixed-width font across the complete delimited string and a light semantic background.

Asterisk bullets use a two-character hanging indent. Pressing Enter in a bullet starts the next line with `* `. Link recognition covers Markdown links plus bare HTTP(S) and alphanumeric `scheme://` values such as `message://`. Known executable or content-injection schemes, including `javascript`, `data`, and `vbscript`, remain inert. HTTP(S) keeps normal web-tab behavior, and application schemes remain real anchors so the operating system can dispatch them.

The editor preserves selection as it retokenizes, defers decoration during composition, accepts plain-text paste, and auto-grows with its contents. Clicking a safe decorated link explicitly activates it even though the surrounding surface remains content-editable. HTTP(S) opens in a new browser context, which hands the destination to the system browser from an installed PWA; `message://` uses operating-system dispatch. Link styling uses the semantic info color and pointer cursor without hover underlining. App-level undo and redo take precedence over editor-local or browser history. A plain textarea overlay was rejected because mixed heading and fixed-width metrics would make the visible text diverge from the real caret. A semantic `react-markdown` editor was rejected because reconstructed delimiters are lossy for nested or irregular source.

### Primary Link is editable without weakening provenance

`tasks_todos.primary_link` stores one optional user-editable shortcut separately from structured `source_*` fields and `tasks_mail_sources`. Mail capture initializes both the immutable audited deep link and the editable Primary Link from the same verified `message://` value. Later Primary Link edits do not alter source identity, Mail retirement history, or capture idempotency.

A trimmed value beginning with `message://` uses the Lucide Mail icon and operating-system activation. A value beginning with `http://` or `https://` uses Lucide Link and opens in a new browser context. Every other nonblank value also uses Link and is activated as an HTTPS destination by prepending `https://`. The literal stored value remains visible and editable. Empty values render no Primary Link action, while structured provenance may retain a non-actionable origin indicator.

### To-do editing is autosaved and ordered

An expanded to-do has no Save or Cancel action and no keyboard-save chord. Title and notes changes update the local editor immediately and coalesce through a short debounce before persistence. Selects, dates, organization, reminder time, and reminder ambiguity persist as soon as the user changes them. The editor serializes all task and reminder writes in interaction order so a slower earlier request cannot overwrite a later value. Closing or replacing the editor flushes any pending debounced draft before a deferred completion transition is submitted.

Autosave does not disable unrelated controls or show a routine saving indicator. An accepted task patch remains an ordinary Tasks mutation and therefore appends the same owner-scoped history event used by app-level undo and redo. Debouncing may combine adjacent keystrokes into one history event, while discrete changes remain separately undoable. A failed write uses the existing destructive error notice, preserves the current local draft while the editor remains open, and leaves subsequent edits available for another persistence attempt. Blank title drafts remain locally editable but are not submitted; closing restores the most recently persisted nonblank title.

Alternative considered: keep explicit Save and Cancel as a fallback. That preserves a form-transaction model even though the fields have no cross-field commit boundary, makes closing ambiguous, and prevents each accepted edit from feeling native to the list.

### Expanded to-dos behave as lightweight inline surfaces

Opening a to-do mounts its editor in a clipped grid row and expands it over 150 milliseconds while fading it in. Closing reverses the transition before unmounting the editor. After expansion begins, the complete task row scrolls smoothly only as much as needed to become visible. The Tasks reduced-motion scope removes the transition and smooth scrolling when the operating system requests reduced motion.

A capture-phase pointer listener closes the current editor when a pointer interaction begins outside its task row. Portaled calendars, menus, listboxes, and dialogs launched by that row remain part of the editing interaction. Another task title retains its existing direct replacement path so the current autosave is flushed exactly once before the next editor opens. Outside closure uses the same ordered autosave flush and deferred-completion finalization as every other close path.

While the editor remains open, the list retains that to-do at its original view position and original Today or Upcoming grouping. Autosave still writes each metadata change immediately, and the editor continues showing the latest local values. The frozen display projection is released only after the ordinary close path finishes, at which point current data determines membership and grouping. This protects repeated Start Date, horizon, deadline, and organization edits from unmounting or moving the editor.

The compact editor places Actionability and Organization together, then Start Date, Day Horizon when relevant, and Reminder Time on one responsive row, followed by Deadline. Active Today work may show its retained Day Horizon without a Start Date under the final future-only model, while Reminder Time remains available only for a future Start Date. Keyboard traversal scrolls the focused title field into the nearest visible position after disclosure begins instead of scrolling the complete potentially long row.

### Date summaries are relative near the planning date

Date-only summaries compare against the owner-local planning date. They render `Today`, `Tomorrow`, `one day ago`, `N days ago`, or `N days left` for offsets whose absolute value is at most 10. Dates farther away use the locale's short month and numeric day, such as `Aug 27`. This wording applies to Start Date, Deadline, and reminder row summaries without changing the exact date stored or exposed through accessible controls.

### Modifier commands own Tasks keyboard operation

Tasks installs one capture-phase command router while its route is mounted. Every documented app command prevents the matching browser action and stops later keyboard handlers before dispatching the Tasks action. The close-and-clear-focus command also has an idempotent capture-phase keyup fallback for browser surfaces that reserve the corresponding editable-control keydown. Command is the application modifier on Mac, and Control is the application modifier on Windows, except for the explicitly Control-based task traversal and lifecycle commands. Undo and redo are claimed even inside editable controls and even when no app history action is currently available, so Safari or another browser never receives a fallback history command.

Command+N or Control+N focuses capture. Command+/ or Control+/ opens keyboard help. Command+1 through Command+8, or Control+1 through Control+8 on Windows, navigate directly to Today, Upcoming, Anytime, Someday, Projects, Templates, Done, and Config. The previous N, slash, question mark, G-sequence, C, M, W, and unmodified arrow command bindings are removed. Enter remains ordinary button activation, Tab remains traversal, and text entry remains native except when a documented Tasks modifier command owns the chord.

Control+S on Mac or Control+Shift+S on Windows closes the current editor and opens the next visible to-do. With no editor open it starts at the first visible to-do. Control+W or Control+Shift+W performs the inverse and starts at the final visible to-do. At a list boundary the current editor closes without wrapping. Every newly opened to-do focuses its title input with the insertion point at the end and scrolls only as needed to keep the editor visible. Control+X or Control+Shift+X closes the current editor and leaves no page control focused.

Completion is immediate for a closed row. While a to-do is open, its completion control and Control+D or Control+Shift+D toggle a pending completion mark without transitioning lifecycle. Closing or replacing that editor commits the pending completion exactly once. This keeps the editor available for remaining metadata changes while making doneness part of the open editing session.

## Risks / Trade-offs

- [Dropping headings can orphan perceived grouping] → Preserve every child to-do's project, stable identity, and order; record predeployment counts and take a verified private backup before production migration.
- [Legacy templates or exports may contain headings] → Normalize schemas 3 through 11 and legacy template revisions through explicit compatibility tests before schema 12 becomes current.
- [Reminder start-date changes can race delivery] → Re-resolve and replace pending occurrences transactionally under optimistic revision checks; delivery claims continue using immutable occurrence revisions.
- [A web release before its migration would emit invalid writes] → Deploy database and MCP compatibility first, verify PowerSync, then publish the web client; keep the old client valid during the bounded rollout where feasible.
- [Removing a synchronized table changes production topology] → Update all publication, grants, stream rules, client schema, and verifiers together and require a fresh projection before acceptance.
- [Custom URI schemes can invoke local applications] → Keep the user's literal destination visible, block executable/content schemes, and rely on explicit anchor activation rather than automatic navigation.
- [Live decoration can move the caret or break composition] → Retokenize from plain text with selection-offset restoration, pause decoration during IME composition, and cover typing, selection, paste, undo, and bullet continuation with focused tests.
- [Autosave requests can resolve out of order or be lost on close] → Serialize every editor mutation, debounce only free text, flush before close-dependent transitions, and test rapid edits plus close-time persistence.
- [A planning autosave can remove or regroup the editor being used] → Freeze only the open row's list projection, keep its editable state current, and release the projection through the single close path.
- [Automatic activation can cancel a same-day reminder before delivery] → Distinguish idempotent due-date activation from manual clearing and preserve the already-resolved occurrence through dispatch.
- [An editable shortcut could corrupt audited source identity] → Store Primary Link separately and keep Mail source equality constraints and retirement history unchanged.
- [Outside pointer handling can interrupt a portaled editor control or race task replacement] → Treat editor-owned overlays as inside, leave title-to-title replacement on its existing path, and route every other outside close through the single ordered close function.
- [Null day horizons change default capture behavior] → Normalize ordinary unspecified capture and explicit Today/day-horizon requests to an undated active item with the Next horizon; only an explicit Anytime request remains undated and outside Today.

## Migration Plan

1. Add failing domain, component, MCP, export/restore, pgTAP, and topology tests for the new invariants and compatibility behavior.
2. Generate a Supabase migration with the CLI, then implement schema-12 normalization, reminder rebinding, heading preservation/removal, actionability expansion, date-range relaxation, and exact privilege/RLS changes.
3. Update PowerSync, repositories, MCP tools and Edge Function, templates, recurrence, UI, notes parsing, search, documentation, and generated types.
4. Run local database reset and all pgTAP tests, focused Tasks tests, the full suite, Tasks typecheck, lint, production build, strict OpenSpec validation, export/restore round trips, and topology checks.
5. Inspect production content-free counts for headings, affected horizon/reminder rows, and actionability values; create and verify a private backup; obtain explicit approval for the exact migration, 21-table PowerSync normalization, MCP deployment, and web release.
6. Apply the approved database and MCP changes, normalize PowerSync, publish the web client, run cleanup-backed synthetic acceptance plus authenticated Safari acceptance, and prove zero fixture residue.

Rollback before production is ordinary code and migration replacement. After production heading removal, rollback requires the verified private backup because recreating heading records from flattened current rows is not lossless; therefore the migration is gated on backup verification and explicit approval.

## Open Questions

None. The owner delegated naming of the third actionability state; this design uses `Rechecking` because it denotes repeated owner-driven availability tests without implying an expected external signal.
