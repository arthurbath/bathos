## Context

Every module already routes its settings surface through `/config`, and most navigation entries already use Lucide Settings. The change is intentionally presentational so bookmarks, deep links, and keyboard navigation remain stable.

## Goals / Non-Goals

**Goals:**

- Use Settings everywhere a user sees the page concept.
- Use the Settings icon for page and navigation affordances.
- Preserve existing routes and keyboard shortcuts.

**Non-Goals:**

- Rename internal component symbols where users cannot see them.
- Migrate URLs from `/config` to `/settings`.

## Decisions

1. Existing `/config` paths remain canonical for backward compatibility.
2. Visible labels and accessible names change to Settings.
3. Existing keyboard command keys remain unchanged; only their displayed action name changes.

## Risks / Trade-offs

- **Risk: A hidden Config string remains in an empty state or help surface.** Use a repository-wide visible-copy sweep and targeted tests.
- **Trade-off: URL and page name differ.** Compatibility is more valuable than a cosmetic route migration.

## Migration Plan

No migration is required. The copy change can be rolled back independently.

## Open Questions

None.
