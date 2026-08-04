## Context

Task and checklist Copy/Cut currently serialize the complete versioned BathOS envelope into `text/plain`. Internal paste therefore reconstructs all supported metadata, but external paste exposes implementation JSON. The Clipboard API supports multiple representations for one clipboard item. Standard `text/plain` and `text/html` formats are widely interoperable, while web custom formats provide a clean private channel where supported.

## Goals / Non-Goals

**Goals:**

- Preserve the existing versioned task and checklist envelopes without reducing internal paste fidelity.
- Expose readable one-item-per-line plain text to applications that do not understand BathOS data.
- Keep internal paste compatible across browsers with and without web custom clipboard formats.
- Continue accepting legacy BathOS JSON stored in `text/plain`.

**Non-Goals:**

- Define a public interchange schema for third-party task applications.
- Export every task metadata field as prose or rich text.
- Change task reconstruction, destination planning, Cut deletion, or undo behavior.

## Decisions

### Write three representations from one resolved snapshot

Each Copy/Cut action will resolve the existing snapshot once and derive:

1. `text/plain` with one task Summary or checklist-item title per line.
2. `text/html` with the same visible lines plus an encoded, inert BathOS payload marker.
3. A `web application/vnd.garden.bath...+json` custom representation when `ClipboardItem.supports()` confirms support.

The custom representation is the preferred private channel. The HTML marker is a compatibility channel for browsers and native web views that preserve standard HTML but do not expose web custom formats. The structured value remains the existing bounded, validated JSON envelope.

### Prefer structured representations during internal paste

Paste handling will inspect the private custom format first, then the encoded HTML marker, then `text/plain`. Structured data continues through the existing validated task or checklist parser. Plain text continues through existing multiline creation behavior. Legacy JSON-only `text/plain` remains valid because the existing parsers are unchanged.

### Preserve integrity on minimal clipboard implementations

If only `navigator.clipboard.writeText()` is available, BathOS will retain the existing JSON-only fallback rather than silently discarding task metadata. Modern clipboard implementations receive the dual-format behavior. This is preferable to making a lossy copy appear successful.

## Risks / Trade-offs

- **Risk: A browser rejects an optional custom format.** -> Check `ClipboardItem.supports()` and always provide standard text and HTML representations.
- **Risk: Another application strips BathOS metadata from HTML before a later paste back into Tasks.** -> Prefer the custom representation and gracefully treat the remaining plain text as new task or checklist titles.
- **Risk: An HTML payload is malformed or forged.** -> Decode it only as a candidate and pass it through the existing size, version, enum, and field validation.
- **Risk: A minimal clipboard surface supports text only.** -> Preserve the current full-fidelity JSON fallback and document that readable external paste requires a multi-format clipboard implementation.
