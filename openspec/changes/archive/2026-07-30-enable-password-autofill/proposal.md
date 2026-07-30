## Why

The shared BathOS sign-in form does not explicitly identify its email and password fields to browser and web-view credential managers. Adding standard credential semantics and a verified app-to-site association lets Safari and the Tasks iOS and macOS `WKWebView` wrappers offer passwords saved for `os.bath.garden`.

## What Changes

- Mark the shared sign-in email field as the account username and the password field as the current password.
- Mark the shared sign-up fields with the corresponding name, username, and new-password semantics so Password AutoFill does not confuse account creation with sign-in.
- Add regression coverage for the credential-field semantics.
- Associate the Tasks iOS and macOS apps with `os.bath.garden` through the paid Apple Developer team.
- Serve the matching `apple-app-site-association` declaration from `os.bath.garden`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `form-control-interactions`: Authentication fields explicitly expose standard Password AutoFill semantics while retaining ordinary native input behavior.

## Impact

- Shared platform authentication UI in `src/platform/components/AuthPage.tsx`
- Authentication component tests
- Safari, installed web apps, and the Tasks iOS and macOS `WKWebView` wrappers that render the shared sign-in page
- Tasks iOS and macOS app entitlements and automatic-signing profiles
- Static web assets served from `os.bath.garden`
- No database, Supabase, API, or custom credential-storage changes
