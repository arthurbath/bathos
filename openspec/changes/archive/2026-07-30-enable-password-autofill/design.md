## Context

BathOS authentication is a shared React surface. Safari, installed web apps, and the Tasks iOS and macOS companions all render that same HTTPS page, with the native companions using `WKWebView` at `os.bath.garden`.

The fields currently rely on browser heuristics. Apple documents explicit HTML `autocomplete` values as the supported way for a webpage or web view to identify usernames, current passwords, and new passwords. Apple also offers a stronger native app-to-site relationship through the Associated Domains `webcredentials` service. The Tasks apps are now enrolled under the paid Arthur Bath Developer Team, which retains Team ID `SPJYXE7ZA3` and can provision that capability.

## Goals / Non-Goals

**Goals:**

- Make the shared BathOS login form eligible for the correct Apple Password AutoFill suggestions.
- Distinguish sign-in credentials from account-creation credentials.
- Benefit Safari, installed web apps, and both Tasks native wrappers through one shared implementation.
- Establish a verified relationship between `garden.bath.tasks` and `os.bath.garden`.
- Preserve automatic signing under the paid Apple Developer team.

**Non-Goals:**

- Store, read, copy, or transmit passwords outside the existing Supabase sign-in request.
- Add a custom Keychain store or native credential picker.
- Add passkey authentication.

## Decisions

### Use standard HTML credential semantics

The sign-in email input will remain `type="email"` and declare `autocomplete="username"`. The sign-in password input will declare `autocomplete="current-password"`. This follows Apple's documented pattern for email-address usernames and gives WebKit explicit information instead of depending on heuristics.

The sign-up display name, email, and password inputs will declare `name`, `username`, and `new-password` semantics respectively. This keeps account creation from being mistaken for a current-password login.

Alternative considered: call Authentication Services from Swift and bridge credentials into JavaScript. This would duplicate the existing web authentication flow, expand the sensitive-data surface, and be unnecessary for a real HTTPS page hosted in `WKWebView`.

### Associate both native apps with the authentication host

The iOS and macOS main app targets will declare `webcredentials:os.bath.garden`. The widget targets do not render authentication and will not receive the entitlement.

The web build will serve `/.well-known/apple-app-site-association` with a `webcredentials.apps` entry for `SPJYXE7ZA3.garden.bath.tasks`. The file has no extension and must be served over HTTPS without a redirect. This gives Apple the app-side entitlement and site-side declaration required to verify the relationship.

The HTML credential semantics remain in place. They provide useful behavior in browsers and installed web apps and remain a fallback when the association has not yet been fetched or Password AutoFill is disabled.

### Associate with the actual authentication host

The rendered login origin is `os.bath.garden`, so saved credentials need to exist for that host. No client-side code will attempt to alias a credential stored only for the broader `bath.garden` domain.

## Risks / Trade-offs

- [Risk] WebKit can still depend on the user's Password AutoFill settings and stored credential metadata. → Mitigation: expose Apple's exact semantic tokens and retain ordinary native input behavior.
- [Risk] Apple cannot verify the relationship until the site-association file is deployed at the production HTTPS origin. → Mitigation: ship the app entitlement and site declaration as one release and verify the live response before relying on native suggestions.
- [Risk] Automatic signing may continue using stale Personal Team profiles. → Mitigation: build with provisioning updates enabled and verify the signed app entitlement and refreshed profile under Team ID `SPJYXE7ZA3`.
- [Risk] A credential saved only for another BathOS hostname may not be suggested for `os.bath.garden`. → Mitigation: associate with the actual authentication host and retain the standard HTML semantics.
