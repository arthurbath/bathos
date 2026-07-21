# Personal Tasks Production Sync Topology

**Date:** 2026-07-20
**Category:** Technology / Operations / Privacy
**Status:** Recommendation Ready, Awaiting Approval

## Decision Needed

The Tasks module has passed local persistence, multi-client convergence, recovery, accessibility, performance, and ten-minute endurance gates. It is not yet remotely usable across the owner's devices because production BathOS does not configure `VITE_TASKS_POWERSYNC_ENDPOINT`. The current runtime therefore enters explicit browser-local mode. MCP and Raycast can write authoritative Supabase rows, but separate browser installations cannot receive those rows or synchronize their own queued changes without a production PowerSync service.

This decision is independent from the selected `Tasks` name, square-check icon, and launcher registration. The registered `/tasks` route remains fully usable in explicit local-only mode before remote synchronization is approved.

## Current Facts

- The linked BathOS Supabase project is active and healthy in `us-east-1`.
- A read-only 2026 Jul 20 check confirmed that the Bath Supabase organization is already on the Pro plan and the BathOS database runs Postgres 17.
- The repository contains tested task-only PowerSync schema and owner-scoped Sync Streams for all currently synchronized collections.
- The public committed `.env` has no PowerSync endpoint. Adding the eventual HTTPS endpoint there is safe, but database passwords and service configuration secrets are not.
- No production replication role, publication, or PowerSync instance has been created by this evaluation.
- The PowerSync CLI is not currently installed.

## Requirements for the Parallel-Use Phase

- A small number of personal Mac, iPhone, browser, MCP, and Raycast clients
- Owner-only downloads matching the existing RLS boundary
- Durable offline work if the sync service is unavailable
- Low operating burden while Things remains authoritative
- No secrets or personal task content in the public repository
- A bounded failure mode that cannot overwrite accepted revisions or duplicate logical work
- A clear upgrade path if BathOS later becomes authoritative

## Options

### PowerSync Cloud Free

PowerSync currently includes one isolated managed service, 2 GB of monthly synced data, 500 MB hosted on the service, 50 peak concurrent connections, and up to two service instances at no cost. Free projects deactivate after one week of inactivity.

This capacity is materially larger than the expected personal task workload. Daily parallel use should normally prevent inactivity deactivation. If deactivation or another service interruption occurs, the local database and durable upload queue remain available, but cross-device synchronization cannot be treated as current until the service reconnects.

PowerSync Cloud becomes another processor of personal task data. PowerSync states that cloud data is encrypted at rest, HTTP connections use TLS, access is controlled and logged, and its organization is SOC 2 Type 2 audited.

**Assessment:** Best initial parallel-use topology. It minimizes operational risk and cost while Things remains the fallback. It is not sufficient evidence for making BathOS authoritative.

### PowerSync Cloud Pro

PowerSync Cloud Pro currently starts at $49 per month. It removes inactivity deactivation and includes 30 GB monthly sync, 10 GB hosted data, 1,000 peak connections, email support, and webhook alerts.

**Assessment:** Operationally straightforward but disproportionate for the initial one-owner trial. Reconsider if the module becomes authoritative and uninterrupted managed service is worth the recurring cost.

### Self-Hosted PowerSync Open Edition

PowerSync supports Docker self-hosting with Postgres or MongoDB bucket storage. Self-hosting removes PowerSync Cloud as the managed data processor and may lower direct vendor cost, but it creates an always-on service, storage database, TLS endpoint, backups, monitoring, upgrades, compact jobs, secret rotation, and incident response obligation. The PowerSync Dashboard is not available for self-hosted instances.

PowerSync's production guidance assumes high availability with separate replication and API containers, a replicated storage database, and a load balancer. A single-instance personal deployment can deliberately accept lower availability during parallel use, but that is a custom operational compromise rather than the vendor's robust production baseline.

**Assessment:** A credible later privacy or cost choice for an operator willing to own the service. It introduces too much infrastructure before lived use proves the module deserves it.

### Replace PowerSync

RxDB remains the documented fallback if production integration exposes a material failure. No current trust gate has found such a failure.

**Assessment:** Not justified. Changing synchronization engines now would discard validated behavior without resolving the immediate deployment choice.

## Supabase Prerequisite

PowerSync requires direct logical replication, a dedicated replication role, a `powersync` publication, and a replication slot. Supabase states that pooler connections do not support logical replication and its current pricing marks external replication unavailable on the Free plan. The Bath organization is already on Pro, so no Supabase plan upgrade gate remains. The activation must still show any incremental billing before accepting it.

The eventual setup must use a least-privilege task-only role and publication rather than `FOR ALL TABLES`. Sync Streams must retain the explicit authenticated-owner predicate because the replication connection bypasses RLS. Production setup must also monitor inactive slots and WAL retention.

## Recommendation

Use PowerSync Cloud Free for a bounded real-world parallel-use trial, subject to two external-action approvals:

1. Approve a PowerSync Cloud account and the addition of PowerSync as a processor of personal task data.
2. Approve the production replication role, publication, slot, owner stream, Auth configuration, and public endpoint changes after the dashboard shows any incremental billing.

Provision one US-region development instance first. Configure Supabase Auth through the project's JWKS endpoint, a task-only replication role and publication, the committed owner-only Sync Streams, and the public client endpoint. Validate with a synthetic production account before allowing personal tasks. Clear the synthetic records after validation.

Do not connect Inbox Manager or treat the trial as migration approval during this step. Launcher registration is complete and does not authorize production synchronization. If the free service deactivates unexpectedly, becomes operationally noisy, or presents an unacceptable privacy boundary, evaluate a small self-hosted trial before paying for Pro.

## Promotion Gate

Before BathOS can become authoritative, revisit the topology using lived evidence. Choose either managed PowerSync without inactivity deactivation or a monitored and recoverable self-hosted service. Prove production backup, upgrade, outage, alert, and recovery behavior. Things remains authoritative until that later decision is explicit.

## Sources

- [PowerSync pricing](https://powersync.com/pricing)
- [PowerSync security](https://docs.powersync.com/resources/security)
- [PowerSync setup guide](https://docs.powersync.com/intro/setup-guide)
- [PowerSync self-hosting](https://docs.powersync.com/intro/self-hosting)
- [PowerSync production deployment architecture](https://docs.powersync.com/maintenance-ops/self-hosting/deployment-architecture)
- [PowerSync Supabase source connection](https://docs.powersync.com/configuration/source-db/connection)
- [PowerSync Supabase authentication](https://docs.powersync.com/configuration/auth/supabase-auth)
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase manual replication FAQ](https://supabase.com/docs/guides/database/replication/manual-replication-faq)
