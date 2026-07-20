## Context

The user has relied on Things as a central planning system for many years and intends to continue using it while BathOS develops a replacement. The goal is not rapid migration. The goal is to earn trust through an extended period of parallel use.

The current Things library is modest. A bounded read-only AppleScript inventory on 2026 Jul 19 found hundreds, not tens of thousands, of active and historical records, a small area/project hierarchy, two template projects, and two narrowly used labels. Scale should be handled responsibly, but migration volume is not a primary architectural risk.

The unusual parts of the current workflow are semantic. Template projects are used to generate reusable work. A small number of tags mark to-dos that cannot be acted on immediately. Some title prefixes encode source or meaning. The BathOS module should represent these concepts directly rather than carry forward tag and title conventions as canonical data.

BathOS already provides React, TypeScript, Supabase Auth, RLS, and an OAuth-authenticated MCP server. Its current installable-web-app support does not provide offline data operation or native Apple extensions. A native Apple companion may eventually be needed for notifications, widgets, controls, and other system surfaces, but it is not an initial requirement.

The repository is public. Product documentation, migrations, tests, fixtures, and logs must not contain personal Things titles, notes, area names, project names, or other private content. Discovery findings committed to the repository must be generalized or aggregated.

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

### Use `tasks` as a working technical namespace

The initial OpenSpec artifacts use `/tasks/...`, `src/modules/tasks/`, and `tasks_` as working route, source, and database namespaces. The user-facing product name remains open and may be selected before implementation.

Rationale: Engineering artifacts need a stable reference while product naming remains a separate creative decision.

Alternative considered: Delay all artifacts until a product name exists. Rejected because the product name does not need to determine the internal namespace.

### Do not implement tags

The domain model will not include a generic many-to-many label system. Current tag usage will be translated into explicit task state or workflow fields after the exact vocabulary is defined.

Rationale: Tags are not part of the user's normal planning method. The observed tags compensate for missing domain concepts and would preserve ambiguity if copied.

Alternative considered: Implement tags for parity and ignore them in the interface. Rejected because unused generic infrastructure adds schema, filtering, MCP, sync, and interaction complexity.

### Model personal semantics as first-class concepts

The design will reserve explicit concepts for actionability, source/origin, and templates. Emoji or text prefixes may be derived presentation, but they will not be the authoritative representation of meaning.

Rationale: Structured concepts can drive views, automation, MCP behavior, validation, and future specialized interactions without parsing titles or labels.

Alternative considered: Continue encoding meaning in titles and tags. Rejected because those conventions are fragile and cannot support dependable automation.

### Separate template definitions from active work

Reusable to-do and project templates will be modeled distinctly from the generated to-dos and projects that enter active planning views. Instantiation must create independent work records with traceable template origin.

Rationale: The current library already uses template projects extensively. Treating templates as ordinary projects makes them appear in planning views and encourages accidental editing of reusable source material.

Alternative considered: Preserve template projects through naming conventions. Rejected because the module can support this workflow directly.

### Decide the offline and synchronization model before broad UI implementation

The first architecture gate will select and test the local persistence, mutation queue, server reconciliation, conflict, and ordering strategy. A basic end-to-end task slice will prove the strategy before broad feature work.

Rationale: A task system that becomes unavailable, loses a completion, reorders unexpectedly, or duplicates a repeated task cannot earn daily trust. Retrofitting offline behavior after an online-only data layer is established would be expensive and risky.

Alternative considered: Build an online-only Supabase client first and add offline support later. Rejected as the default because it would defer the highest-risk architectural concern.

### Keep Supabase as the authoritative service boundary

Supabase Auth and Postgres RLS will remain authoritative for remote data. Web, MCP, Raycast, and any native client will use the same ownership and mutation contracts.

Rationale: BathOS already has working authentication, deployment, database, and MCP patterns. A separate task backend would duplicate infrastructure and complicate identity.

Alternative considered: Build an independent local-only native database. Rejected because web and MCP access are core goals.

### Expose narrow task-domain MCP tools

MCP will expose task concepts and operations rather than a generic table mutation interface. Mutations will use stable identifiers, validate ownership and state transitions, prefer recoverable deletion, and support idempotent creation where repeated tool calls are plausible.

Rationale: AI access is a primary advantage of the module, but broad mutation primitives would increase the risk of duplication, data loss, and invalid states.

Alternative considered: Expose generic CRUD over all task tables. Rejected because database shape is not an appropriate automation contract.

### Prefer Raycast for the first macOS capture surface

The first global quick-entry workflow should be a Raycast form or command backed by the task service. Context capture will expand only after the supported browser, Mail, Finder, and selected-text behaviors are understood.

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

- What exact actionability states should replace the current tag conventions?
- Which source/origin types need first-class behavior, and which are informational only?
- How should template updates affect instances that were already created?
- What is the smallest daily workflow that would make parallel use genuinely useful?
- Which offline and synchronization approach best fits web, Supabase, MCP, and a possible native client?
- Should reminders be scheduled by the server, a native client, Web Push, or a layered combination?
- What user-facing name and iconography should distinguish the module from Things?
- Which native Apple surface, if any, is valuable enough to justify the first companion build?
