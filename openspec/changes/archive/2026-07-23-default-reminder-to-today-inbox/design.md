## Context

The unified Start picker currently disables its Reminder input until a to-do has either a future Start Date or a Today horizon. The production reminder RPC already derives an effective reminder date from either state: a future Start Date supplies its date, while any Today horizon supplies the owner's current planning date. The Tasks client therefore only needs to establish valid Today planning before it asks the existing reminder service to save an unplanned to-do's reminder.

Tasks represents work available today with `start_date = null` and a non-null `today_section`. Literal Start Dates are future-only. New-task drafts use the same editor before they have a persistent identifier and can retain a pending reminder until the first valid title creates the to-do.

## Goals / Non-Goals

**Goals:**

- Keep Reminder editable for an unplanned to-do when connected reminder storage is available.
- Treat a valid reminder entered on an unplanned to-do as Today · Inbox planning.
- Persist the planning mutation before the reminder mutation so the reminder RPC resolves the owner's planning date.
- Preserve existing future Start Dates and Today horizons.
- Support untitled new-task drafts without prematurely creating a to-do.
- Preserve current invalid-time feedback and autosave behavior.

**Non-Goals:**

- Allow reminders while connected reminder storage is unavailable.
- Store the current date in the future-only `start_date` column.
- Change reminder recurrence, time-zone, delivery, or backend resolution contracts.
- Change bulk reminder commands or project reminder forms.
- Add a database migration or new RPC.

## Decisions

### Interpret an unplanned reminder as a Today reminder during validation

The Start picker will resolve reminder input with Today validation whenever the to-do has no future Start Date. This makes an unplanned reminder reject elapsed owner-local times before any mutation, matching the Today · Inbox state that a successful save will create.

Treating an unplanned to-do as undated future work was rejected because it could accept a time that becomes invalid as soon as the to-do is placed in Today.

### Serialize Today · Inbox planning before reminder persistence

The existing to-do editor and row-level Start dialog will detect the transition from no Start Date and no Today horizon to a nonblank reminder. They will first autosave `destination = anytime`, `start_date = null`, and `today_section = inbox`, then invoke the existing reminder save.

This retains task history and undo behavior through the established task mutation path. Moving the default into the reminder RPC was rejected because it would hide a task-planning mutation inside reminder persistence, require new history semantics, and broaden the production database change unnecessarily.

### Preserve current planning without normalization

If a to-do already has a future Start Date or any Today horizon, reminder entry changes only the reminder. The feature does not replace Now, Next, or Later with Inbox and does not move a future Start Date to today.

### Retain draft planning and reminder intent separately

For an untitled new-task draft, the editor will store Today · Inbox in the draft before retaining its pending reminder. Once a valid title creates the to-do, the existing draft pipeline persists the planned task and then saves the pending reminder against that task.

## Risks / Trade-offs

- **The planning mutation can succeed before reminder persistence fails** → Existing error handling reports the reminder failure, the to-do remains visibly in Today · Inbox, and the planning mutation remains undoable through Tasks history.
- **A successful reminder can move a Someday or deadline-only Upcoming to-do out of its current view** → This is the intended consequence of making it available Today, and the existing close/save visibility behavior remains authoritative.
- **The Start picker is editable but reminders remain unavailable offline or in local-only mode** → The input continues using the existing connected-storage disablement and explanatory message.
