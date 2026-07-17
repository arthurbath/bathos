## Why

The current BathOS MCP server only exposes a small read-only seed set of Lovable-generated tools. BathOS needs an official agent integration surface that lets an authenticated user connect an AI to the same household and personal module records they can manage in the app.

## What Changes

- Replace the seed read-only MCP surface with explicit read/write tools for Garage, Snake, Budget, and Wardrobe data.
- Keep every MCP operation scoped to the OAuth-authenticated BathOS user and the relevant user or household membership boundary.
- Support creating, updating, and deleting records for the module tables that are currently user-editable in BathOS.
- Preserve normal Supabase RLS enforcement by using the signed-in user's bearer token rather than service-role access.
- Leave receipt file upload/download, household invite flows, account deletion, and restore-point restore operations outside this MCP expansion.

## Capabilities

### New Capabilities
- `mcp-module-actions`: Authenticated MCP tools for reading and mutating Garage, Snake, Budget, and Wardrobe module data.

### Modified Capabilities

## Impact

- Affected source: `src/lib/mcp/**`, `.lovable/mcp/manifest.json`, and generated `supabase/functions/mcp/index.ts`.
- Affected systems: Supabase Edge Function `mcp`, Supabase Auth OAuth-issued user tokens, and existing RLS policies for `garage_*`, `snake_*`, `budget_*`, and `wardrobe_*` tables.
- Validation: OpenSpec validation, TypeScript/build checks, and direct MCP smoke checks after deployment or local generated output refresh.
