# Tasks Guide

BathOS Tasks is ready for deliberate personal parallel use at [os.bath.garden/tasks/today](https://os.bath.garden/tasks/today). Things remains authoritative while Tasks earns trust. Tasks does not import, modify, or replace the Things library. Inbox Manager creates new Mail tasks in both Things and BathOS Tasks without backfilling or synchronizing later edits.

## Start Here

1. Sign in to BathOS and open Tasks.
2. Open `More > Config`, then check Synchronization. `Synced` means this installation has completed a full synchronization, local changes have uploaded, current server changes have downloaded, and no transfer is active or failing.
3. In Browser Reminders under Config, choose `Enable` and allow notifications when Safari asks. Each browser or device must be enabled separately.
4. Optionally install Tasks from Safari. Use `File > Add to Dock` on macOS or `Share > Add to Home Screen` on iPhone and iPad.
5. Capture a few disposable or low-risk tasks before relying on the module for important work.

## Daily Workflow

| View | Purpose |
| --- | --- |
| Today | Eligible Anytime work grouped into Inbox, Now, Next, and Later |
| Upcoming | Work controlled by a future Start or, when no future start exists, a future Deadline |
| Anytime | All active work available now, including every Today task |
| Someday | Inactive work kept for possible future attention, grouped by Area |
| Done | Completed, canceled, and recoverably deleted tasks retained for 30 full owner-local days |
| Templates | Reusable task and checklist structures |

Today, Upcoming, Anytime, and Someday remain directly available in the primary navigation. Open More for Templates, Done, and Config. Config contains the Areas section for adding, renaming, reordering, and recoverably deleting Areas. Moving an Area higher or lower there controls the order of its buckets in Anytime and Someday.

Use the magnifying-glass action in the page header to open Quick Find for tasks and areas. You can also begin typing any printable character from the background or a focused task on any Tasks page, including Config, to open Quick Find with that character already entered. Shifted letters and punctuation are preserved. Typing inside a field, menu, popover, or dialog remains with that control and does not invoke search. Quick Find shows up to three best matches. Choose Continue Search to open the complete live task-results page for the current query.

Press `Control+A` on Mac or `Alt+Shift+A` on Windows from Today, Upcoming, Anytime, or Someday to insert a blank complete task editor at the top of the view. Today drafts begin in Today Now. Anytime and Upcoming drafts begin as unplanned Anytime work, so an Upcoming draft leaves that view after it is saved unless a future Start or Deadline makes it visible there. Someday drafts remain inactive and undated. Raycast and Mail capture use their own explicit placement rules.

Use Start only to defer work to a future owner-local date. Today and earlier dates are rejected. A future Start has no Today horizon. Inbox, Now, Next, and Later apply only to work in Today, and selecting one clears any future Start. When a task's Start arrives, local and server activation clear it and place the task in Today Inbox for deliberate re-planning. A future Start controls Upcoming placement even when it is later than the Deadline. If no future Start exists, a future Deadline controls Upcoming placement instead. Upcoming groups tomorrow through the next seven days individually, later work through the next 12 months by month, and more distant work by year. Active undated work remains in Anytime and appears in Today whenever it has a horizon.

Use Deadline for the last acceptable date. A Deadline may be earlier than Start when work has been deliberately rescheduled past that boundary. Reminder Time appears only for deferred work and always resolves on the current Start. Changing a future Start rebinds the reminder, and manually clearing it cancels the reminder. Automatic activation preserves that day's already-resolved occurrence so a later reminder still delivers. Mark work as `Waiting` when another party or event is expected to unblock it, or `Rechecking` when no signal is expected and you must test availability again. Every change in an expanded task saves automatically. Title and notes typing is briefly debounced, while selects, dates, organization, and reminders persist immediately. Closing an editor flushes its final valid draft. There are no Save or Cancel actions and no routine saving indicator. Open editors expand inline with a quick transition and close when you click outside the task. Calendars, menus, and dialogs opened from that task remain part of the editing session.

Structured webpage, file, reading-item, and Mail sources remain distinct from the task title and notes. Primary Link is the editable shortcut shown on the task row: `message://` values use the Mail icon, HTTP(S) values use the Link icon, and other nonblank values open as HTTPS destinations. Mail capture initializes Primary Link from its audited message deep link without replacing source provenance. Expanded notes are always directly editable and style supported Markdown as you type without hiding its source. The supported subset is headings, asterisk emphasis, double-asterisk strong text, asterisk bullets, Markdown links, and inline code. Heading, emphasis, strong, bullet, and link indicators use a fixed-width font. Inline code uses a fixed-width font and a light background across the complete delimited string. Safe HTTP(S), `message://`, and other application links remain actionable. Press Enter in an asterisk bullet to begin the next bullet.

## Keyboard Commands

Press `⌘/` on Mac or `⌃/` on Windows to open the current keyboard and pointer reference. The panel always shows Mac and Windows commands and identifies the current platform. Config also displays the shortcut as a quiet reminder. Tasks reserves the documented task commands while the module is mounted, including when a text field is active. Standard Command shortcuts on Mac and Control shortcuts on Windows retain their expected browser and operating-system intent except where Tasks supplies the matching task-level behavior described below. There is currently no keyboard shortcut for Find.

| Action | Mac | Windows |
| --- | --- | --- |
| Undo the Latest Safe Task Change | `⌘Z` / `⌃Z` | `⌃Z` / `⌥⇧Z` |
| Redo the Latest Undone Task Change | `⌘Y` / `⌘⇧Z` | `⌃Y` / `⌃⇧Z` |
| Select All Visible Tasks | `⌘A` | `⌃A` |
| Duplicate the Focused, Open, or Selected Tasks | `⌘D` | `⌃D` |
| Cut Focused or Selected Tasks | `⌘X` | `⌃X` |
| Copy Focused or Selected Tasks | `⌘C` | `⌃C` |
| Paste Tasks or Text | `⌘V` | `⌃V` |
| Close an Open Task | `⌘Return` / `⌘Escape` | `⌃Return` |
| Show Keyboard Commands | `⌘/` | `⌃/` |

Cut, Copy, Paste, and Select All remain native when an editable text control owns the command. Outside text editing, task Cut and Copy target either the single focused task or every task in multiple selection. Paste reconstructs a structured BathOS Tasks payload when available. Other nonblank clipboard text becomes one new task whose Summary contains the clipboard text. Today paste produces Today Inbox work. Anytime paste produces unplanned Anytime work. Someday paste produces undated Someday work. Area detail views apply their visible organization. Upcoming, Done, Config, Templates, and Search reject task paste.

| View navigation | Mac | Windows |
| --- | --- | --- |
| Open Today | `⌘1` | `⌃1` |
| Open Upcoming | `⌘2` | `⌃2` |
| Open Anytime | `⌘3` | `⌃3` |
| Open Someday | `⌘4` | `⌃4` |
| Open Done | `⌘5` | `⌃5` |
| Open Config | `⌘6` | `⌃6` |

| Task-specific action | Mac | Windows |
| --- | --- | --- |
| Open/Close Task | `⌃Q` | `⌥⇧Q` |
| Open the Previous Task | `⌃W` | `⌥⇧W` |
| Choose Start | `⌃E` | `⌥⇧E` |
| Cycle Day Horizon | `⌃R` | `⌥⇧R` |
| Clear Start | `⌃T` | `⌥⇧T` |
| New Task | `⌃A` | `⌥⇧A` |
| Open the Next Task | `⌃S` | `⌥⇧S` |
| Choose Deadline | `⌃D` | `⌥⇧D` |
| Cycle Actionability | `⌃F` | `⌥⇧F` |
| Set Start to Someday | `⌃G` | `⌥⇧G` |
| Toggle Done | `⌃X` | `⌥⇧X` |
| Edit Checklist | `⌃C` | `⌥⇧C` |
| Choose Area | `⌃V` | `⌥⇧V` |
| Edit Reminder Time | `⌃B` | `⌥⇧B` |

Tab and Shift+Tab follow the native page order through each closed task row and its available completion, title, source-link, and actions controls, then continue beyond the task list. Starting granular Tab traversal clears any whole-task focus without interrupting the browser's focus movement. When no task is focused, open, or multiply selected and no nested surface owns the keyboard, press Space from the Tasks page background to focus the first visible task without opening it. Space on a task row reached by Tab promotes that same row into whole-task focus without advancing. After whole-task focus is established, Space advances, Shift+Space reverses, and Up or Down moves through visible tasks. These whole-task movements wrap at both ends and scroll the destination into view. Held Space does not repeat movement. Space retains its native behavior on task controls, links, editors, dialogs, menus, popovers, and unrelated page controls. Escape relinquishes focus from a collapsed task row or one of its granular controls when no nested surface owns Escape. Return opens a whole-task-focused closed task. Open/Close Task opens a focused closed task or closes an open task and returns focus to its row. When completion, lifecycle, menu, or task-owned dialog actions return to the collapsed list, focus lands on the complete task row or its same-position fallback rather than a nested row control.

Open Next and Open Previous do not wrap at the list boundaries. With no focused or open task, Open Next starts at the top and Open Previous starts at the bottom. With a closed task focused, either command opens the adjacent task. With a task open, either command closes it before opening the adjacent task. Reaching a boundary closes an open task and retains focus on that row. Opening a task puts the insertion point at the end of its Title and scrolls only as much as needed to reveal it. Marking an open task complete keeps it open so its metadata can still be edited. Tasks moves it to Done only when the editor closes. Clicking the checkbox of a closed task completes it immediately.

Clear Start moves targeted work to unplanned Anytime and cancels its Start-dependent reminder. Set Start to Someday moves targeted work to Someday and cancels its Start-dependent reminder. Both preserve Deadline, actionability, and organization. Cycle Day Horizon moves non-Today work to Today before cycling its Today horizon.

Tasks retains up to 100 safe forward changes for keyboard undo and redo. Every editable task mutation participates in this history, including completion, cancellation, deletion, reopening, and restoration. Tasks reserves a mutation before asynchronous persistence or a departing-row animation begins. If Undo arrives immediately, Tasks waits for that exact mutation and its synchronized task and history projections instead of traversing an older event. Each accepted autosave batch is an ordinary forward change, and a new forward change clears the redo path. The client rebuilds that cursor when synchronized history changes and temporarily withholds undo or redo until the current task and cursor-tip snapshots agree. It never skips an unsafe latest event to reach older history. The server independently rejects any stale inverse, preventing older work from overwriting intervening changes.

The first Command-click on Mac, Control-click on Windows, or Shift-click immediately enters selection mode, selects the closed task, establishes the range anchor, and reveals the selection toolbar. A later modified click or Shift-click updates that explicit selection. If one task already has lightweight keyboard focus, a modified click begins selection with the focused task included and anchored. Once selection is active, an ordinary click also toggles a task. Reducing the set to one task retains selection mode and the toolbar. Reducing it to zero clears selection. Clicking outside every task or switching views clears task focus and selection. Modified clicks on task links retain native link behavior, and direct clicks on completion or action controls perform only their own actions. Done rows support selection for Copy and Duplicate. Cut is unavailable there because Done represents retained terminal task states rather than active work.

Drag a Today task before or after a task in another visible Today section to change its day horizon and order together. Empty Today sections remain hidden and do not act as drop zones. Anytime and Someday show unassigned tasks first without a heading, then group Area work in the manual Area order maintained in Config. Dragging inside one Area region changes order. Dragging across Area regions assigns the destination Area, or removes organization when dropped into the unassigned region. Keyboard task reordering is not currently supported.

## Capture from Raycast

The sibling Raycast project provides these authenticated commands:

- `Add Task`: Add a title and optional notes to today's Next horizon
- `Add Page to Tasks`: Capture the active Safari or Chrome page to today's Next horizon with webpage provenance
- `Add Finder Item to Tasks`: Capture exactly one selected file or folder to today's Next horizon with a local file reference
- `Add to Tasks Reading List`: Create an AI-titled reading item in today's Next horizon

The first use of any command opens BathOS authorization in the browser. Later uses refresh the delegated token automatically. Raycast keeps its rotating token and any ambiguous pending capture in the macOS login Keychain under `garden.bath.tasks-raycast`.

## Synchronization and Offline Work

Tasks writes through a local database first. Existing task data remains available during a temporary network interruption, and accepted local changes wait in the upload queue. Synchronization under Config distinguishes synchronized operation, pending uploads, download failure, upload failure, and local-only operation.

Before relying on an installed Tasks web app offline, open that specific installation once with a network connection after installation and after each published update. Wait for the Tasks interface to finish loading, open Synchronization under Config, and confirm `Offline Launch` reports `Ready`. On a supported secure browser, that online visit silently stages one complete public application shell. It does not request notification permission, create a push subscription, or register a reminder target. Browser reminders remain separately opt-in through `Enable`.

An iPhone or iPad Home Screen web app has cookies and storage separate from Safari. A successful Safari load therefore does not prepare the installed app. Launch the Home Screen icon online, sign in there if requested, and confirm both `Synced` and `Offline Launch: Ready` inside the Home Screen app before testing or relying on offline startup.

### Native iPhone Companion And Widgets

The native Tasks companion uses the same production web application for signing in, reading, and editing tasks. It adds the native surface the installed web app cannot provide: a configurable large Home Screen widget for Today, Upcoming, Anytime, Someday, or Done.

The widget is a read-only projection of the last accepted Tasks state. Open the companion while connected to refresh it. The widget may show that its data is stale when iOS has not recently allowed the companion to update the shared cache. It does not sign in to Supabase or fetch task data independently while the companion is closed.

Widget rows expose only the information needed to identify work in the selected list. Notes, checklist text, Primary Link, Mail provenance, credentials, and synchronization errors are not copied into the widget cache. Signing out of the companion clears its cached widget data.

Tapping the widget title opens the selected list. Tapping a task opens that task only after the signed-in Tasks web application confirms that it belongs to the current owner and is visible in the selected list.

After that online stage, an installed Tasks app can reopen a `/tasks/*` route without a network connection. The service worker caches only the public HTML and versioned application assets needed to start Tasks. Task content, account data, credentials, API responses, PowerSync traffic, and other BathOS modules are not stored in that shell cache. Tasks continues reading and writing task data through its durable local database. A failed application update leaves the previous complete offline shell active instead of replacing it with a partial build.

`Preparing Sync` means the installation is connected but has not completed its first full synchronization. Do not treat it as synchronized yet. Open Synchronization under Config to inspect connection state, full-synchronization completion, queue depth, transfer activity, recent reliability events, and conflict receipts.

Tasks shows an upload error, download error, or offline state immediately. If the same degradation remains active for 30 seconds, Tasks opens one content-free reliability event on the current installation using the time it was first observed. Tasks retains the 50 most recent confirmed events and closes the active event when synchronization recovers or changes failure category. A production event that remains active for 2 minutes sends one warning to monitoring. The local event and warning contain only bounded health, queue, completion, and duration categories. They do not contain task content, task identifiers, owner identifiers, source metadata, or raw provider errors.

Do not treat `Local` as cross-device synchronization. In that state, the current installation can continue local work, but changes from other browsers, MCP clients, and Raycast cannot converge until the production connection returns.

### iPhone Home Screen Acceptance

Use this pass before relying on a new or refreshed iPhone installation offline:

1. Open Tasks in Safari with a network connection, wait for the interface to load, and confirm Synchronization under Config reports `Synced`.
2. Use `Share > Add to Home Screen`, then launch Tasks from its Home Screen icon while still online. Sign in inside the installed app if requested.
3. In the installed app, open Config, confirm Synchronization reports `Synced`, open Synchronization Details, and wait until `Offline Launch` reports `Ready`.
4. Disconnect the iPhone from Wi-Fi and cellular data, fully close the installed app, and reopen it into Today.
5. Create one disposable task, fully close and reopen the app while still offline, and confirm the task remains visible.
6. Restore connectivity, wait for `Synced`, and confirm the disposable task appears in another connected Tasks client before deleting it.
7. If browser reminders are desired on that installation, choose `Enable` separately, allow notifications, and complete one reminder-delivery check.

## Reminders

Browser reminders require connected storage, notification permission, and an active subscription for that browser. Notifications show task titles. Opening a notification returns to the relevant Tasks view and acknowledges the reminder separately from provider delivery.

In-app reminders remain available when browser notifications are unsupported, blocked, expired, or temporarily degraded. If a subscription expires, choose `Enable` again to register a new one.

## Backup, Restore, and Recovery

Use Backup and Restore under Config to download a checksum-protected JSON backup of task data, history, templates, recurrence, and schedules.

- Merge restore validates the backup and adds records that do not conflict with existing stable identifiers.
- Replace restore downloads a required pre-restore backup, asks for separate confirmation, and replaces the synchronized task graph in one server transaction.
- Completed, canceled, and deleted tasks remain recoverable through Done until their retention boundary. Uncheck a completed task to reopen it, activate a canceled task's leading control to reopen it, or activate a deleted task's leading trash control to restore it. The trash changes to a restore icon on hover or keyboard focus.
- Terminal content is automatically purged at the owner-local midnight beginning its 31st day in Done. The interface does not expose routine permanent deletion.
- Current backups use schema version 13 and omit the retired Project and heading entities. Supported schema 3 through 12 backups preserve Project-contained tasks by assigning the Project's Area directly when available, otherwise leaving the task unassigned. Project-only wrappers are not recreated.

Keep periodic downloaded backups once Tasks begins holding information that would be painful to reconstruct.

## Parallel-Use Boundary

Use Tasks alongside Things for as long as needed. There is no migration deadline.

- Keep important established workflows in Things while Tasks earns trust through ordinary use.
- Do not expect edits in either application to appear in the other.
- The approved Inbox Manager proof ended with seven accepted parallel tasks, an empty failure-free outbox, and a healthy Mail run. Its persistent parallel mode now sends each new eligible Mail item to both Things and BathOS Tasks through one AI evaluation.
- Parallel Mail handoff is creation-only. Things remains authoritative, no history is backfilled, and edits in either application do not appear in the other.
- Report recurring friction, missed reminders, synchronization failures, or a specific desired widget or control. Those observations determine the next product slice.
- The native companion remains intentionally subordinate to the web module. Native code should add Apple-only surfaces without creating a second task-editing implementation.
