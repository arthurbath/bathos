## Context

Tasks currently contains two modal search surfaces. `TaskSearchDialog` is opened by the persistent magnifying-glass action and exposes query plus destination, lifecycle, actionability, and source filters. `TaskQuickFindDialog` provides the preferred compact three-result lookup and Continue Search handoff, but has no remaining trigger. The Tasks shell already owns route-wide capture-phase keyboard dispatch, so type-to-search can be added at the same boundary without creating another global listener.

## Goals / Non-Goals

**Goals:**

- Make Quick Find the only modal search surface opened from Tasks chrome.
- Preserve the first printable character when type-to-search opens Quick Find.
- Enable type-to-search consistently on every Tasks route.
- Preserve native text entry, IME composition, nested surface behavior, shortcuts, and browser commands.
- Retain the complete `/tasks/search` results route behind Continue Search.

**Non-Goals:**

- Add a dedicated Quick Find keyboard chord.
- Retain advanced modal filters or migrate them into Quick Find.
- Remove the full results route or its URL-backed query.
- Change search indexing, ranking, synchronization, or database behavior.

## Decisions

### Seed Quick Find through explicit shell state

The shell will keep a short initial-query value alongside the dialog-open state. A qualifying printable key prevents its otherwise unused page action, stores that exact character, and opens Quick Find. The dialog copies the seed when it opens and then owns normal input locally.

Dispatching a synthetic keyboard event into the newly mounted input was considered, but rejected because it is timing-dependent and less reliable for shifted characters, punctuation, and assistive technology.

### Claim only unmodified printable input from unowned surfaces

Type-to-search will require one printable character, no Command, Control, or Alt modifier, no active composition, and no key repeat. Shift remains allowed so uppercase letters and shifted punctuation enter exactly as typed. Editable controls, selects, contenteditable regions, dialogs, menus, listboxes, and other nested interaction surfaces retain the event.

Claiming every printable key regardless of target was considered, but rejected because it would break native form entry and control-specific typeahead.

### Retire the advanced modal while preserving complete results

The header search action will open `TaskQuickFindDialog`, and the shell will stop mounting `TaskSearchDialog`. The advanced dialog implementation and filter-only helpers can be removed when no other consumer remains. Continue Search will still navigate to the existing URL-backed complete results view.

Replacing the full results route was considered, but rejected because Quick Find intentionally caps results and still needs an exhaustive continuation path.

## Risks / Trade-offs

- [A printable key could be stolen from an interactive control] → Exclude editable and nested owned surfaces before claiming the event and cover those boundaries in shell tests.
- [The first character could be lost during modal mount] → Pass it as state instead of relying on focus timing or event replay.
- [Held keys could seed duplicate text] → Ignore repeated opening events and let the focused input handle ordinary repeat after mount.
- [Removing advanced filters reduces a niche capability] → This is intentional; retain exhaustive text results through Continue Search without preserving the unused filter dialog.
