## 1. Database authority

- [x] 1.1 Add restricted-module and access-grant tables, RLS, administrator synchronization triggers, and current-user/admin RPCs.
- [x] 1.2 Seed module definitions, mark Tasks restricted, and seed current administrator access before enforcing Tasks RLS.
- [x] 1.3 Add database tests for administrator inheritance, explicit grants, revocation, and Tasks isolation.

## 2. Platform experience

- [x] 2.1 Add a shared module-access hook and route gate.
- [x] 2.2 Filter the launcher and display the purple Restricted Access badge for explicitly granted non-admin users.
- [x] 2.3 Add Administration controls for restricted modules and user grants.
- [x] 2.4 Add focused platform tests.

## 3. Synchronization and closeout

- [x] 3.1 Filter every Tasks PowerSync query through the access-grant authority.
- [x] 3.2 Update generated Supabase types.
- [x] 3.3 Run database tests and lint, targeted Vitest, npm test/lint/build, and strict OpenSpec validation.
- [ ] 3.4 Archive the completed OpenSpec change and deploy the migration and Sync Streams configuration.
