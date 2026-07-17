## 1. Shared MCP Plumbing

- [x] 1.1 Add shared MCP helpers for authentication, structured responses, error responses, timestamp handling, and household resolution.
- [x] 1.2 Add shared schemas or utility types for resource operations and common validation.

## 2. Module MCP Tools

- [x] 2.1 Implement Garage read/write MCP tools for vehicles, services, servicings, and servicing outcomes.
- [x] 2.2 Implement Snake read/write MCP tools for snakes and weight records.
- [x] 2.3 Implement Budget read/write MCP tools for expenses, income streams, budgets, categories, payment methods, and partner settings.
- [x] 2.4 Implement Wardrobe read/write MCP tools for wardrobe items.
- [x] 2.5 Register the expanded tool set and update MCP server instructions.

## 3. Generated Artifacts And Validation

- [x] 3.1 Regenerate Lovable MCP manifest and Supabase Edge Function output.
- [x] 3.2 Run `npm run build` and targeted checks for MCP TypeScript generation.
- [x] 3.3 Run `npm run spec:validate`.
- [x] 3.4 Smoke-check the authenticated MCP server after deployment or explain any deployment gap.
- [x] 3.5 Persist the MCP gateway authentication configuration, redeploy the function, and verify authenticated Garage access.
