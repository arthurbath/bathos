## 1. Reliability Observation

- [x] 1.1 Add a bounded confirmation interval for newly observed synchronization degradation states while preserving their first-observed timestamp
- [x] 1.2 Keep non-degradation reconciliation immediate so confirmed episodes close promptly and existing episodes resume across reloads

## 2. Verification

- [x] 2.1 Add focused observer tests for transient blips, confirmed degradation, two-minute reporting, recovery, and reload behavior
- [x] 2.2 Run focused tests, the full release gates, and strict OpenSpec validation
- [ ] 2.3 Publish the change and verify an online production reload remains healthy without adding transient reliability events
