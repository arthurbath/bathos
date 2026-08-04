## 1. Direct Capture Service

- [x] 1.1 Add the authenticated `SECURITY INVOKER` Raycast webpage-capture RPC with explicit grants
- [x] 1.2 Fix placement, source provenance, empty Notes, Primary Link, and entry-channel values inside the RPC
- [x] 1.3 Preserve transactional creation and owner-scoped idempotency through the existing task-creation function

## 2. Raycast Integration

- [x] 2.1 Route structured webpage captures through direct PostgREST while leaving other captures on MCP
- [x] 2.2 Preserve OAuth token reuse, authorization retry, and pending-capture recovery

## 3. Verification

- [x] 3.1 Add pgTAP coverage for privileges, security mode, fixed fields, exact retry, validation, and owner scope
- [x] 3.2 Add Raycast unit coverage for request shape, transport routing, errors, and recovery
- [x] 3.3 Run focused database, Raycast, type, lint, build, and strict OpenSpec validation
- [ ] 3.4 Deploy database-first and collect new production timing samples
