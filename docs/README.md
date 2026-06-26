# BathOS Docs

BathOS documentation is split into two categories:

- `docs/agents/` — AI-agent context and working history, including architecture notes, module implementation guides, evaluations, and plans.
- `docs/agents/airtable-imports/` — archived notes from one-off Airtable migration scripts that may inform future imports.
- `docs/human/` — human-facing reference material, including design guidance and policy documents surfaced in the app.
- `openspec/` — change-scoped OpenSpec artifacts and durable behavior specs. Use `npm run spec:validate` before finishing spec-backed work.

This keeps the top-level docs hierarchy shallow while separating agent working context from docs intended for people.
