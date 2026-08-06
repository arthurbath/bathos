## 1. Shared Quick Entry Contract

- [x] 1.1 Add the versioned neutral contract for field order, labels, defaults, values, validation limits, payload version, and allowed metadata commands.
- [x] 1.2 Make the web Quick Entry domain consume the shared contract for contracted defaults, labels, values, and shortcut ownership.
- [x] 1.3 Add a deterministic Swift contract generator and checked-in generated model with drift detection.
- [x] 1.4 Add TypeScript and Swift tests covering contract decoding, fingerprints, field order, validation values, and command parity.

## 2. Native Draft and Controls

- [x] 2.1 Implement native draft, validation, normalization, mutation identity, submission, and focus state models.
- [x] 2.2 Implement the native Summary, Notes, and optional Link controls in contracted order and visual language.
- [x] 2.3 Implement native checklist disclosure, insertion, deletion, reordering, blank cleanup, and keyboard focus behavior.
- [x] 2.4 Implement native Start and Deadline fields and pickers with ordinary Tasks placement and date restrictions.
- [x] 2.5 Implement native Area, Actionability, Today horizon, and reminder controls with cached bootstrap values.
- [x] 2.6 Implement Tab traversal, Return ownership, Command+Return submission, nested Escape behavior, and the contracted Tasks Control commands.
- [x] 2.7 Replace the panel's WebKit content with the native editor while preserving panel geometry, movement, global toggling, and explicit actions.

## 3. Native Authority and Persistence

- [x] 3.1 Add a private owner-and-installation-bound Quick Entry credential with capability, expiry, revocation, hash-only storage, and least-privilege grants.
- [x] 3.2 Add bounded bootstrap and atomic idempotent creation RPCs for planning context, Areas, complete task metadata, ordered checklist items, reminder, and receipt readback.
- [x] 3.3 Extend the native action Edge Function with Quick Entry credential issue, bootstrap, create, and revoke actions plus strict payload validation and bounded errors.
- [x] 3.4 Add a macOS Keychain credential store, cached bootstrap store, native service client, retry behavior, and contract compatibility enforcement.
- [x] 3.5 Extend the authenticated main-window bridge to provision and revoke native Quick Entry authority without exposing it to widget-shared storage.
- [x] 3.6 Refresh the main Tasks surface and widget timelines after accepted native creation without blocking panel dismissal.

## 4. Validation and Cutover

- [x] 4.1 Add pgTAP coverage for credential isolation, bootstrap ownership, complete creation, normalization, atomic rollback, and idempotent retry.
- [x] 4.2 Add Edge Function tests for authentication, payload bounds, compatibility, retry receipts, and rejection mapping.
- [x] 4.3 Add native unit tests for every draft field, validation rule, focus transition, shortcut, picker, checklist operation, save error, retry, and cancel path.
- [x] 4.4 Build the macOS scheme unsigned for deterministic CI verification and signed with the configured Apple Development identity for local-device validation.
- [x] 4.5 Validate cold and warm invocation, first responder, rendering, scrolling, pickers, complete keyboard workflow, atomic save, cancellation, error recovery, and main-window/widget refresh by hand.
- [x] 4.6 Run targeted Vitest and native suites, then `npm run test`, `npm run lint`, `npm run build`, `npm run spec:validate`, Supabase database tests, database lint, and strict signature verification.
- [x] 4.7 Accept canonical checklist UUID text from native encoders regardless of hexadecimal letter casing and cover the Swift representation in pgTAP.

## 5. Production Rollout and Cleanup

- [x] 5.1 Prepare a read-only production preflight for the new private credential and RPC dependencies and obtain explicit approval before mutation.
- [x] 5.2 Apply and independently read back the approved migration and deploy/read back the matching native-action Edge Function before enabling the client.
- [x] 5.3 Publish the matching web credential bridge, rebuild/sign/install the macOS companion, and run and clean up an owner-scoped complete-capture acceptance fixture.
- [x] 5.4 Make native Quick Entry the shipping default after parity acceptance and remove the hosted Quick Entry WebKit, readiness, JavaScript forwarding, and compatibility-timeout path.
- [ ] 5.5 Synchronize durable specs, archive the OpenSpec change, and verify the repository and deployed artifacts are aligned.
