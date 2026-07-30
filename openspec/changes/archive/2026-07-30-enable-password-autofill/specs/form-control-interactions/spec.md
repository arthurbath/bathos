## ADDED Requirements

### Requirement: Authentication fields expose credential semantics
BathOS authentication forms SHALL identify usernames, current passwords, and new passwords with standard browser credential semantics while preserving native input, Password AutoFill, and password-manager behavior.

#### Scenario: Offer a saved credential during sign-in
- **WHEN** a user focuses the email or password field on the BathOS sign-in form in a compatible browser or web view
- **THEN** the email field identifies an account username and the password field identifies the current password so the credential manager can offer a saved credential for the active BathOS origin

#### Scenario: Distinguish account creation from sign-in
- **WHEN** a user opens the BathOS sign-up form
- **THEN** the display name, email-address username, and password fields identify name, username, and new-password values respectively

#### Scenario: Verify the native app-to-site credential relationship
- **WHEN** the paid Apple Developer team signs the Tasks iOS or macOS main app
- **THEN** the app declares `webcredentials:os.bath.garden` and the production site declares `SPJYXE7ZA3.garden.bath.tasks` as an authorized web-credential app

#### Scenario: Retain web credential semantics as a fallback
- **WHEN** Associated Domains verification has not completed or the authentication form runs outside a native companion
- **THEN** the standard HTTPS form semantics remain available without requiring a custom credential bridge
