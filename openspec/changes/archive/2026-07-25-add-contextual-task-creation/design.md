## Context

Tasks currently creates one local draft above the list regardless of the active view's grouping. The Today and Upcoming renderers already derive ordered section models, but creation does not consume those models. The desktop/mobile header also exposes New Task as a small icon beside Search, while the mobile bottom navigation occupies the physical bottom edge.

This change is confined to the Tasks module and must preserve the existing single-draft lifecycle, autosave behavior, keyboard command defaults, reduced-motion behavior, quick-filter projection, and mobile safe areas.

## Goals / Non-Goals

**Goals:**

- Give active planning views one prominent pointer/touch creation affordance.
- Let users create directly into visible Today and Upcoming buckets.
- Keep a new draft visually inside the bucket whose criteria it inherits.
- Keep the floating action clear of mobile navigation, safe-area insets, and the bulk toolbar.
- Restore a small static Title inset without reintroducing a second disclosure animation.

**Non-Goals:**

- Creating tasks from Done, Search, Config, Templates, Projects, area detail, or project detail.
- Adding new database fields, ordering semantics, or persistent user preferences.
- Changing the existing keyboard new-task command's Today Now default.
- Adding task creation to project planning rows or project hierarchy headings.

## Decisions

### Represent pointer creation as an optional planning placement

The existing draft factory remains the source of ordinary view defaults. Pointer entry points may provide either a Today horizon or an Upcoming Start date, which the factory applies while maintaining the exclusive Start/horizon invariant. This avoids duplicating draft construction and keeps keyboard creation unchanged when no override is supplied.

Alternative considered: Patch the draft immediately after construction. Rejected because it creates a transient incorrect placement and scatters normalization across UI callbacks.

### Derive the floating action from the first rendered task bucket

Today resolves the first nonempty visible horizon in Inbox, Now, Next, Later order and falls back to Now when no bucket exists. Upcoming resolves the first rendered Upcoming section's date anchor and falls back to tomorrow when the view is empty. Anytime and Someday retain their existing defaults.

Upcoming month and year sections use their existing canonical section anchors: the first day of the represented month or year. Those dates satisfy the section's eligibility criteria and keep the behavior deterministic.

Alternative considered: Use the first existing item's exact date for month/year buckets. Rejected because the heading represents the whole calendar period, not that item's private date.

### Render the draft through the ordinary section renderer

The active creation draft is prepended to the task projection only for its own planning view. Today, Upcoming, Anytime, and Someday then place it through their ordinary membership rules. Upcoming gives the draft explicit visual precedence inside its section so project entries cannot displace it from the top.

Alternative considered: Absolutely position or duplicate the existing global draft above a bucket. Rejected because it would separate visual placement from section semantics and complicate accessibility order.

### Use semantic buttons for both affordance types

The floating action is a large circular semantic-success button fixed above the mobile bottom navigation and safe area, or near the desktop bottom-right corner. Bucket labels are button contents inside their heading, with a small Lucide Plus revealed on hover or focus. The entire label-sized button remains clickable even when the icon is visually hidden on touch devices.

### Add Title space as static form padding

The editor form receives a four-pixel top padding. Because the form uses flex gap rather than sibling margins, the inset participates in the single animated disclosure region and cannot appear as a delayed second spacing step.

## Risks / Trade-offs

- **A filtered view can hide every ordinary bucket** → Use the established fallback for that view rather than deriving from filtered-out tasks.
- **A draft can be created in a section that later disappears due to metadata edits** → Retain the open draft until close, then let ordinary membership reconciliation and the existing neutral visibility toast run.
- **The floating action can overlap mobile navigation or bulk actions** → Offset it above the navigation safe area and hide it during bulk mode.
- **Month/year anchors may differ from a user's unstated preferred exact date** → Use deterministic canonical anchors and leave exact Start editable in the open draft.
- **A hidden hover icon can reduce discoverability on touch** → The large floating action remains the primary mobile affordance; bucket-header creation is an accepted secondary shortcut.
