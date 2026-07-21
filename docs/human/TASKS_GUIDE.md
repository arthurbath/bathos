# Tasks Guide

BathOS Tasks is ready for deliberate personal parallel use at [os.bath.garden/tasks/today](https://os.bath.garden/tasks/today). Things remains authoritative during this trial. Tasks does not import, modify, or replace the Things library, and Inbox Manager does not send Mail tasks to BathOS yet.

## Start Here

1. Sign in to BathOS and open Tasks.
2. Check the synchronization control in the header. `Synced` means local changes have uploaded and current server changes have downloaded.
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

Do not treat `Local` as cross-device synchronization. In that state, the current installation can continue local work, but changes from other browsers, MCP clients, and Raycast cannot converge til the production connection returns.

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
- Inbox Manager continues sending Mail tasks only to Things until dual writing receives separate approval.
- Report recurring friction, missed reminders, synchronization failures, or a specific desired widget or control. Those observations determine the next product slice.
- Native Apple development remains deferred unless normal use reveals a gap that the installed web app, Web Push, Raycast, or MCP cannot serve adequately.
