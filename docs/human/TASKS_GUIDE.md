# Tasks Guide

BathOS Tasks is ready for deliberate personal parallel use at [os.bath.garden/tasks/today](https://os.bath.garden/tasks/today). Things remains authoritative during this trial. Tasks does not import, modify, or replace the Things library. During an explicitly enabled, self-expiring Inbox Manager trial, each newly verified Mail task is created in Things first and then handed to BathOS Tasks as an independent parallel copy.

## Start Here

1. Sign in to BathOS and open Tasks.
2. Check the synchronization control in the header. `Synced` means this installation has completed a full synchronization, local changes have uploaded, current server changes have downloaded, and no transfer is active or failing.
3. In the Browser Reminder Capability panel, choose `Enable` and allow notifications when Safari asks. Each browser or device must be enabled separately.
4. Optionally install Tasks from Safari. Use `File > Add to Dock` on macOS or `Share > Add to Home Screen` on iPhone and iPad.
5. Capture a few disposable or low-risk tasks before relying on the module for important work.

## Daily Workflow

| View | Purpose |
| --- | --- |
| Inbox | Unprocessed captures that still need a planning decision |
| Today | Work planned for the current day, including a separate This Evening section |
| Upcoming | Work with a future start date |
| Anytime | Active work without a scheduled start date |
| Someday | Inactive work kept for possible future attention |
| Logbook | Completed and canceled work |
| Trash | Recoverably deleted work |
| Projects | Areas, projects, headings, project tasks, and checklists |
| Templates | Reusable to-do and project structures |

Capture first, then plan. Press `N` from most Tasks views to focus the capture field or return to Inbox. New inline captures go to the current view when that view accepts direct capture. Raycast quick entry always goes to Inbox unless its command has a narrower documented destination.

Use start dates for availability, deadlines for the last acceptable date, and reminders for a specific local time. Mark work as `Waiting` when it cannot be acted upon now. Structured webpage, file, reading-item, and Mail sources remain distinct from the task title and notes.

## Keyboard Commands

Press `?` in Tasks to open the current keyboard reference.

| Keys | Action |
| --- | --- |
| `N` | Capture a task |
| `/` | Search tasks and views |
| `G`, then `I/T/U/A/S/L/P/R/E` | Open Inbox, Today, Upcoming, Anytime, Someday, Logbook, Projects, Trash, or Templates |
| `Command+Z` | Undo the latest safe task change |
| `Enter` | Edit the focused task |
| `C` | Complete the focused task |
| `M` | Move the focused task to an area, project, or heading |
| `W` | Choose when the focused task should appear |
| `Up/Down` | Move focus between tasks |
| `Option+Up/Down` | Reorder the focused task |
| `Command+Enter` | Save an open editor |
| `Escape` | Cancel or close the current surface |

## Capture from Raycast

The sibling Raycast project provides these authenticated commands:

- `Add Task`: Add a title and optional notes to Inbox
- `Add Page to Tasks`: Capture the active Safari or Chrome page with webpage provenance
- `Add Finder Item to Tasks`: Capture exactly one selected file or folder with a local file reference
- `Add to Tasks Reading List`: Create an AI-titled reading item in Today

The first use of any command opens BathOS authorization in the browser. Later uses refresh the delegated token automatically. Raycast keeps its rotating token and any ambiguous pending capture in the macOS login Keychain under `garden.bath.tasks-raycast`.

## Synchronization and Offline Work

Tasks writes through a local database first. Existing task data remains available during a temporary network interruption, and accepted local changes wait in the upload queue. The header status distinguishes synchronized operation, pending uploads, download failure, upload failure, and local-only operation.

Before relying on an installed Tasks web app offline, open Tasks once with a network connection after installation and after each published update. Wait for the Tasks interface to finish loading. On a supported secure browser, that online visit silently stages one complete public application shell. It does not request notification permission, create a push subscription, or register a reminder target. Browser reminders remain separately opt-in through `Enable`.

After that online stage, an installed Tasks app can reopen a `/tasks/*` route without a network connection. The service worker caches only the public HTML and versioned application assets needed to start Tasks. Task content, account data, credentials, API responses, PowerSync traffic, and other BathOS modules are not stored in that shell cache. Tasks continues reading and writing task data through its durable local database. A failed application update leaves the previous complete offline shell active instead of replacing it with a partial build.

`Preparing Sync` means the installation is connected but has not completed its first full synchronization. Do not treat it as synchronized yet. Choose the header status to inspect connection state, full-synchronization completion, queue depth, transfer activity, recent reliability events, and conflict receipts.

An upload error, download error, or offline state opens one content-free reliability event on the current installation. Tasks retains the 50 most recent events and closes the active event when synchronization recovers or changes failure category. A production event that remains active for 2 minutes sends one warning to monitoring. The local event and warning contain only bounded health, queue, completion, and duration categories. They do not contain task content, task identifiers, owner identifiers, source metadata, or raw provider errors.

Do not treat `Local` as cross-device synchronization. In that state, the current installation can continue local work, but changes from other browsers, MCP clients, and Raycast cannot converge until the production connection returns.

### iPhone Home Screen Acceptance

Use this pass before relying on a new or refreshed iPhone installation offline:

1. Open Tasks in Safari with a network connection, wait for the interface to load, and confirm the header reports `Synced`.
2. Use `Share > Add to Home Screen`, then launch Tasks from its Home Screen icon once while still online.
3. Disconnect the iPhone from Wi-Fi and cellular data, fully close the installed app, and reopen it into Today.
4. Create one disposable task, fully close and reopen the app while still offline, and confirm the task remains visible.
5. Restore connectivity, wait for `Synced`, and confirm the disposable task appears in another connected Tasks client before deleting it.
6. If browser reminders are desired on that installation, choose `Enable` separately, allow notifications, and complete one reminder-delivery check.

## Reminders

Browser reminders require connected storage, notification permission, and an active subscription for that browser. Notifications show task titles. Opening a notification returns to the relevant Tasks view and acknowledges the reminder separately from provider delivery.

In-app reminders remain available when browser notifications are unsupported, blocked, expired, or temporarily degraded. If a subscription expires, choose `Enable` again to register a new one.

## Backup, Restore, and Recovery

Use `Task Backup and Restore` in the header to download a checksum-protected JSON backup of task data, history, templates, recurrence, and schedules.

- Merge restore validates the backup and adds records that do not conflict with existing stable identifiers.
- Replace restore downloads a required pre-restore backup, asks for separate confirmation, and replaces the synchronized task graph in one server transaction.
- Ordinary deletion is recoverable through Trash.
- Permanent deletion is available only for supported deleted roots, requires a fresh scope preview, and requires exact confirmation.

Keep periodic downloaded backups once Tasks begins holding information that would be painful to reconstruct.

## Parallel-Use Boundary

Use Tasks alongside Things for as long as needed. There is no migration deadline.

- Keep important established workflows in Things while Tasks earns trust through ordinary use.
- Do not expect edits in either application to appear in the other.
- The currently approved Inbox Manager trial ends automatically after 24 hours or 10 accepted parallel Mail tasks, whichever occurs first. Outside an explicitly enabled trial, Inbox Manager sends Mail tasks only to Things.
- Parallel Mail handoff is creation-only. Things remains authoritative, no history is backfilled, and edits in either application do not appear in the other.
- Report recurring friction, missed reminders, synchronization failures, or a specific desired widget or control. Those observations determine the next product slice.
- Native Apple development remains deferred unless normal use reveals a gap that the installed web app, Web Push, Raycast, or MCP cannot serve adequately.
