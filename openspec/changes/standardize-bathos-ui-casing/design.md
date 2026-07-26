## Context

BathOS already requires title case for several control and heading categories, but the rule is incomplete and has not been applied consistently. The application contains system-authored phrases across shared platform screens and every module, including static JSX, toast configuration objects, placeholders, accessible control names, and phrases that combine fixed framing with user-authored values.

## Goals / Non-Goals

**Goals:**

- Establish one testable casing policy for the UI categories named by the user.
- Sweep shared platform code and every current module.
- Preserve proper nouns, acronyms, canonical product spellings, and user-authored values.
- Add automated coverage that catches future static-copy drift in the governed categories.

**Non-Goals:**

- Do not change user-authored task, project, area, household, vehicle, wardrobe, drawer, snake, budget, or other data.
- Do not rewrite body prose, helper text, legal text, validation prose, or descriptive accessibility text unless it belongs to a governed category.
- Do not runtime-transform arbitrary strings that may contain user content.
- Do not change layout, typography, behavior, database state, or APIs.

## Decisions

### Define title case as normalized system copy

Title case capitalizes the first and last lexical words and all other major words. Articles, coordinating conjunctions, and short prepositions remain lowercase when internal to the phrase. Canonical spellings such as `BathOS`, `macOS`, `iOS`, `PowerSync`, `DataGrid`, `CSV`, and `URL` remain unchanged.

This follows the existing BathOS convention instead of adopting CSS `text-transform: capitalize`, which would incorrectly capitalize minor words and alter acronyms and stylized names.

### Define sentence case by phrase role, not punctuation

Empty-state messages and toast bodies use sentence case whether or not the phrase ends with punctuation. The first lexical word is capitalized, while later words retain ordinary prose casing except for proper nouns, acronyms, and canonical product spellings.

### Treat accessibility names according to the control they label

A system-authored `aria-label` or tooltip title that serves as a button or input label follows the title-case control-label rule. Descriptive accessibility prose that communicates state or instructions remains sentence case. Dynamic user-authored portions are never normalized.

### Preserve established title-case categories

Card titles and dropdown options continue using title case. They are existing BathOS conventions and align with the new policy even though the user did not need to restate them.

### Validate source copy without runtime mutation

The sweep changes system-authored literals at their source. Focused automated validation inspects governed static phrases and tests the normalization rules. Dynamic phrases receive targeted tests where their fixed framing is not statically provable.

Runtime casing utilities will not be applied to complete phrases because those phrases may contain user-authored values whose capitalization must remain untouched.

## Risks / Trade-offs

- [Static analysis cannot resolve every computed phrase] → Cover common JSX and toast patterns automatically and add targeted tests for dynamic high-use surfaces.
- [Title-case automation can damage canonical spellings] → Preserve mixed-case tokens, acronyms, numeric tokens, and an explicit canonical-word set.
- [Broad copy edits can make existing tests brittle] → Update only assertions that intentionally encode changed system copy and run the full suite.
- [A global sweep can overlap unrelated dirty-worktree changes] → Restrict edits to casing at the exact string level and preserve all surrounding work.
