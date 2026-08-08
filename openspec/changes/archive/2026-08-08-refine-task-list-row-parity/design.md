# Design: Refine task list row parity

## Decisions

### Expand list stacks, not row interiors

Apply the compensating negative inline margin to the shared planning-list stack. Ordinary rows and recurrence rows retain their internal padding, so resting content aligns with the page while the blue open/focus surface still contains its controls.

### Treat recurrence rows as first-class navigation rows

Use the same `data-task-row-id` and focus-target contract for dated recurrence prototypes as ordinary tasks. Focus state remains a single identifier namespace using `recurrence:<definition-id>`. The shared shell traversal therefore follows rendered DOM order without maintaining a second recurrence-only path.

### Preserve native link activation while requesting task closure

Primary Link activation remains a real anchor. Pointer activation follows the original anchor destination through native browser or application handling and concurrently requests a safe close of any different open editor. Tasks does not defer the anchor behind an asynchronous save because doing so can lose browser popup authorization. Modified-click behavior remains native and is never delayed or replaced.

### Separate text editing from checklist drag ownership

Checklist inputs never act as drag sources. A permanently mounted handle owns both native and immediate-pointer drag initiation. Task rows use the same explicit handle only on touch-capable surfaces, while point-and-click task reordering retains the existing summary-row drag surface.

### Retire the preference at the presentation boundary

Current clients no longer query or mutate `drag_handle_visibility`, and Config no longer exposes it. Retaining the column and legacy repository compatibility avoids unnecessary destructive migration work for cached clients.

## Risks and mitigations

- Negative margins can create horizontal overflow. Use the existing page inset magnitude and cover narrow viewports.
- Native link activation can occur while the previous editor is still flushing. Keep activation independent of editor closure, report any save failure through the existing task error path, and retain the editor if closure cannot complete.
- Recurrence navigation identifiers are not task identifiers. Keep the namespaced value and route activation through recurrence callbacks rather than task repositories.
- Permanent checklist handles consume width. Use the compact handle and offset the completion control so the editable input remains aligned with drawer fields.
