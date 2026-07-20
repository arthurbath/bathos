## Context

The user has relied on Things as a central planning system for many years and intends to continue using it while BathOS develops a replacement. The goal is not rapid migration. The goal is to earn trust through an extended period of parallel use.

The current Things library is modest. A bounded read-only AppleScript inventory on 2026 Jul 19 found hundreds, not tens of thousands, of active and historical records, a small area/project hierarchy, two template projects, and two narrowly used labels. Scale should be handled responsibly, but migration volume is not a primary architectural risk.

The unusual parts of the current workflow are semantic. Template projects are used to generate reusable work. A small number of tags mark to-dos that cannot be acted on immediately. Some title prefixes encode source or meaning. The BathOS module should represent these concepts directly rather than carry forward tag and title conventions as canonical data.

BathOS already provides React, TypeScript, Supabase Auth, RLS, and an OAuth-authenticated MCP server. Its current installable-web-app support does not provide offline data operation or native Apple extensions. A native Apple companion may eventually be needed for notifications, widgets, controls, and other system surfaces, but it is not an initial requirement.

The repository is public. Product documentation, migrations, tests, fixtures, and logs must not contain personal Things titles, notes, area names, project names, or other private content. Discovery findings committed to the repository must be generalized or aggregated.

## Current Workflow Catalogue

This catalogue records generalized behavior observed on 2026 Jul 19 through bounded read-only inspection of Things and the local capture systems that feed it. It deliberately excludes personal task content. The catalogue should be revised whenever parallel use reveals a different behavior or priority.

### Capture

- Manual capture is keyboard-first. Global shortcuts open Things or one of its quick-entry surfaces without requiring navigation through the main application.
- General quick entry and context-aware quick entry are distinct workflows. Context-aware capture may attach information from the active application.
- Browser reading capture runs through Raycast and Inbox Manager. It creates an unassigned Today to-do with a visible reading-origin marker and preserves the source URL in the notes.
- Mail capture runs on a schedule through Inbox Manager. AI refines the title and notes before the to-do is created, stores durable message context and a source link, routes work mail to the work area, leaves personal mail unassigned, and schedules the result for Today.
- External capture origins are currently represented through title prefixes, note structure, and links. The BathOS module should store the origin and source reference as structured data, then derive any visible marker from those fields.
- Reusable projects and to-dos are currently held as template content inside Things. They are source material for future work, not ordinary active projects.

### Planning

- The Things Inbox is a temporary processing surface rather than a long-lived list. The observed Inbox was empty when inventoried.
- Automated reading and mail captures bypass the Inbox and enter Today because they have already been processed enough to be actionable.
- Today is the central daily commitment surface. Start dates, deadlines, areas, projects, Anytime, Someday, Upcoming, and This Evening provide conventional planning structure around it.
- Work and personal routing is intentionally lightweight. Work mail enters a dedicated area, while personal and reading captures remain unassigned.
- A narrow actionability distinction is currently carried by two tags. A bounded aggregate inventory found that both labels express the same underlying meaning: the to-do cannot be acted on immediately. These are not general labels and do not represent separate workflow states.
- Manual order matters because the list communicates execution intent, not only membership or chronology.

### Execution

- The main application can be activated globally, and high-frequency keyboard actions support completing the current to-do and advancing to the next one.
- Execution is centered on the ordered Today list. A task must remain visibly stable while it is edited, completed, moved, or saved.
- Source links are part of execution for captured webpages and mail. Opening the source record should not require searching for it again.
- Completion must be fast, reversible, and safe under delayed synchronization or repeated automation calls.

### Review, Completion, and Retention

- Completed and canceled to-dos enter the Logbook.
- Inbox Manager prunes Logbook items older than 30 days to Things Trash on a daily schedule. Long-term accumulation inside Things is therefore not a current requirement, but dependable backup and export remain required before BathOS holds valuable data.
- Source mail stays in its original Inbox until its Things to-do is retired, then moves to the destination recorded during capture. This lifecycle is specific to Mail and should remain an integration contract rather than a generic task rule.
- Things remains independent and authoritative during development. Parallel-use tasks in BathOS do not need dual writes or reconciliation with Things.

### Canonical Flow

The observed flow is:

1. A manual action or trusted source integration captures an item.
2. The capture path preserves source identity and performs any source-specific enrichment.
3. The item enters Inbox or Today, with optional area assignment, according to how much processing the capture path has already completed.
4. Planning assigns temporal and structural context, including order.
5. The user executes from Today through keyboard-first interactions and source deep links.
6. Completion moves the item into history, where it remains recoverable and exportable under an explicit retention policy.

## First Parallel-Use Slice

The first useful product slice will be **Capture and Run Today**. It is intentionally smaller than a Things parity milestone. It should prove that BathOS can safely hold a disposable but real set of daily tasks alongside Things.

The slice includes:

- Owner-scoped to-dos with stable identifiers
- Title, notes, structured origin, and an optional source link
- Inbox and Today destinations
- Stable manual ordering in Today
- Keyboard-accessible creation, editing, completion, and restoration
- Completion history and recoverable deletion
- Local persistence, offline creation and completion, restart survival, reconnection, and server reconciliation
- A minimal Raycast quick-entry path after the service contract is stable

The slice excludes areas, projects, headings, checklists, recurrence, reminders, templates, Mail integration, broad MCP mutation access, and native Apple surfaces. Those capabilities remain required roadmap work, but none is necessary to answer the first trust question: can the module reliably capture a task, keep it ordered and available offline, and complete it without losing or duplicating state?

The offline, reconciliation, conflict, and ordering architecture gate passed on 2026 Jul 19. Implementation of this slice can proceed on the selected module-local PowerSync foundation.

### First Integrated Local Slice

The first integrated browser slice landed under `/tasks/today` and `/tasks/inbox` on 2026 Jul 19. It uses the neutral internal label `Tasks` until the permanent product name and icon are selected. The route is lazy-loaded so PowerSync, WA-SQLite, its workers, and its WebAssembly files do not enter the initial BathOS application chunk. Vite emits the worker graph as ES modules and excludes PowerSync and WA-SQLite from dependency pre-bundling so the development and production worker paths remain valid.

The screen follows an original BathOS-native open-list composition: a restrained header status, Inbox/Today view switch, keyboard-first capture field, ordered task rows, quiet completion and action controls, and an in-place plain-text title and notes editor. It does not copy Things branding, iconography, sidebar anatomy, or exact row treatment. On small screens, Inbox and Today move to the shared BathOS bottom navigation and the active view becomes the page heading.

The first daily keyboard contract retains the high-value principles observed in Things without copying its complete shortcut map. Raycast owns global capture outside the browser. Inside the module, unmodified `N` focuses task capture, `/` opens unified search and navigation, `?` opens keyboard help, and a two-key `G` sequence navigates with `G I` for Inbox, `G T` for Today, `G U` for Upcoming, `G A` for Anytime, `G S` for Someday, `G L` for Logbook, `G P` for Projects, `G R` for Trash and recovery, and `G E` for Templates. The sequence appears in keyboard help rather than relying on memorization. When a task title has focus, Up and Down move focus without changing order, Enter opens editing, `C` completes, `M` opens structural movement, `W` opens temporal planning, and Option+Up or Option+Down reorders within the current scope. Command+Enter saves an open editor and Escape closes the current editor, picker, search surface, or help surface while restoring its invoking focus.

App-level shortcuts are inactive while focus is in an input, textarea, select, content-editable surface, or unrelated modal, except for the editor-specific save and cancel commands. Composition events are never interpreted as commands. The web client does not claim browser-critical shortcuts such as Command+1 through Command+9, Command+T, Command+L, Command+R, or Command+W. Tab and Shift+Tab retain native traversal, modified clicks retain native link behavior, every command has a visible control fallback, and supported controls expose `aria-keyshortcuts`. After completion or another action removes the focused row, focus moves to the row now occupying the same visual position, then the prior row, then capture or the view heading. Reordering retains focus on the moved task. Bulk-selection extensions may add commands later without changing this single-focus contract.

The accessibility trust gate exercised rendered task rows, the complete inline editor, unified search, and structural movement with synthetic data. Browser-faithful Tab and Shift+Tab tests proved the declared row and editor order, while the shared modal loop kept search traversal within a named dialog. An accessibility-name scan found a nonempty programmatic name for every rendered interactive control. Task command dialogs now explicitly declare title-only semantics. While the Tasks route is mounted, `prefers-reduced-motion: reduce` applies effectively immediate animation and transition timing across the complete route, including portal content, without changing motion elsewhere in BathOS.

The large-library gate uses 10,000 synthetic to-dos for view derivation and search plus a 1,000-row rendered view. The 2026 Jul 20 sample kept every view derivation below 1.2 ms p95, built the search index in 4.80 ms p95, filtered text in 0.32 ms p95, filtered structured fields in 0.07 ms p95, rendered 1,000 development-runtime rows in 956.72 ms, and opened search over 10,000 records in 313.23 ms. Search now precomputes normalized text and map-backed hierarchy labels when source data changes rather than repeating that work for every query. Row rendering remains nonvirtualized to preserve the established focus and assistive-technology order. Virtualization is justified only if observed active-view scale approaches the measured linear-render boundary and the replacement preserves the complete keyboard and screen-reader contract.

The implemented command layer keeps search, structural placement, and temporal planning separate. Unified search reads present owner-scoped records from the local PowerSync database, matches title, notes, structured source context, and hierarchy context, and filters on the typed destination, lifecycle, and source-kind fields without adding tags. View and task results are real links so browser modified-click behavior remains intact; an ordinary task-result activation navigates to its derived planning or Logbook view and focuses the stable record. The `M` surface updates only area, project, and heading references. The `W` surface reuses the planning transition contract for destination, Today section, and start date. Both commands have visible menu fallbacks, while `?` exposes the complete first-slice keyboard reference.

Bulk planning uses a separate, explicit selection mode in the five open planning views. It does not reinterpret the ordinary row-focus contract. While selection is active, the completion control becomes a labeled checkbox, activating a task title toggles that task, and a persistent toolbar reports the count with Select All, Clear, Plan Selected, and Done controls. The approved first set is limited to Move to Inbox, Today, This Evening, Tomorrow, Anytime, and Someday. Completion, deletion, actionability, and hierarchy changes remain single-record operations.

The repository validates the unique selected identifiers, loads every owner-scoped record, validates lifecycle and date constraints, and moves the complete set inside one local PowerSync transaction. Destination order keys are assigned after the existing destination tail in selection order. Any invalid member rolls back the complete set, while successful planning or deliberate exit clears selection. Remote synchronization still uses the established whole-record revision and conflict contract for each resulting row.

When no PowerSync service endpoint is configured, the module is fully usable in explicit local mode. A bounded browser exercise with synthetic data proved create-by-Enter, reload persistence, edit-and-notes persistence, completion, recoverable deletion, movement between Today and Inbox, owner-safe startup, and responsive rendering. The synthetic local records were cleared through the same full database-clear boundary used for an account change. The module remains intentionally absent from the launcher until its permanent public identity is resolved. The neutral Tasks route now has provisional install metadata and the shared BathOS icon so an installed Home Screen web app can use standards-based Web Push without pretending that the permanent product name or icon has been selected.

The real module's restart-and-reconnection gate passed against the complete production task schema on 2026 Jul 20. With both the write API and sync stream unavailable, browser task capture produced one durable queued mutation and retained the task across reload. Offline completion produced a second queued mutation and retained the completed task in Logbook across another reload. Reconnection drained the queue to zero. Postgres contained exactly one completed task at revision two and exactly two accepted history events: create from revision zero to one and complete from revision one to two. A final reload retained one synchronized Logbook record without duplication. The disposable harness lives under `spikes/tasks-module-reconnection/`; this proof does not select a production PowerSync topology.

The expanded offline-workflow gate passed on 2026 Jul 20 through the official PowerSync Node SDK against the same disposable Supabase and self-hosted PowerSync services. One disconnected client created, edited, rescheduled, reordered, completed, recoverably deleted, restored, and completed a server-generated recurrence occurrence, then closed its SQLite database with a nonempty durable upload queue. A new database process opened the same file, retained every local result, restored a deleted task, reconnected, drained the queue, matched the authoritative server revisions, and opened the synchronized database a second time without duplication. This exercise found and fixed two production-path defects: owner-safe template and recurrence RPC results needed explicit authenticated-owner hydration, and optimistic restoration with no container patch generated an invalid empty SQLite assignment. Template and recurrence definition changes remain connected operations; generated occurrences are ordinary durable task records and support the complete offline task mutation contract.

Task-list mutations use a module-local optimistic overlay above the reactive PowerSync query. The overlay applies edits, moves, completions, and recoverable deletions before the asynchronous write settles, remains visible while a stale query result is still present, and retires only when the query reaches the same client mutation or reflects the task's removal. A failed write removes the overlay and restores the query-backed record. Inline editor save and cancel return focus to the task-title control so query refresh and editor teardown do not disrupt keyboard continuity.

The minimal recovery slice exposes `/tasks/trash` as a first-class view without exposing permanent deletion. Deleted tasks retain their prior lifecycle, destination, and order on the same durable record, and Restore changes only the recoverable disposition so completed and canceled work remain terminal while open work returns to its prior list. The Trash query is newest-deletion-first, restoration is optimistic with rollback, and task capture is unavailable inside Trash. A browser exercise proved create, recoverable delete, Trash visibility, restoration, return to the original Today placement, and persistence after reload; the synthetic database was cleared afterward and the temporary QA reset control was removed.

The first Logbook slice exposes `/tasks/logbook` as the current terminal-work view. Present completed and canceled tasks are ordered by their respective terminal timestamp, display their terminal state and date, and cannot create new work in place. Reopen is an optimistic inverse lifecycle transition that returns the task to its retained Inbox or Today destination; Delete remains recoverable and moves terminal work to Trash without rewriting completion or cancellation state. Accepted completion, cancellation, reopen, and deletion events remain independently preserved in append-only history.

The first calendar-planning foundation stores optional start dates and deadlines as Postgres `date` values and PowerSync text projections, preserving the selected ISO calendar day without converting it to an instant. The database and local repository reject a deadline earlier than its start date, while either value may exist independently. Task editing uses the shared calendar popover and supports clearing either field. History snapshots, inverse undo, portable export and merge restore, optimistic state, and remote upload all carry the fields together.

The following derived-view slice persists one owner-scoped IANA planning time zone rather than recomputing intent from each browser's transient location. A new installation initializes the setting once from the browser's recognized IANA zone, then retains and synchronizes that value. Today withholds work whose start date is later than the owner-local planning date. Upcoming contains present open work with a future start date, sorts it by date and manual order, and offers one action that moves the work to Today while changing its start date to the current planning date. The client re-evaluates the owner-local date at least once per minute so an open view crosses midnight without requiring a reload. A later settings surface may let the owner deliberately change the canonical zone; travel alone does not rewrite it.

The Today execution slice assigns every newly created or newly moved Today task the owner's current planning date. A synchronized `today_section` value distinguishes the normal daytime section from This Evening without inventing a time, reminder, or separate destination. Open work whose assigned start date is earlier than the current planning date remains visible at the top of Today under Unfinished. Explicit rescheduling can retain it in Today, place it in This Evening, or move it to Tomorrow and therefore Upcoming. Moving work to Inbox clears its Today date and evening placement. Each visible Today section preserves its own fractional manual order; accessible move-up and move-down actions change only the selected task's order key inside that section.

The active/inactive planning slice expands persisted destination values to `anytime` and `someday`. Anytime is the active unscheduled pool, distinct from unprocessed Inbox work and daily commitments in Today. An Anytime item may retain a start date: a future date temporarily derives it into Upcoming, while the owner-local arrival of that date returns it to Anytime without another mutation. Someday is an explicitly inactive pool and cannot retain a start date or This Evening placement. Moving work to Anytime or Someday clears its Today section; moving it to Someday also clears its start date while retaining an independent deadline. Assigning a start date to Someday work activates it into Anytime before applying the date. Anytime and Someday each preserve their own fractional manual order.

The first hierarchy workflow exposes `/tasks/projects` and `/tasks/projects/:projectId`. Areas, projects, and headings support creation, renaming, movement, and independent fractional ordering. Project details support ordered to-dos under optional headings plus independently editable, completable, reopenable, and ordered checklist items. Planning views show the current area, project, and heading context, and the ordinary to-do editor can move work between no container, an area, or a project heading without changing its planning placement or planning order. Repository reads normalize SQLite boolean projections before checklist validation so an unrelated edit or reorder remains valid after persistence. A desktop and mobile browser exercise with disposable synthetic data proved heading and task creation, renaming, movement, ordering, checklist completion and reordering, planning-context presentation, editor-based container movement, reload persistence, and mobile project navigation.

## Goals / Non-Goals

**Goals:**

- Build a private-first task system that can become the user's primary daily planning tool after it has earned that role.
- Preserve the clarity of Things' core organizational and temporal concepts while establishing an original BathOS interaction and visual identity.
- Make task data available through the web, authenticated MCP, and macOS capture workflows from one authoritative domain model.
- Replace generic tags and title-prefix conventions with explicit structured semantics.
- Treat offline behavior, synchronization, ordering, recurrence, reminders, undo, recovery, history, backups, and automation safety as foundational trust work.
- Preserve a path to a native Apple companion and possible public distribution without requiring App Store publication now.
- Keep implementation incremental so each phase can be tested in real parallel use before the next phase expands the system.

**Non-Goals:**

- Migrating away from Things during the initial build.
- Bidirectional synchronization with Things.
- Reproducing Things' branding, assets, source code, or interface verbatim.
- Generic tags, free-form labels, or a generic custom-field system.
- Multi-user collaboration or household sharing in the initial product.
- Apple Watch support in the initial product.
- A complete Apple Shortcuts action library in the initial product.
- App Store publication as an initial delivery requirement.
- Capturing every future differentiator before foundation work begins.

## Decisions

### Use a private-first, single-owner module

The initial module will use the signed-in BathOS user as the ownership boundary. Task records will not inherit household-sharing behavior from other BathOS modules.

Rationale: The expected product is personal software, and collaboration would increase the authorization, conflict, notification, and product-design scope without serving the current workflow.

Alternative considered: Create a task household from the beginning. Rejected because speculative collaboration should not shape the core data model before a real use case exists.

### Use `tasks` as the permanent technical namespace

The module will use `/tasks/...`, `src/modules/tasks/`, and `tasks_` as its permanent route, source, and database namespaces. The user-facing product name remains open and may change without renaming internal engineering surfaces.

Rationale: A permanent neutral namespace keeps routes, migrations, synchronization rules, tests, and integrations stable while product naming remains a separate creative decision.

Alternative considered: Delay all artifacts until a product name exists. Rejected because the product name does not need to determine the internal namespace.

### Stage the production schema by trusted product slice

The first production migration adds only `tasks_todos`, the owner-scoped record needed by Capture and Run Today. It includes client-generated stable identifiers, Inbox/Today destination, manual order key, title, notes, immutable entry channel, typed source fields, lifecycle, recoverable-deletion disposition, optimistic revision, client mutation identifier, and synchronization timestamps. A following foundation migration adds accepted task-history events and the mutation metadata required to attribute and safely undo those task mutations.

Authenticated clients may select, insert, and update owned to-dos. They cannot hard-delete rows directly. Normal deletion is an update to recoverable disposition. Permanent deletion is available only through separate owner-authorized preview and execution functions after the root is in Trash. A database trigger keeps identity, owner, creation time, and entry channel immutable and requires every update to advance the revision by exactly one with a new mutation identifier.

Area, project, heading, checklist, template, recurrence, reminder, and delivery tables will be added in later dependency-ordered migrations when their product slices begin. Future hierarchy tables must use owner-inclusive foreign keys so a relationship cannot cross the ownership boundary even when RLS is bypassed by trusted service code.

Rationale: The first migration should be production-grade for the behavior it exposes without freezing speculative hierarchy storage before those slices are implemented.

### Normalize hierarchy and separate its order from planning order

Areas, projects, headings, and checklist items use dedicated owner-scoped tables. To-dos retain nullable area, project, and heading references. A loose to-do may belong directly to one area. A project to-do derives its area through the project and therefore cannot also store a direct area reference. A heading always belongs to exactly one project, and a to-do that references a heading must reference that same project.

Every hierarchy relationship uses an owner-inclusive foreign key. A relationship is therefore invalid when the child and parent owners differ, including when trusted service code bypasses RLS. Project-to-area, heading-to-project, checklist-to-to-do, and to-do-to-container relationships all use this boundary. Moving a project between areas changes only the project row because descendants derive that relationship. Moving a to-do between containers clears incompatible references before assigning the new parent.

Planning order and hierarchy order are independent. Existing to-do `order_key` values continue to represent order inside planning placements and Today sections. To-dos gain a separate `hierarchy_order_key` for their order among loose area work, ungrouped project work, or one project heading. Projects use their own hierarchy order within an area or the unassigned-project scope. Areas, headings, and checklist items each maintain order only among peers in their own scope. All ordered collections retain stable-ID tie-breaking.

Projects carry task-like lifecycle, recoverable disposition, planning placement, start date, deadline, and mutation metadata because projects can enter planning views and Logbook independently. Areas and headings are structural containers rather than completable work. Checklist items keep independent completion state, but completing or reopening a parent to-do never rewrites that state. Normal hierarchy removal is recoverable. Container transitions that affect descendants must use explicit domain operations rather than relying on foreign-key cascades or physical client deletion.

Rationale: Normalized ownership keeps container meaning explicit, derived area membership avoids descendant rewrite storms, and separate order keys prevent a daily execution decision from changing durable project structure.

Alternative considered: Store every hierarchy node in one generic tree table. Rejected because areas, projects, headings, to-dos, and checklist items have materially different lifecycle, planning, and mutation rules, and a generic node record would move those distinctions into fragile trigger logic.

### Do not implement tags

The domain model will not include a generic many-to-many label system. Current tag usage will be translated into explicit task state or workflow fields after the exact vocabulary is defined.

Rationale: Tags are not part of the user's normal planning method. The observed tags compensate for missing domain concepts and would preserve ambiguity if copied.

Alternative considered: Implement tags for parity and ignore them in the interface. Rejected because unused generic infrastructure adds schema, filtering, MCP, sync, and interaction complexity.

### Model personal semantics as first-class concepts

The design will reserve explicit concepts for actionability, source/origin, and templates. Emoji or text prefixes may be derived presentation, but they will not be the authoritative representation of meaning.

Rationale: Structured concepts can drive views, automation, MCP behavior, validation, and future specialized interactions without parsing titles or labels.

Alternative considered: Continue encoding meaning in titles and tags. Rejected because those conventions are fragile and cannot support dependable automation.

### Model actionability as `actionable` or `waiting`

Every to-do has one explicit actionability value. New to-dos default to `actionable`. `waiting` means that the to-do is valid open work but cannot be acted on immediately because some condition outside the to-do's current execution step must change first. The state does not attempt to encode the current emoji labels, and it does not add a generic reason, label, or metadata bag.

Actionability is orthogonal to lifecycle, recoverable disposition, planning placement, dates, hierarchy, and manual order. Changing actionability therefore changes only the actionability value, revision, mutation attribution, and append-only history. A waiting to-do remains wherever the user deliberately planned it, including Today, and stays visible there with an explicit waiting treatment. Search and list surfaces can include or exclude waiting work through the structured field. Terminal or deleted records retain their last actionability value for history, restore, and export, but actionability can be changed only while the to-do is open and present.

The initial interface labels the values `Actionable` and `Waiting`. It presents waiting state without decorative color and offers `All`, `Actionable`, and `Waiting` structured filters. A later contract may add a typed waiting reason or review condition only if parallel use demonstrates a concrete interaction that cannot be represented safely by the binary state.

The implemented slice persists this field in Supabase and the module-local PowerSync schema, records a dedicated `set_actionability` history transition, carries it through undo and portable export schema v7, and exposes guarded web and MCP mutations. Legacy export versions remain checksum-valid and restore missing actionability as `actionable`. The web presents waiting state in planning rows, task editors, project task controls, quick actions, and unified search without moving or reordering the task.

Rationale: The observed labels both compensate for one missing domain distinction. A binary state captures the user's stated intent while avoiding speculative subtypes, preserving deliberate planning placement, and giving web and automation clients a dependable filter.

Alternative considered: Preserve separate states for the two current emoji labels. Rejected because the labels do not represent distinct user intent and would encode the workaround rather than the workflow.

### Separate entry channel from source identity

Every created task will record an immutable entry channel that identifies how the mutation entered the task service. Supported channels are `web`, `raycast`, `mcp`, `mail_automation`, `browser_capture`, `native`, and `import`. A task may also have one typed primary source reference whose kind is `webpage`, `mail_message`, `file`, `selected_text`, `reading_item`, `template`, or `other`. Manual tasks have no source reference.

Entry channel and source kind answer different questions. An MCP client can create a webpage-sourced task, and a Raycast command can capture a Mail message. Neither field will be inferred from the other, the title, or an icon.

Source behavior is type-specific:

- Webpage and reading-item sources preserve a canonical URL and optional source title.
- Mail sources preserve a durable message identifier, account identifier, deep link, and integration lifecycle status. Moving or retiring source mail remains a Mail integration operation, not generic task behavior.
- File sources preserve a reopenable file reference supported by the originating client. They must not assume that a local path is portable to every device.
- Selected-text sources may preserve the captured excerpt and an optional parent source, subject to the same owner and export boundaries as task notes.
- Template sources are assigned only by the template-instantiation operation and preserve the definition and revision used.
- Import sources preserve an import-run identifier and external stable identifier for deduplication without treating imported owner identifiers as authoritative.

Automation channels must also provide a stable idempotency key when a retry could duplicate work. Operational diagnostics may record source kind, channel, and stable identifiers, but they must not log source titles, excerpts, URLs containing secrets, Mail content, file paths, or task content.

Rationale: A typed source contract can power deep links, source-specific lifecycle behavior, deduplication, and presentation without turning a generic metadata bag into a second tag system.

### Separate template definitions from active work

Reusable to-do and project templates will be modeled distinctly from the generated to-dos and projects that enter active planning views. Each saved template revision is immutable. Editing a template creates a new current revision, and instantiation deep-copies the selected revision into independent active work.

A to-do template may contain title, notes, checklist items, structured source defaults, actionability defaults, and relative planning values. A project template may additionally contain headings, ordered descendant to-dos, and their checklist items. Relative dates resolve from an explicit instantiation anchor. Absolute dates and reminders are excluded from reusable templates unless a later contract defines a safe reason to preserve them.

Every generated root and supported descendant retains the template definition identifier, template revision, instantiation identifier, and corresponding template-node identifier. Editing generated work never mutates the template. Editing or deleting a template never changes or deletes existing instances. Deleting a template archives the definition so existing provenance remains readable.

Instantiation is one transaction and accepts an idempotency key. A retry returns the original generated root and descendants. A partial hierarchy is never exposed as a successful instance.

The implemented authoring model captures one current open to-do or project hierarchy as an immutable template revision. Capture stores relative start-date and deadline offsets from an explicit reference date, preserves actionability, ordering, headings, and checklist content, and deliberately resets generated checklist completion. A template can be revised only through another explicit capture of the same kind. Authenticated clients can read synchronized definitions, revisions, and instantiation receipts, but they cannot write those tables directly. Capture, archive, and instantiation use guarded server functions so immutable history and generated provenance cannot be spoofed by a local queued write.

The web exposes Templates as its own route, including connected-only capture, revision, archival, explicit creation-date selection, and optional project-area placement. The local PowerSync projection keeps definitions and current revisions visible offline, while mutations remain unavailable until connected storage is configured. The authenticated MCP surface likewise provides `get_task_templates` and `instantiate_task_template` rather than generic template CRUD. Instantiation fixes MCP provenance to the automation actor and requires an explicit anchor plus a caller-owned idempotency UUID.

Portable export schema version 8 adds template definitions, immutable revisions, and instantiation receipts. Validation proves the definition-revision graph, generated-record provenance, counts, and checksums before restore. Merge restore rebinds every row to the authenticated owner, restores the template graph in the same transaction as generated active work, and reports template conflicts without partially applying the envelope. Older export versions remain accepted.

Rationale: The current library already uses template projects extensively. Treating templates as ordinary projects makes them appear in planning views and encourages accidental editing of reusable source material.

Alternative considered: Preserve template projects through naming conventions. Rejected because the module can support this workflow directly.

### Use orthogonal lifecycle and record-disposition state

Task lifecycle is `open`, `completed`, or `canceled`. Recoverable deletion is a separate record disposition, `present` or `deleted`, because an open task in Trash and a completed task in Trash must retain different restoration targets. Planning placement and structured actionability are also separate dimensions. Actionability uses `actionable` or `waiting`; it is mutable only on open, present work and is retained unchanged when work becomes terminal or recoverably deleted.

Lifecycle transitions follow these rules:

- New active work begins `open`.
- Completing open work sets `completed_at`, clears `canceled_at`, removes the record from active planning views, and appends a completion event.
- Canceling open work sets `canceled_at`, clears `completed_at`, removes the record from active planning views, and appends a cancellation event.
- Reopening completed or canceled work clears the current terminal timestamp and appends a reopen event. It never erases the prior terminal event from history.
- Repeating an already-applied transition with the same client mutation identifier returns the original result. A different request for the current target lifecycle produces a no-op receipt rather than a duplicate history event.
- Every transition checks the record revision. A stale transition cannot silently overwrite an accepted transition.
- Completing or canceling a project with open descendants requires an explicit descendant policy. The default operation rejects the transition rather than silently cascading. A separately named cascade operation may complete or cancel open descendants in one transaction and must report every affected stable identifier.
- Completing a parent to-do does not rewrite checklist-item completion values. Reopening the parent restores the checklist exactly as it was.

Recoverable deletion stores the prior lifecycle, planning placement, parent, and order needed for deterministic restoration. Deleting a hierarchy marks the supported descendants in the same transaction. Restoring the root restores its descendants to their prior states when their parents still exist. If a prior container no longer exists, the root returns to Inbox and the restoration receipt reports the fallback.

Hierarchy-wide lifecycle and recovery mutations use an owner-scoped operation receipt rather than a sequence of independently uploaded row changes. The web client applies the complete mutation to its local PowerSync projection in one SQLite transaction and queues one `tasks_hierarchy_operations` record containing the root, operation, explicit descendant policy, and the expected revision of every affected row. On upload, the connector submits that operation record and does not independently upload the optimistic descendant writes from the same transaction. Postgres accepts the operation record once, compares the complete expected-revision map with the authoritative candidate set, and applies all accepted row transitions in the operation's transaction. A stale, missing, or newly discovered descendant therefore produces a content-free conflict receipt rather than a partial cascade or an unexpected overwrite.

Every recoverably deleted hierarchy row carries a nullable `deletion_root_id`. Present rows require a null marker. A hierarchy deletion assigns the selected root identifier only to rows that are present when that operation is accepted. Restoring the root changes only deleted rows whose marker matches that root, so a descendant deleted independently before or after the cascade is never resurrected accidentally. A project whose former area is unavailable restores as an unassigned project. A to-do whose former area, project, or heading is unavailable returns to Inbox and reports the fallback. Structural descendants that cannot exist without a present parent, such as a heading or checklist item, require that parent to be restored first instead of being exposed in an invalid hierarchy.

Direct project lifecycle updates are allowed only when no present open descendant to-dos exist. Completing or canceling a project with open descendants requires the explicitly named cascade operation. Reopening a project changes the project only; it does not guess which historical descendant states should be reopened. Direct container deletion is rejected whenever supported present descendants exist, so client bugs or generic table mutations cannot bypass the hierarchy operation contract.

Rationale: Orthogonal dimensions prevent view placement, actionability, history, and recovery from becoming contradictory values in one overloaded state field.

### Treat dates as calendar values and reminders as resolved instants

Start dates and deadlines are ISO calendar dates without a time-zone offset. A start date controls when work becomes available in active views. A deadline communicates the completion boundary but never hides work before that date. A deadline earlier than the start date is invalid.

Today is derived from the owner's IANA planning time zone. Date-only values do not shift when the owner travels, changes the planning time zone, or crosses a daylight-saving boundary. `This Evening` is a section of Today, not a reminder time or independent date. An item may be placed there only while it belongs to Today.

Every explicit Today assignment stores the owner's current planning date as its start date. At the next owner-local midnight, unfinished work does not silently roll forward or disappear. It remains visible in an Unfinished section with explicit choices to reschedule it for Today, This Evening, or Tomorrow. Rescheduling to Today preserves daytime placement, rescheduling to This Evening records the evening section, and Tomorrow uses the next ISO calendar date and returns the section to daytime. Moving a task to Inbox clears its start date and evening section because Inbox is an unprocessed surface rather than a schedule.

Anytime and Someday are mutually exclusive persisted planning placements. Anytime contains present open work deliberately available outside the daily commitment list. A future start date temporarily withholds an Anytime item into Upcoming, and the item returns automatically when that owner-local date arrives. Someday is deliberately inactive, so it never retains a start date or an evening section; adding a start date activates the item into Anytime. Deadlines remain orthogonal and may be retained in either placement because they communicate a completion boundary rather than availability.

A reminder stores the intended local date and wall-clock time, the IANA time zone used to interpret that intent, and the resulting UTC instant. Once resolved, changing the owner's current time zone changes display conversion but does not move the reminder instant. Editing the reminder resolves a new instant from the newly supplied intent.

If a requested local reminder time does not exist because the clock moves forward, the system resolves it to the first valid instant after the gap and reports that adjustment. If the time occurs twice because the clock moves backward, the system chooses the earlier instant unless the caller explicitly selects the later occurrence. The resolved instant and resolution choice are stored so every client schedules the same event.

Rationale: Calendar planning should stay attached to the day the user chose, while a scheduled notification needs one unambiguous instant.

### Separate recurrence definitions from generated occurrences

A recurrence definition is not an active task. It owns a stable identifier, an immutable revision history, a rule mode, a planning time zone, a missed-occurrence policy, and a template snapshot for future occurrences. Generated work is an ordinary independent task with recurrence-definition, recurrence-revision, and logical-occurrence identifiers.

Calendar recurrence uses a schedule such as daily, weekly, monthly, or yearly. After-completion recurrence derives the next event only from an authoritative completion of the preceding occurrence. Cancellation does not advance an after-completion rule. Each logical recurrence event has a deterministic key derived from the definition and its scheduled local date or predecessor occurrence. A database uniqueness boundary guarantees that retries, delayed clients, and concurrent generators cannot create two occurrences for the same event.

The authoritative server performs generation transactionally. Clients may request an idempotent catch-up evaluation, but offline clients do not independently claim occurrence identity. Missed calendar schedules use one explicit definition policy:

- `skip` advances past missed events without creating work.
- `latest` creates only the most recent due event and is the default.
- `all` creates every missed event within the configured safety limit and requires explicit selection.

Editing a definition affects future, ungenerated occurrences only. Existing occurrences retain the revision and values from which they were created. Pausing or archiving a definition stops future generation without deleting existing work. Generation failure remains retryable and visible through content-free diagnostics.

Rationale: Stable logical occurrence identity and server-authoritative generation prevent duplicate or missing work across retries and disconnected clients.

### Make history append-only and recovery explicit

Every accepted domain mutation appends an owner-scoped history event and returns a mutation receipt. A receipt contains the client mutation identifier, actor type, mutation channel, affected stable identifiers, base and resulting revisions, transition type, timestamp, outcome, and conflict or fallback code. Operational logs and synchronization diagnostics use content-free receipt fields. Owner-scoped history may retain the minimum previous structured values required for audit and supported undo.

The first implementation creates history at the authoritative Postgres task-row boundary rather than trusting clients to submit event records. Authenticated clients have owner-scoped read access but no history write grant. The trigger derives ordinary transition kinds from the authoritative old and new row, stores the minimum complete task snapshot before and after the accepted mutation, and uses the same owner and client mutation identifier as the task write. Existing rows receive a baseline event so history begins honestly without inventing prior state. The synchronized local projection treats accepted history as read-only input.

Undo is an inverse domain mutation, not a database rollback. The local repository restores the selected event's prior structured snapshot, increments the current task revision, and identifies the source event on the queued mutation. The server accepts that mutation only when the source event belongs to the same owner and task, its result revision is still current, and its saved prior snapshot exactly matches the proposed new task state. Accepted undo appends its own event. A rejected undo leaves current data untouched and explains the conflict. Undo eligibility may expire from the immediate interface, but history retention and Trash restoration are independent of that window.

Normal deletion is always recoverable. Trash retains the deleted hierarchy and restoration metadata. Permanent deletion is a separately named, explicitly confirmed operation available only for records already in Trash. It is excluded from the initial MCP mutation surface. The operation must report all descendants and related owner data that will be erased and is not presented as undoable.

Permanent deletion is a connected, server-authoritative web operation for deleted to-do and project roots. The client first requests a content-bounded preview containing every hierarchy identifier in the deletion root, every related history, Mail-source, reminder, occurrence, and delivery identifier that will be erased, the content-free integrity receipts that will remain, and a digest of that exact scope. Execution requires a new request UUID, the unchanged digest, an explicit confirmation phrase, an active synchronization connection, and an empty local upload queue. The server locks and recomputes the scope in the execution transaction and rejects a stale preview before deleting anything. An exact execution retry returns the original content-free receipt.

Task and hierarchy history snapshots, Mail identity and lifecycle rows, reminders, reminder occurrences, and reminder deliveries are erased with the hierarchy. Content-free hierarchy-operation, template-instantiation, and recurrence-occurrence receipts remain so an old idempotency key or logical recurrence event cannot recreate permanently deleted work. The preview reports those preserved receipt identifiers rather than presenting permanent deletion as total account erasure. Structural area, heading, and standalone checklist roots remain restore-only until a later contract defines how permanent removal interacts with external recurrence and template references.

The first permanent-deletion slice landed on 2026 Jul 20. Its private receipt table and scope helper are inaccessible to authenticated clients, while the public preview and execution functions have explicit authenticated-only grants and empty search paths. The Trash interface exposes the action only in connected mode, disables it while synchronization is unavailable or local uploads are pending, shows the authoritative record and preservation counts, requires the exact phrase `PERMANENTLY DELETE`, and removes the accepted root optimistically while synchronization catches up. The operation is intentionally absent from MCP.

Portable export uses a versioned, documented JSON envelope with stable identifiers, task hierarchy, templates, recurrence definitions, source metadata, history, and recoverably deleted records. It excludes authentication credentials, notification tokens, and service diagnostics. The envelope includes a manifest, record counts, schema version, creation time, and checksums.

Restore validates checksums and schema compatibility before writing, supports a dry run, assigns all imported data to the authenticated owner, and never trusts exported owner identifiers. Merge restore is idempotent by stable identifier and reports conflicts without overwriting newer records. Replace restore is limited to the complete current schema. Preparation locks the task write scope long enough to validate the incoming envelope and return a checksum-verified current server export plus a digest that excludes only the export timestamp. The interface requires that backup to be downloaded and uses a separate exact confirmation. Execution takes the same write lock, rejects a changed server digest, and deletes and restores the owner task graph in one transaction. A failed restore rolls the deletion back. Browser delivery targets and Web Push credentials remain registered because they are deliberately excluded from portable task backups, while old task-specific delivery attempts and claims are removed. A private content-free receipt makes an exact retry after an ambiguous response idempotent.

The production-path preservation gate passed with at least one row in every schema-version-10 portable collection. It synchronized inverse undo, deleted and restored one task, retained another task in Trash, rejected a checksum-tampered envelope, deleted the complete synthetic source account, previewed and merged the backup under another owner, replayed every collection as an exact match, and recovered the task carried through backup Trash. The exercise corrected SQLite checklist boolean binding, task-keyed Mail source validation in current export wrappers, and false exact-replay conflicts introduced by delegating current rows through legacy schema classifiers.

The first portable format is `garden.bath.tasks.export` schema version 1. It contains the complete current `tasks_todos` and `tasks_history_events` collections, including structured sources and recoverably deleted rows, but no speculative empty collections for domain tables that do not exist yet. The server removes owner identifiers, orders each collection deterministically, and records its count and SHA-256 checksum in the manifest. Later domain tables require a new compatible schema version and corresponding validation before they enter export.

Schema version 2 adds `tasks_user_settings` when the canonical planning time zone becomes durable. The current client creates version 2 exports and accepts both version 1 and version 2 restores. Version 2 restore validates every collection before writing, delegates the unchanged task and history collections through the version 1 merge contract, rebinds the planning setting to the authenticated owner, and treats exact retries as matches without overwriting conflicts.

Authenticated server functions create the envelope, validate it, preview merge restore, execute merge restore, prepare current-schema replacement, and execute guarded replacement. Restore rebinds every inserted record to the authenticated owner, treats an exact stable-ID record as an idempotent match, and treats any differing or globally colliding stable ID or mutation ID as a conflict without overwriting it. A private transaction-scoped restore context allows the authoritative task-history trigger to distinguish exact historical restoration from an ordinary task mutation; clients cannot create that context or write accepted history directly. Replace restore is connected-only in the client and unavailable while local uploads are pending, ensuring its server backup represents the complete synchronized state.

Rationale: A personal task system must make ordinary mistakes recoverable and catastrophic operations conspicuous before it holds authoritative data.

### Keep the server authoritative for reminder delivery

The server owns the canonical reminder schedule and creates one stable delivery occurrence for each reminder event. Delivery is idempotent per occurrence and registered target. Web Push is the first external delivery channel when browser support and permission are available. An open web client also presents due in-app reminders. A later native client may add an Apple Push Notification service target without changing reminder identity or recurrence semantics.

Clients may cache near-term schedules to improve responsiveness, but a local schedule is not authoritative and must use the server-issued delivery occurrence identifier. Reconnection, reinstall, and multiple open tabs must not create a second logical occurrence. Multiple explicitly registered devices may each receive the same occurrence, while retries to one target use the same target-delivery identifier.

The service records scheduled, attempted, provider-accepted, failed, and acknowledged states separately. Provider acceptance is not reported as proof that the user saw the notification. Permission denial, missing platform support, expired targets, and persistent delivery failure are visible as degraded reminder capability without blocking task operation.

The completed reminder slice stores one active reminder per to-do or project, including its original local date, wall-clock time, IANA time zone, ambiguity choice, resolved UTC instant, and resolution kind. Each revision creates one immutable logical occurrence. Per-target delivery rows are unique by occurrence and registered target. The in-app client claims due delivery rows through a short server lease and an immutable request receipt, which prevents multiple tabs from creating another logical delivery while permitting recovery after an abandoned attempt. Portable export version 10 includes reminder intent and occurrence history but deliberately excludes delivery endpoints, subscription material, attempt diagnostics, and claim receipts.

Web Push registration is an explicit browser action. The client uses feature detection, requests notification permission only from that user gesture, registers one standards-based service-worker subscription, and reports unsupported, denied, unconfigured, expired, and failed capability states without blocking task work. Provider endpoint and encryption material live in a separate RLS-enabled table with no authenticated table-read grant and do not enter the synchronized target projection. The synchronized target retains only a hashed endpoint identity, a user-facing device label, preview choice, and capability status.

A service-role-only lease operation creates or reuses one delivery row for each due occurrence and active Web Push target. The scheduled Edge Function sends the encrypted notification in bounded batches, reuses the delivery identifier as the provider topic on retry, records provider acceptance separately from user acknowledgement, preserves content-free operational logs, degrades transient failures, and revokes expired endpoints on provider HTTP 404 or 410. Opening a notification deep-links to the relevant Tasks route and acknowledges the logical occurrence so a later in-app claim does not present it again. The public VAPID key is client-safe; the matching private key and Cron dispatch secret remain managed deployment secrets. A missing key, schedule, browser permission, or provider capability is visible as degraded or unconfigured operation rather than being mistaken for successful delivery.

The production reminder package keeps credentials out of the repository, requires the server and web build to share one verified public VAPID key, proves that the private key matches it, and requires an independent dispatch secret of at least 32 bytes. Cron resolves that secret from Supabase Vault at invocation time, so the decrypted value is absent from migrations and the stored job command. A fixed-name, once-per-minute job calls only the approved BathOS function endpoint. Database verification rejects absent or duplicate Vault values, inactive or duplicate jobs, schedule or endpoint drift, and any job command containing the decrypted secret. The dispatcher accepts current hosted and local Supabase server-key shapes, compares the custom dispatch secret without length-sensitive early exit, and returns an HTTP failure when a provider outcome cannot be recorded. Production provisioning and a real-device acceptance exercise remain approval-gated external actions.

Notification payloads contain only the minimum user-approved content required for the selected preview setting. Delivery diagnostics never contain task titles or notes.

Rationale: Server ownership supports delivery while the task app is closed and gives web and later native clients one deduplication contract.

### Decide the offline and synchronization model before broad UI implementation

The first architecture gate will select and test the local persistence, mutation queue, server reconciliation, conflict, and ordering strategy. A basic end-to-end task slice will prove the strategy before broad feature work.

Rationale: A task system that becomes unavailable, loses a completion, reorders unexpectedly, or duplicates a repeated task cannot earn daily trust. Retrofitting offline behavior after an online-only data layer is established would be expensive and risky.

Alternative considered: Build an online-only Supabase client first and add offline support later. Rejected as the default because it would defer the highest-risk architectural concern.

### Use PowerSync for the first production foundation

The task module will use PowerSync as its module-local persistence and synchronization foundation for the first production slice. The browser application will read and write a local SQLite projection, PowerSync will persist queued mutations, and a task-domain connector will upload those mutations through Supabase. Postgres, RLS, and stable server revisions remain authoritative.

The web client uses a module-owned database file with the cooperative OPFS VFS and PowerSync multi-tab coordination enabled at both the database and open-factory boundaries. The production schema mirrors `tasks_todos` and the read-only accepted `tasks_history_events` projection, then adds only content-free local synchronization issues and a local owner binding. Database construction remains lazy and browser-only so tests, server-side tooling, and unrelated BathOS routes do not open the task database.

The disposable local spike proved restart survival, exact-once logical outcomes, server-originated changes, conflicting edits, manual reorder convergence, recoverable deletion, multi-tab behavior, real Safari operation, and owner isolation. It used only local services, synthetic accounts, and synthetic data. No production database or paid service was connected.

Rationale: PowerSync covers the risky offline write loop while retaining Supabase as the authoritative database and RLS boundary for uploaded mutations. Two independent browser installations converged after offline writes and conflicts, and OPFS plus the multi-tab worker preserved state across reloads and tabs.

Fallback considered: RxDB with its direct Supabase replication plugin remains the first fallback if production integration exposes a failure that the disposable spike could not reveal. Electric was not selected because its current product handles read-path sync but leaves write-path synchronization to the application. A custom IndexedDB mutation queue remains an escape hatch, not the preferred foundation.

The production deployment topology remains open. PowerSync Cloud and self-hosting have different privacy, uptime, cost, and operational trade-offs. That choice must be made before a remotely available production task module is deployed, but it does not block the local domain foundation.

The 2026 Jul 20 deployment refresh recommends PowerSync Cloud Free for the bounded parallel-use trial. The expected one-owner workload fits its published capacity, Things remains the fallback during deactivation or another outage, and managed service avoids assuming an untested operations burden. This is a recommendation, not authorization. Production setup still requires confirmation that the BathOS Supabase plan permits external replication, approval to add PowerSync Cloud as a processor of personal task data, and synthetic production-path validation. An authoritative BathOS task system must later move to managed service without inactivity deactivation or a monitored and recoverable self-hosted topology.

The 2026 Jul 20 identity evaluation recommends `Aplomb` with a centered plumb-line direction that avoids another task-checkbox mark. The name comes from the owner's original description of the qualities this system should preserve, fits the concrete one-word BathOS naming grammar, and had no direct task-product collision in the bounded screen. `Forth` and `Espalier` remain distinct alternatives with documented trade-offs. This is a recommendation, not a product-name selection. Launcher and permanent PWA registration remain blocked until the owner chooses the name and icon direction, and any later public release requires a fresh formal availability review.

The production-readiness audit found that the browser schema had grown to 22 synchronized collections while the disposable stream and publication still contained 16. The missing server-generated recurrence and reminder receipts are now included, and every reminder projection table uses full replica identity. The secret-free deployment package derives its approval checks from the actual client schema and requires the production stream, disposable stream, fresh and existing publication scripts, role grants, and database preflight to contain one exact table set. A production-style local acceptance gate proved all six repaired collections on two owner replicas, zero leakage to another owner, persistent restart, conflict convergence, and complete synthetic account cleanup. This prepares deployment but does not authorize production provisioning.

Atomic hierarchy operations are the one intentional exception to ordinary per-row uploads. Their synchronized operation receipt is both the durable offline command and the server result. The containing local SQLite transaction may update multiple projected rows optimistically, but the connector recognizes the operation entry, uploads only that entry, and lets the authoritative operation transaction generate the server rows and append-only history. The subsequent synchronization download confirms or rolls back the optimistic projection as one logical mutation.

### Use whole-record optimistic revisions and server-authoritative conflicts

Every mutable task record will carry an integer revision. A client mutation increments the revision and may update the server only when the stored revision matches the mutation's base revision. If the predicate no longer matches, the client removes the stale mutation from its retry queue, records a content-free conflict receipt, and accepts the authoritative server row on download.

Every local update also assigns a new client mutation identifier. Insert and update retries query the authoritative row after an ambiguous uniqueness or revision result and treat an exact identifier-and-revision match as already applied. Transient network and service errors leave the transaction queued. Deterministic conflicts, constraint failures, invalid local operations, and attempted physical deletes produce content-free local issues and drain only the handled transaction so one bad mutation cannot block later work.

Rationale: The spike proved this rule for title-versus-title and completion-versus-title conflicts across independent local databases. It prevents silent last-writer-wins overwrites while guaranteeing that a stale mutation does not retry forever.

The production-path trust gate additionally proved this contract across every active client boundary. Two concurrent retries of one Raycast-channel capture resolved to one logical task. An MCP edit accepted from a shared base revision defeated the queued stale web edit on reconnection, while a current web edit defeated a later stale MCP request in the reverse order. Both paths preserved the first accepted revision, produced content-free conflict receipts, converged without duplicates, and retained immutable Raycast entry provenance. Future editing clients must join this matrix rather than introducing a separate conflict policy.

The sustained local endurance gate repeated that production-path sequence for ten minutes across two persistent local projections. It completed 300 synthetic capture, edit, conflict, and completion cycles, including 600 exact retries, 300 expected conflict losers, 900 accepted history events, and 12 secondary-client restarts. Both projections and Postgres ended with the same 300 completed revision-three tasks, empty upload queues, exact history and conflict-receipt counts, and no unexplained duplicate or divergence. This passes the automated sustained-use gate only. Production operations, real Safari and iPhone use, notification delivery, Inbox Manager dual-writing, and the owner's lived parallel-use confidence remain required evidence before any replacement decision.

Trade-off: The first foundation detects conflicts at task-record granularity rather than merging independent fields. This is intentionally conservative. A later field-aware merge policy may be specified only when a concrete workflow demonstrates that automatic merging is safer than an explicit conflict.

### Use fractional order keys with stable-ID tie-breaking

Ordered task views will sort by fractional order key and then stable task ID. Moving an item changes only that item's order key. Different tasks moved into the same gap may legitimately receive the same fractional key, and the stable ID produces the same total order on every client. Concurrent moves of the same task use the task revision conflict rule.

The first implementation uses the `fractional-indexing` key algorithm. Key generation validates its bounds, move-key calculation removes the moving record before selecting its new neighbors, and focused tests prove beginning, middle, end, move, invalid-range, and concurrent same-gap behavior.

Rationale: Two independent installations generated the same `a0V` key for different tasks and converged to an identical order without rewriting unrelated rows, losing an item, or creating a duplicate.

### Mirror owner authorization in RLS and Sync Streams

Postgres RLS remains authoritative for uploads and direct service access. The PowerSync owner stream is a second, security-critical rule that limits downloaded rows to `owner_id = auth.user_id()`. Every production schema change that affects ownership must update and test both boundaries together.

The client must also bind its local database to the authenticated owner. On account change, it must clear or rebind the local projection before rendering task data for the new owner rather than relying on eventual synchronization to remove cached rows.

The first implementation stores one local owner binding and calls PowerSync's full `disconnectAndClear()` operation on account change or sign-out. Local-only tables are cleared with the synchronized projection, and the new owner is recorded only after clearing completes. Task routes must await this boundary before exposing repository queries.

Rationale: The spike proved an empty owner-B download, isolation of a new owner-B task from owner A, zero cross-owner reads and updates under the authenticated database role, rejection of an owner-spoofed insert, and removal of owner-B rows when the same installation switched to owner A. The explicit client rule keeps that final boundary deterministic.

### Treat synchronization diagnostics as multidimensional state

The module will expose mutation queue depth, last successful synchronization, upload activity and failure, download activity and failure, and content-free conflict receipts. A single connected or offline badge is not sufficient because the synchronization stream and Supabase upload path can fail independently.

Rationale: During the forced outage, a client could retain a connected stream status while the write API reported an upload error and the durable queue remained nonzero. The actionable state was the combination, not the connection boolean.

### Keep Supabase as the authoritative service boundary

Supabase Auth and Postgres RLS will remain authoritative for remote data. Web, MCP, Raycast, and any native client will use the same ownership and mutation contracts.

Rationale: BathOS already has working authentication, deployment, database, and MCP patterns. A separate task backend would duplicate infrastructure and complicate identity.

Alternative considered: Build an independent local-only native database. Rejected because web and MCP access are core goals.

### Expose narrow task-domain MCP tools

MCP will expose task concepts and operations rather than a generic table mutation interface. Mutations will use stable identifiers, validate ownership and state transitions, prefer recoverable deletion, and support idempotent creation where repeated tool calls are plausible.

The first MCP slice is read-only and registers three closed-world tools on the existing BathOS OAuth server: `get_task_hierarchy`, `get_task_record`, and `get_task_view`. Every query uses the caller's bearer token through the existing RLS-scoped Supabase client and adds an explicit `owner_id` predicate as defense in depth. Returned task records retain stable relationship identifiers but omit the redundant owner identifier.

Hierarchy reads return the normalized current collections instead of inventing a generic tree record. They may be bounded as a whole or scoped to one area, project, heading, or to-do, and they report every truncated collection. Individual-record reads accept only the five current domain record types. Planning-view reads apply the same owner-local date, lifecycle, disposition, availability, and ordering rules as the web module; Today additionally reports its derived Unfinished, daytime, or evening section. An explicit planning date is permitted for deterministic review, while the default is derived from the owner's stored planning time zone. Trash returns only independent deletion roots. Projects and to-dos remain separately typed in planning responses.

This slice does not expose history as a generic record collection, create planning settings as a side effect of a read, or add any mutation capability. A caller without initialized planning settings must open the Tasks module once or supply an explicit planning date. Tool responses are bounded and identify truncation rather than silently presenting a partial result as complete. A later template slice adds one bounded owner-scoped template read and one explicit idempotent template-instantiation mutation while continuing to withhold generic template-table CRUD.

The first mutation slice adds only `create_task`. It creates one to-do rather than exposing generic area, project, heading, checklist, or table CRUD. The tool requires a caller-generated UUID idempotency key, never accepts an owner field, defaults entry and mutation channel to `mcp`, fixes the actor to `automation`, generates the stable task identifier server-side, and returns the accepted creation receipt plus the owner-safe current task. A later integration slice added a closed entry-channel enum for authenticated collection clients without exposing arbitrary metadata. Optional source input is typed; template provenance remains reserved for the future template-instantiation operation.

Idempotency resolves through the append-only `tasks_history_events` creation event, not only the mutable task row. This remains valid after later edits replace the task row's current client mutation identifier. An exact retry returns the same task and original creation receipt. Reusing the key with different normalized creation input is rejected. The initial lookup and the post-conflict lookup use the caller's RLS-scoped client plus explicit owner predicates, so a key collision outside the caller's scope is reported only as unavailable.

New Inbox, Anytime, and Someday work follows the existing placement rules. Today derives the current calendar date from the owner's stored planning time zone and refuses an explicit different date. The tool validates that selected areas, projects, and headings are present, owner-scoped, and structurally compatible before insert. Planning and hierarchy order keys append through the shared fractional-indexing algorithm; simultaneous insertions may share a gap key and remain deterministic through stable-ID tie-breaking. The authoritative insert trigger appends the creation history event in the same database transaction.

The next mutation slice adds four explicit to-do tools: `update_task` for title, notes, and typed source replacement; `move_task` for planning placement and complete container assignment; `schedule_task` for date-only start and deadline changes; and `transition_task` for completion, cancellation, reopening, recoverable deletion, and restoration. Each request requires the stable to-do identifier, its expected positive revision, and a caller-generated mutation UUID. The tools never accept an owner, raw order key, revision patch, lifecycle field, disposition field, or arbitrary metadata object. `create_task` additionally accepts a closed integration-channel enum so a client collecting input through Raycast, browser capture, Mail automation, or a native companion does not lose that structured provenance merely because it reaches the service through MCP. Ordinary MCP clients retain `mcp` as the default.

Ordinary edits, moves, schedules, and lifecycle transitions use an owner-filtered update that also predicates the current revision. Accepted retries resolve through the immutable `tasks_history_events` snapshot, compare the normalized request with the historical before and after states, return the original receipt plus the current task, and do not write again. New requests for an already-current state return a content-free no-op receipt without a revision change or history event. Stale requests return a conflict receipt and the current owner-safe task state rather than overwriting it.

Recoverable deletion and restoration do not bypass the hierarchy contract. `transition_task` submits one `tasks_hierarchy_operations` row whose identifier is the MCP mutation UUID, whose root is the selected to-do, and whose expected-revision map includes that to-do plus every affected checklist item. The database operation remains authoritative for atomic application and returns its accepted, no-op, rejected, or conflict receipt. Exact retries resolve the existing operation. Permanent deletion is not represented by the tool schema and remains unavailable.

All accepted MCP mutations fix the actor to `automation`. Update, movement, schedule, and lifecycle operations fix the mutation channel to `mcp`; creation records either the declared closed integration channel or the default `mcp` channel. Results include actor, channel, affected stable identifiers, base and resulting revisions, transition, occurrence time, outcome, applicable code, and the current owner-safe to-do. Creation results use the same complete receipt shape. Deterministic no-op, rejected, and stale outcomes are content-free and do not forge append-only history.

Rationale: AI access is a primary advantage of the module, but broad mutation primitives would increase the risk of duplication, data loss, and invalid states.

Alternative considered: Expose generic CRUD over all task tables. Rejected because database shape is not an appropriate automation contract.

### Prefer Raycast for the first macOS capture surface

The first global quick-entry workflow is one lightweight Raycast Script Command backed by the authenticated `create_task` service. Its Raycast argument interface collects a required title and optional notes, creates one Inbox to-do, and records `raycast` as the entry channel. Raycast owns the configurable global hotkey, so the command carries no hard-coded shortcut and does not require the BathOS browser tab to be open.

The command acts as a public OAuth client. On first use it discovers the BathOS OAuth server, dynamically registers one loopback redirect URI, performs Authorization Code with S256 PKCE in the user's browser, and stores only the client identifier and rotating refresh token in the macOS login Keychain under `garden.bath.tasks-raycast`. It refreshes before each capture, replaces the stored rotating token, keeps access tokens in process memory, and never stores a BathOS password, browser session, service-role credential, or client secret. Each capture generates a fresh creation UUID, sends one stateless Streamable HTTP `tools/call` request, and reports the server's accepted or already-applied receipt.

The initial command intentionally does not expose Today, project, deadline, tags, or context capture. Inbox-by-default keeps the global capture path fast and leaves planning to the module. Browser and other context-aware capture remain separate commands with verified source-specific contracts.

The first context-aware companion is a separate `Add Page to Tasks` Raycast Script Command. It reads only the active tab of the frontmost supported browser through a bounded JXA helper. The initial supported set is Safari, Safari Technology Preview, Google Chrome, and Google Chrome Canary because each exposes a verified active-tab title and URL contract. An unsupported frontmost app, missing browser window, invalid URL, non-HTTP(S) URL, blank tab, or browser-owned page fails without creating a task.

Accepted page capture cleans the browser title and falls back to the hostname when the title is empty or generic. It creates an Inbox to-do through the same OAuth and MCP client, records `browser_capture` as the immutable entry channel, and stores a typed `webpage` source containing the exact accepted URL and optional source title. The URL is also retained in notes until the task interface exposes a first-class source-opening control. The title does not carry a glasses emoji or textual source prefix because structured provenance is authoritative. Pending capture state retains the complete logical request and creation UUID in Keychain so an ambiguous response can be replayed without losing source fields or creating a duplicate.

Three additional Raycast commands cover verified source contracts. Finder capture accepts exactly one selected file or folder, uses its name for the task, and records a typed `file` source with the local `file://` reference in both structured provenance and provisional notes. That reference is explicitly originating-Mac context and is not presumed portable. Selected-text capture writes a unique marker to the clipboard, actively sends Cmd-C to the front app, polls for a fresh nonempty value, and restores the previous plain-text clipboard value on failure. It uses the first nonempty line for the title, retains the bounded excerpt in notes, and records a typed `selected_text` source. It never falls back to pre-existing clipboard content.

The AI-enriched reading command reuses Inbox Manager's verified `prepare-webpage-task.mjs` contract, including web-assisted title refinement and its deterministic browser-title or hostname fallback. It strips the legacy glasses prefix because typed provenance is authoritative, stores `reading_item` and the exact URL structurally, retains the URL in provisional notes, and creates an unassigned daytime Today task with `browser_capture` entry provenance. This remains distinct from generic page capture, which is deterministic, local, and Inbox-first. The Things reading command remains intact for indefinite parallel use.

All Raycast capture commands share the same OAuth client and Keychain-backed pending-capture journal. A retry replays the entire original logical payload, including destination, entry channel, typed source fields, and creation UUID. If a different capture follows an unresolved request, the command recovers the older request before sending the new one.

Mail is deliberately not activated in this slice. The observed Inbox Manager contract needs a durable message identifier, Mail account and mailbox identity, deep link, retirement destination, and integration-specific source-retirement state. Rather than widen every task with Mail-only nullable fields or hide the missing semantics in opaque strings, the domain adds one owner-scoped `tasks_mail_sources` record for each Mail-sourced task. The record has a composite owner-safe task relationship, per-owner account-and-message uniqueness, explicit `retained`, `retirement_pending`, `retirement_failed`, and `retired` states, revision and mutation guards, bounded diagnostics, RLS, and deferred pair constraints. A Mail task and source must be created atomically, and their message identifier and deep link must match.

Portable export version 5 adds `tasks_mail_sources` to the complete task envelope. Validation checks both directions of the task-source relationship and rejects mismatched identity or deep-link data. Restore first reconstructs the version 4 task domain inside the same transaction, then restores source records before deferred pair constraints run. Dry-run and merge reports include Mail-source inserts, exact matches, and conflicts.

Portable export version 6 adds the append-only `tasks_mail_source_events` collection. Validation requires every event field, verifies checksums and unique event and mutation identities, proves each task's lifecycle and revision chain from the initial retained source state, and requires the latest event to match the exported current source record exactly. Export strips owner identifiers. Restore validates and classifies the complete source and event graph before writing, restores source state before immutable events, rebinds both to the authenticated owner, and treats exact retries as matches without replaying lifecycle transitions.

The specialized `create_mail_task` MCP operation derives the owner's planning date, validates optional work-area access, allocates planning and hierarchy order, and calls one database function that creates the Today task and retained source together. The database serializes capture by owner, account, and message identity. Exact request-UUID retries return the same task, while a later request UUID for the same source identity also returns the existing pair. Reusing a request UUID with changed normalized content or presenting conflicting metadata for an existing source is rejected. A source-row failure rolls back the task insert. This tool is intentionally narrower than generic `create_task` and accepts no owner, project, heading, lifecycle, order, or arbitrary metadata input.

Retirement uses a separate two-step contract around the external Mail move. `begin_mail_retirement` changes only a retained or explicitly failed source to `retirement_pending`; `resolve_mail_retirement` then records either verified `retired` success or `retirement_failed` with a bounded diagnostic. Both require the current source revision and a request UUID, accepted mutations append an immutable owner-scoped lifecycle event, exact retries return the original receipt, and a retired source is terminal. Authenticated callers cannot update source state or insert audit events directly. This ordering prevents task creation from being treated as evidence that Mail actually moved the source message.

Mail capture persistence, guarded lifecycle services, and portable audit recovery are ready, but Inbox Manager dual writing remains gated on explicit parallel-use approval. Existing Mail rules and Things delivery remain unchanged.

Rationale: Raycast already provides global hotkeys, forms, command lifecycle, and a familiar user workflow. It avoids building and signing a custom overlay before one is necessary.

Alternative considered: Build a native macOS overlay immediately. Deferred because Raycast can validate capture behavior with less custom platform code.

### Treat native Apple surfaces as an optional expansion layer

A later native Apple companion may provide notifications, WidgetKit widgets, controls, App Intents, and TestFlight installation. Apple Watch and a broad Shortcuts library remain optional even if a native iPhone app exists.

Rationale: Native extensions can add meaningful system integration, but they should not delay proving the task model and web workflow. The user is willing to enroll in the Apple Developer Program if TestFlight or restricted capabilities make membership useful.

Alternative considered: Make a complete native client a V1 requirement. Rejected because the web module and Raycast can validate the product first.

### Keep Things parallel and independent

Things will remain unchanged and authoritative for the user's established workflow during development. Read-only inventory may inform requirements, but the BathOS module will not write to Things or require an importer in its first phases.

Rationale: There is no migration deadline. Parallel use reduces pressure, protects the existing productivity system, and allows the replacement threshold to be based on sustained evidence.

Alternative considered: Build migration or dual-write tooling first. Rejected because it adds risk before the new system is ready to hold authoritative data.

## Ordered Roadmap

### Phase 0: Discovery and architecture gates

1. Maintain a bounded, read-only Things behavior and data inventory without committing private content.
2. Define the exact structured vocabulary for actionability, source/origin, templates, and other known title/tag conventions.
3. Catalogue the user's daily capture, planning, execution, review, and completion workflows.
4. Specify the core task state machine, date semantics, recurrence semantics, ordering rules, undo model, and recoverable deletion behavior.
5. Compare offline and synchronization approaches with a small executable spike before selecting the foundation.
6. Define privacy, RLS, MCP safety, backup, and restore contracts.

### Phase 1: Trustworthy domain foundation

1. Add the isolated module, owner-scoped database model, and a minimal task lifecycle.
2. Prove local persistence, offline mutations, server reconciliation, and conflict behavior in one end-to-end slice.
3. Prove stable manual ordering and deterministic restoration after asynchronous saves.
4. Add recoverable deletion, history primitives, and basic backup/export before the data becomes valuable.

### Phase 2: Daily planning workflow

1. Add Inbox, Today, This Evening, Upcoming, Anytime, Someday, and Logbook behavior.
2. Add areas, projects, headings, checklists, notes, start dates, deadlines, reminders, and recurrence.
3. Add native template definitions and instantiation.
4. Add structured actionability and source/origin behavior.
5. Add search, keyboard navigation, bulk selection, and high-frequency editing workflows.

### Phase 3: Capture and AI integration

1. Add authenticated, narrow MCP read tools.
2. Add idempotent and recoverable MCP mutations with explicit destructive boundaries.
3. Add Raycast quick entry with global keyboard activation.
4. Add context-aware browser, Mail, Finder, reading-list, and automation capture where each source provides a dependable contract.
5. Connect existing Inbox Manager workflows only after the new Inbox is safe for parallel use.

### Phase 4: Optional native Apple companion

1. Determine whether a native shell, native client, or hybrid presentation best complements the web module.
2. Add native notifications and deep links if web notifications are insufficient.
3. Add selected Home Screen and Lock Screen widgets or Control Center controls when they serve observed workflows.
4. Use Xcode device installation initially and TestFlight if ongoing installation or system capabilities justify Apple Developer Program enrollment.
5. Add App Intents, Shortcuts actions, or Apple Watch support only when a specific workflow demonstrates value.

### Phase 5: Replacement-readiness evaluation

1. Use the BathOS module in parallel for a sustained period.
2. Validate offline reliability, recurrence, reminders, ordering, recovery, backup, automation, and cross-client consistency against explicit acceptance thresholds.
3. Build migration tooling only if the user decides the module is ready to become authoritative.
4. Retain a rollback path and avoid deleting or mutating the Things library during transition.

## Trust Register

The following concerns are roadmap requirements and must not be dismissed as polish:

- Offline creation, editing, completion, and reordering
- Conflict resolution across web, Mac, iPhone, MCP, and automation clients
- Stable manual ordering across derived views
- Repeating templates and generated occurrences
- Date-only scheduling, reminder timestamps, time zones, and daylight-saving changes
- Undo, trash, recovery, backups, export, and audit history
- Optimistic display without stale-value snapback
- Notification delivery, retry behavior, and duplicate suppression
- Idempotent MCP mutations and protection against unintended destructive actions
- Source/origin preservation for webpages, Mail messages, files, and automated captures
- Full keyboard access, predictable focus, and accessible interaction
- Performance that remains dependable as active and historical data grows

## Risks / Trade-offs

- [The umbrella change becomes too broad to implement safely] -> Keep this artifact as the product contract, then refine each roadmap phase into small, dependency-ordered tasks before implementation.
- [The first structured semantics encode current workarounds too literally] -> Define user intent and desired interactions before naming fields or enums.
- [Offline architecture conflicts with direct Supabase patterns elsewhere in BathOS] -> Keep synchronization module-local unless a proven shared abstraction benefits multiple modules.
- [Manual ordering conflicts across clients] -> Choose an explicit ordering and conflict strategy in Phase 0 and test concurrent reorder scenarios.
- [Recurrence produces duplicate or missing work] -> Separate recurrence definitions from occurrences and make generation idempotent.
- [AI actions damage or duplicate data] -> Use narrow tools, stable IDs, recoverable deletion, idempotency keys, mutation receipts, and audit history.
- [A native companion creates a second inconsistent product] -> Keep one task-domain contract and limit native code to justified system surfaces until a native client proves necessary.
- [Private information leaks through the public repository] -> Use synthetic fixtures and generalized discovery findings only.
- [Inspiration becomes imitation] -> Preserve functional principles while using original visual language, copy, assets, and interaction details.
- [Apple distribution becomes unexpectedly burdensome] -> Start with local Xcode installation, keep public-framework compatibility, and enroll in the developer program only when TestFlight or system capabilities require it.

## Migration Plan

- No initial Things migration will occur.
- Development and deployment will add owner-scoped `tasks_` objects without modifying other module data.
- Early schema changes may be reset locally while the module contains only test data.
- Once the module contains real data, every destructive schema change must include an explicit preservation, backup, and rollback plan.
- Things inventory and future import tools must remain read-only unless the user separately authorizes a mutation.
- Production rollout will initially hide or clearly label the module as experimental until the user chooses to rely on it.

## Open Questions

- Should the bounded parallel-use trial adopt the recommended PowerSync Cloud Free topology, subject to Supabase plan and privacy approval?
- What user-facing name and iconography should distinguish the module from Things?
- Which native Apple surface, if any, is valuable enough to justify the first companion build?
