## Context

Tasks renders several action and reference dialogs with only a header and body. Most currently append “Escape Closes” as a pseudo-footer, while other footerless dialogs inherit the shared three-row modal grid and retain an empty bottom chin. Dialogs with real actions already use `DialogFooter` and must keep those controls.

## Goals / Non-Goals

**Goals:**

- Make symbolic keyboard chords compact and quickly scannable.
- Give Keyboard Commands one platform-standard application shortcut.
- Remove the persistent header trigger while preserving quiet discoverability on Config.
- Keep the Keyboard Commands container visually neutral when Radix moves focus into it.
- Render modifier symbols and key descriptions with the ordinary interface typography.
- Remove redundant Escape guidance from every Tasks dialog.
- Give header-and-body Tasks dialogs an explicit two-row layout whose body reaches the rounded bottom edge.
- Preserve every footer that contains a meaningful action.

**Non-Goals:**

- Changing Escape-key behavior.
- Removing modal close buttons.
- Altering confirmation, Save, Cancel, or explicit Close actions.
- Changing dialogs outside Tasks unless they later opt into the same shared primitive support.
- Restoring bare question-mark, shifted-question-mark, or other former help aliases.

## Decisions

### Add an explicit shared footerless dialog option

`DialogContent` will accept a `footerless` flag that selects a two-row header-and-body grid, removes the body’s bottom divider, and pulls the body through the default dialog bottom inset. Tasks dialogs with no action footer will opt into it.

This is preferable to detecting empty space with `:has()` because footer presence remains an explicit component contract and unrelated dialogs do not change accidentally. Custom zero-padding dialogs can apply the equivalent two-row and divider treatment directly because they do not use the shared inset.

### Preserve action-bearing footers

No `DialogFooter` or `AlertDialogFooter` containing buttons or other meaningful controls will be removed. The change distinguishes redundant guidance and empty layout tracks from actual modal actions.

### Store compact notation as display strings

The Keyboard Commands data will concatenate modifier symbols and keys directly, such as `⌘Z`, `⌥⇧Q`, and `⌘Click`. This changes presentation only. Keyboard event matching remains untouched.

### Make the slash chord the only keyboard-help binding

The shared Tasks keyboard resolver will map Command+/ on Mac and Control+/ on Windows to Keyboard Commands. The mounted Tasks shell will capture that application command before editable fields or browser behavior, open the modal, and restore the prior focus when the modal closes. Bare `/`, bare `?`, Command+Shift+/, and unrelated historical help aliases remain unbound.

### Move discoverability from the header to Config

The persistent Tasks header will no longer reserve an icon for Keyboard Commands. Config will instead show a quiet, platform-aware sentence such as `Press ⌘/ to view all keyboard commands.` The cue is informational rather than a second trigger, so the header stays focused on creation and search while the durable configuration surface teaches the shortcut.

### Keep modal focus and key typography visually neutral

The Keyboard Commands `DialogContent` will explicitly suppress its own focus outline and focus ring because focus initially lands on that container for dialog accessibility, not because the container is an interactive control. Descendant controls retain their ordinary focus indicators.

Shortcut values will remain semantic `kbd` elements but opt into the regular sans-serif interface typeface and inherit the table's normal text size. This avoids the undersized modifier glyphs produced by the monospace, extra-small treatment without changing chord content.

## Risks / Trade-offs

- **Risk: A footerless dialog retains an unintended bottom gap** → Cover the shared layout option and representative Tasks dialogs with DOM tests, then verify the panel visually.
- **Risk: A meaningful footer is removed during cleanup** → Inventory every Tasks `DialogFooter` and `AlertDialogFooter`; preserve all action-bearing instances.
- **Risk: Compact notation becomes ambiguous** → Retain platform columns, familiar modifier symbols, capitalization, and the existing action labels.
- **Risk: Removing the header button makes help undiscoverable** → Keep a visible platform-aware cue on Config and list the shortcut inside Keyboard Commands itself.
- **Risk: A task editor or native browser command wins the chord** → Capture the documented chord at the Tasks window boundary and cover editable-target behavior with regression tests.
- **Risk: Removing the container outline hides actionable focus** → Scope the override to the non-interactive dialog container and preserve focus indicators on the Close button and other descendants.
