## 1. Runtime Recovery

- [x] 1.1 Add a narrow classifier for the PowerSync closed-client startup failure and a one-attempt recovery policy.
- [x] 1.2 Rotate to a fresh database client generation automatically while guarding state, timers, and listeners from stale generations.
- [x] 1.3 Keep manual Retry as a fresh user-initiated startup episode with one new bounded automatic recovery allowance.

## 2. Failure Reporting

- [x] 2.1 Add a structured console diagnostic report containing the original exception and bounded runtime context.
- [x] 2.2 Capture automatically recovered and terminal Tasks startup exceptions in Sentry once per generation with allowlisted private-safe context and outcome severity.
- [x] 2.3 Replace raw exception text in the fallback screen with friendly copy that identifies logging and reporting and retains Retry.

## 3. Verification

- [x] 3.1 Add focused tests for classification, automatic recovery bounds, manual retry reset, stale-generation protection, friendly copy, and diagnostic privacy.
- [x] 3.2 Run focused runtime and reporting tests, TypeScript, lint, build, and strict OpenSpec validation.
