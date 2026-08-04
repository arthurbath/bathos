## 1. Transactional Creation Service

- [x] 1.1 Add the authenticated SECURITY INVOKER task-creation RPC with explicit grants
- [x] 1.2 Preserve normalized placement, source, Primary Link, provenance, and owner-safe result semantics
- [x] 1.3 Serialize idempotency and tail-order allocation and return the trigger-authored creation receipt

## 2. MCP Integration

- [x] 2.1 Replace sequential generic creation queries with one Supabase RPC call
- [x] 2.2 Update generated Supabase types and rebuild the generated MCP Edge Function bundle

## 3. Verification Coverage

- [x] 3.1 Add pgTAP coverage for privileges, owner scope, planning, ordering, exact and changed retries, concurrency safety, and rollback
- [x] 3.2 Replace query-emulation unit coverage with one-RPC contract and error coverage

## 4. Validation

- [x] 4.1 Run focused Tasks MCP and database tests
- [x] 4.2 Run Tasks typecheck, lint for touched files, build, and relevant repository tests
- [x] 4.3 Run Supabase database advisors and `openspec validate --all --strict`
- [x] 4.4 Audit the implementation against every change requirement and document the database-first deployment and timing verification steps
- [ ] 4.5 Archive the completed OpenSpec change so the canonical specifications include the transactional creation contract
