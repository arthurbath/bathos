## 1. Companion Authentication Boundary

- [x] 1.1 Add and test a shared approved-native-companion detector that preserves module isolation
- [x] 1.2 Configure Supabase to use a process-local serialized auth lock only in the native Tasks companion
- [x] 1.3 Reuse the shared bridge contract from the existing Tasks widget bridge

## 2. Authentication Bootstrap Recovery

- [x] 2.1 Make the initial session read settle authentication loading state on success, rejection, and provider cleanup
- [x] 2.2 Add regression tests proving a rejected session read cannot leave BathOS loading forever

## 3. Validation And Delivery

- [x] 3.1 Run focused authentication, native bridge, and companion tests
- [x] 3.2 Run TypeScript, lint, build, full application tests, and strict OpenSpec validation
- [ ] 3.3 Publish the verified web release and prove bounded authenticated startup on the physical iPhone
- [ ] 3.4 Recheck the warm-cache offline launch and record final production evidence
