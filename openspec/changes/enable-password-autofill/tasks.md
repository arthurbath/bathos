## 1. Authentication Semantics

- [x] 1.1 Add explicit username and current-password semantics to the shared sign-in fields
- [x] 1.2 Add explicit name, username, and new-password semantics to the shared sign-up fields

## 2. Verification

- [x] 2.1 Add component regression tests for sign-in and sign-up credential semantics
- [x] 2.2 Run focused tests, TypeScript, lint, build, and strict OpenSpec validation

## 3. Native App-To-Site Association

- [x] 3.1 Add the `webcredentials:os.bath.garden` Associated Domains entitlement to the iOS and macOS main app targets
- [x] 3.2 Add the matching `apple-app-site-association` declaration to the production web artifact
- [x] 3.3 Refresh automatic-signing profiles through the paid Apple Developer team and verify both signed apps
- [x] 3.4 Run web, native, and strict OpenSpec validation
