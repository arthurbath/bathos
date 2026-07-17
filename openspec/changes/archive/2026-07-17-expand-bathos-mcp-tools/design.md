## Context

BathOS now has a deployed OAuth-backed MCP Edge Function generated from `src/lib/mcp/index.ts`. The first tool set is read-only and incomplete: it lists a few records but does not cover the module data users expect an AI to manage.

The module data model has two scope styles:
- Garage and Wardrobe records are scoped directly to the authenticated `user_id`.
- Snake and Budget records are scoped to a household, with access controlled by membership tables and existing RLS policies.

## Goals / Non-Goals

**Goals:**
- Expose explicit, authenticated MCP tools for reading and mutating the editable records in Garage, Snake, Budget, and Wardrobe.
- Keep MCP writes constrained to the signed-in user or their current household membership.
- Return structured JSON content suitable for AI clients and downstream tool chaining.
- Preserve the existing Lovable/Supabase OAuth model and generated Edge Function flow.

**Non-Goals:**
- Do not add service-role access, new bypass RPCs, or RLS policy relaxations.
- Do not expose file upload/download for Garage receipts in this change.
- Do not expose destructive household lifecycle actions such as leaving, deleting, joining, rotating invite codes, restore-point restore, or account deletion.
- Do not add new database tables or module UI behavior.

## Decisions

1. Use resource-oriented MCP tools grouped by module.
   - Decision: Add `get_*` and `set_*` tools for each module family, where `set_*` accepts an `operation` of `create`, `update`, or `delete` plus a resource-specific payload.
   - Rationale: This keeps the tool surface compact while still making resource boundaries explicit.
   - Alternative considered: One tool per operation per table. That would be clearer at the database level but would make the MCP tool list noisy and less useful to agent clients.

2. Resolve scope inside shared MCP helpers.
   - Decision: Add helpers that require authentication, create a Supabase client with the user bearer token, resolve Budget/Snake household membership, and attach `user_id` or `household_id` to writes server-side.
   - Rationale: Agents should not be trusted to supply the correct owner fields. Supabase RLS remains the final enforcement layer.
   - Alternative considered: Let agents pass owner fields directly. That is more flexible but creates more room for accidental cross-scope writes and confusing failures.

3. Use current table contracts, not module React hooks.
   - Decision: Implement MCP tools in `src/lib/mcp/tools` using Supabase table operations and small normalization helpers.
   - Rationale: Edge Functions cannot import browser hooks, and MCP behavior should be independent of React/query-client cache behavior.
   - Alternative considered: Extract shared hook logic into a common package. That would be larger than needed for this MCP expansion.

4. Keep receipt files and household admin flows out of scope.
   - Decision: Garage servicing tools can manage servicing rows and service outcomes, but not receipt binary storage.
   - Rationale: File upload through MCP has a different payload/security shape and should be designed separately.

## Risks / Trade-offs

- Writable MCP tools increase blast radius if an AI client makes the wrong call. Mitigation: keep the operations explicit, server-attach owner scope, return saved rows, and rely on OAuth consent plus RLS.
- The compact resource/action tools require clients to read schemas carefully. Mitigation: use narrow enum values, descriptions, and `additionalProperties: false` through Zod schemas.
- Household selection can be ambiguous if a user belongs to multiple households. Mitigation: accept optional `household_id` for household-scoped tools and otherwise use the first accessible household as a default.
- Existing connected clients may still show the old tool list until the MCP server is redeployed and the client refreshes. Mitigation: regenerate the Lovable manifest/function and restart/reconnect clients after deployment.

## Migration Plan

1. Add helper utilities and module tool files under `src/lib/mcp`.
2. Update `src/lib/mcp/index.ts` to register the expanded tool list and update instructions.
3. Run the build/plugin generation so `.lovable/mcp/manifest.json` and `supabase/functions/mcp/index.ts` reflect the new tool surface.
4. Deploy the updated `mcp` Edge Function through the existing Supabase/Lovable flow.
5. Roll back by reverting the MCP source change and redeploying the previous `mcp` function.
