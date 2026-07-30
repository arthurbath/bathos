## Context

`TaskMarkdownNotes` already parses each source line into a heading marker, an optional bullet marker, and inline tokens. It exposes the original marker on active source lines, substitutes one proportional bullet glyph on semantic lines, and selects source or semantic hanging indentation from the presentation. Bullet parsing and Return continuation currently hard-code `* `.

## Goals / Non-Goals

**Goals:**

- Treat `* ` and `- ` at the beginning of a line as equivalent bullet syntax.
- Retain the exact authored two-character marker in active source presentation and persisted Notes.
- Reuse the same semantic bullet glyph and presentation-specific indentation for both markers.
- Continue a bullet with the same marker style used by its current line.

**Non-Goals:**

- Normalize or rewrite existing Notes source.
- Add nested lists, numbered lists, alternate Markdown constructs, or shared Markdown infrastructure.
- Change bullet glyphs, typography, line height, or indentation measurements.

## Decisions

### Preserve the parsed source marker

The parser will recognize either exact prefix and retain that prefix as `bulletIndicator`. Existing rendering already treats the indicator as source text on active lines and hides it behind the semantic bullet glyph on inactive lines, so preserving the original marker avoids normalization and keeps source offsets stable.

Alternative considered: normalize hyphens to asterisks. Rejected because Notes are plain-text source and the editor promises exact source preservation.

### Continue the current marker style

The Return handler will identify the bullet prefix on the current line and use that same prefix for the inserted line. This gives hyphen-authored lists predictable continuity without changing the established asterisk behavior.

### Reuse presentation-aware bullet layout

Both recognized markers will follow the existing `2ch` source indent and `0.75em` semantic indent. No new classes or visual branch are needed because both markers are two source characters and both preview as the same bullet-plus-space glyph.

## Risks / Trade-offs

- [A leading hyphen used as prose could become a bullet] -> Require the exact beginning-of-line `- ` sequence, matching ordinary Markdown semantics.
- [Parsing and Return handling could drift] -> Centralize marker recognition in one helper and cover both marker styles in parser, editor, preview, and continuation tests.
- [Semantic rendering could alter stored source] -> Keep source reconstruction based on the retained marker and assert exact source strings in tests.
