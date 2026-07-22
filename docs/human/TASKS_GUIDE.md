# Tasks Guide

BathOS Tasks is ready for deliberate personal parallel use at [os.bath.garden/tasks/today](https://os.bath.garden/tasks/today). Things remains authoritative while Tasks earns trust. Tasks does not import, modify, or replace the Things library. The approved Inbox Manager parallel proof is complete and its BathOS handoff is disabled.

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
| Upcoming | Work controlled by a future start date or, when no future start exists, a future deadline |
| Anytime | All active work available now, including every Today task |
| Someday | Inactive work kept for possible future attention |
| Done | Completed, canceled, and recoverably deleted work retained for 30 full owner-local days |
| Projects | Areas, projects, headings, project tasks, and checklists |
| Templates | Reusable to-do and project structures |

Today, Upcoming, Anytime, and Someday remain directly available in the primary navigation. Open More for Projects, Templates, Done, and Config.

Press `N` from Today, Anytime, or Someday to focus the capture field. Today and Anytime captures default to Anytime and Today Inbox. Someday captures remain outside Today. Raycast capture commands also default to Anytime and Today Inbox.

Use Start Date for availability and Day Horizon for the Today section in which the work should appear. Inbox is the default triage section, followed by Now, Next, and Later. A future start date controls an item's Upcoming placement even when it also has a deadline. If no future start exists, a future deadline controls its placement instead. Upcoming groups tomorrow through the next seven days individually, later work through the next 12 months by month, and more distant work by year. A future item keeps its selected day horizon while it remains in Upcoming, then enters Today in that section on its owner-local start date. A future item without a selected horizon enters Today Inbox when due. Removing the day horizon from undated work keeps it in Anytime and removes it from Today.

Use deadlines for the last acceptable date and reminders for a specific local time. Mark work as `Waiting` when it cannot be acted upon now. Structured webpage, file, reading-item, and Mail sources remain distinct from the task title and notes. Expanded nonempty notes render complete safe Markdown, including emphasis, inline code, bulleted lists, and HTTP or HTTPS links. Choose Edit Notes to change the original plain-text Markdown. Empty notes open directly in the full-height editor.

## Keyboard Commands

Press `?` in Tasks to open the current keyboard and pointer reference. The panel always shows Mac and Windows commands and identifies the current platform.

| Action | Mac | Windows |
| --- | --- | --- |
| Capture a task | `N` | `N` |
| Search tasks and views | `/` | `/` |
| Open Today, Upcoming, Anytime, Someday, Projects, Done, Templates, or Config | `G`, then `T/U/A/S/P/D/E/C` | `G`, then `T/U/A/S/P/D/E/C` |
| Undo the latest safe task change | `Command+Z` | `Control+Z` |
| Redo the latest undone task change | `Command+Shift+Z` | `Control+Shift+Z` |
| Edit the focused task | `Enter` | `Enter` |
| Complete the focused task | `C` | `C` |
| Move the focused task to an area, project, or heading | `M` | `M` |
| Choose when the focused task should appear | `W` | `W` |
| Move focus between tasks | `Up/Down` | `Up/Down` |
| Reorder the focused task | `Option+Up/Down` | `Alt+Up/Down` |
| Save an open editor | `Command+Enter` | `Control+Enter` |
| Cancel or close the current surface | `Escape` | `Escape` |

Tasks retains up to 100 safe forward changes for keyboard undo and redo. A new forward change clears the redo path. The client rebuilds that cursor when synchronized history changes and temporarily withholds undo or redo until the current task and cursor-tip snapshots agree. It never skips an unsafe latest event to reach older history. The server independently rejects any stale inverse, preventing older work from overwriting intervening changes.

Command-click on Mac or Control-click on Windows enters selection mode and toggles a task. Shift-click replaces the selection with the contiguous range between the original anchor and the newly clicked task. Once selection mode is active, an ordinary click also toggles a task. Choose `Done` in the selection bar to return to ordinary single-click editing.

Drag a Today task before or after a task in another visible Today section to change its day horizon and order together. Empty Today sections remain hidden and do not act as drop zones. Dragging within Anytime or Someday changes order only. Keyboard and row-menu reorder commands remain section-bounded alternatives.

## Capture from Raycast

The sibling Raycast project provides these authenticated commands:

- `Add Task`: Add a title and optional notes to Anytime and Today Inbox
- `Add Page to Tasks`: Capture the active Safari or Chrome page to Anytime and Today Inbox with webpage provenance
- `Add Finder Item to Tasks`: Capture exactly one selected file or folder to Anytime and Today Inbox with a local file reference
- `Add to Tasks Reading List`: Create an AI-titled reading item in Anytime and Today Inbox

The first use of any command opens BathOS authorization in the browser. Later uses refresh the delegated token automatically. Raycast keeps its rotating token and any ambiguous pending capture in the macOS login Keychain under `garden.bath.tasks-raycast`.

## Synchronization and Offline Work

Tasks writes through a local database first. Existing task data remains available during a temporary network interruption, and accepted local changes wait in the upload queue. Synchronization under Config distinguishes synchronized operation, pending uploads, download failure, upload failure, and local-only operation.

Before relying on an installed Tasks web app offline, open that specific installation once with a network connection after installation and after each published update. Wait for the Tasks interface to finish loading, open Synchronization under Config, and confirm `Offline Launch` reports `Ready`. On a supported secure browser, that online visit silently stages one complete public application shell. It does not request notification permission, create a push subscription, or register a reminder target. Browser reminders remain separately opt-in through `Enable`.

An iPhone or iPad Home Screen web app has cookies and storage separate from Safari. A successful Safari load therefore does not prepare the installed app. Launch the Home Screen icon online, sign in there if requested, and confirm both `Synced` and `Offline Launch: Ready` inside the Home Screen app before testing or relying on offline startup.

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
- Completed, canceled, and deleted work remains recoverable through Done until its retention boundary.
- Terminal content is automatically purged at the owner-local midnight beginning its 31st day in Done. The interface does not expose routine permanent deletion.
- Current backups use schema version 11. Supported older backups are normalized from Inbox, the former Today destination, daytime, evening, Logbook, and Trash semantics before restore.

Keep periodic downloaded backups once Tasks begins holding information that would be painful to reconstruct.

## Parallel-Use Boundary

Use Tasks alongside Things for as long as needed. There is no migration deadline.

- Keep important established workflows in Things while Tasks earns trust through ordinary use.
- Do not expect edits in either application to appear in the other.
- The approved Inbox Manager proof ended with seven accepted parallel tasks, an empty failure-free outbox, and a healthy post-disable Mail run. Inbox Manager now sends Mail tasks only to Things unless a separate future trial is explicitly approved.
- Parallel Mail handoff is creation-only. Things remains authoritative, no history is backfilled, and edits in either application do not appear in the other.
- Report recurring friction, missed reminders, synchronization failures, or a specific desired widget or control. Those observations determine the next product slice.
- Native Apple development remains deferred unless normal use reveals a gap that the installed web app, Web Push, Raycast, or MCP cannot serve adequately.
