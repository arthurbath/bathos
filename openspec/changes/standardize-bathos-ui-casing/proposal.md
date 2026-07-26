## Why

BathOS currently applies title case and sentence case inconsistently across modules, especially in toast titles, placeholders, modal headings, and empty states. A durable application-wide casing contract and a complete source sweep will make the interface read as one coherent system and prevent future drift.

## What Changes

- Define sentence case for empty-state "No data" messages and toast message bodies.
- Define title case for toast titles, button labels, input labels, input placeholders, module names, page titles, modal titles, and all section headings.
- Retain the existing title-case convention for card titles and dropdown options because it is consistent with the new policy.
- Normalize affected system-authored UI copy across platform surfaces and every BathOS module without altering user-authored values.
- Add automated source-level casing validation for statically declared UI phrases and document how dynamic phrases preserve user data while title-casing their system-authored framing.

## Capabilities

### New Capabilities

- `ui-language-conventions`: Defines application-wide title-case and sentence-case requirements for system-authored interface phrases.

### Modified Capabilities

None.

## Impact

- Affects shared platform UI and all module source under `src/`.
- Updates `docs/human/STYLE_GUIDE.md` and the project instructions that summarize casing rules.
- Adds source-level validation using existing TypeScript and Vitest tooling.
- Does not change data, Supabase objects, APIs, user-authored content, or module isolation.
