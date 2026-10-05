# GCP Cost Options

## Status And Decision Trace

- Status: DEFERRED
- Evidence checked: 2026-07-28 against GCP, Firebase, Neon, and Supabase
  product and pricing documentation.
- Question: which development operating model and managed PostgreSQL provider
  can support intermittent cloud integration without creating an unjustified
  standing cost?
- Completed decisions: PostgreSQL is the accepted persistence model; the
  [target architecture](../architecture/target-product.md) and
  [local data-root contract](../architecture/data-root.md) own state and
  artifact boundaries. [GCP Development Topology](gcp-development-topology.md)
  records candidate cloud connections.
- Open decisions: cloud development profile, managed PostgreSQL provider,
  retention and quota values, and production cost model.
- Return before: provisioning paid resources, selecting a managed provider,
  accepting a hosted deployment, or setting product pricing and quotas.

Prices, free allowances, regions, editions, and provider behavior change. Fill
the workload model and recalculate from current official calculators before
every provisioning or commercial decision. Values observed in 2026 are not a
budget commitment.

## Development Operating Models

| Profile | Shape | Assessment |
| --- | --- | --- |
| Fully local daily development | Angular/Node simulator, Spring Boot, local PostgreSQL, local artifact root, and emulators only for accepted cloud slices | Recommended baseline: no standing cloud cost and deterministic offline verification. It does not continuously prove IAM, Cloud Run, managed database, or object-storage integration. |
| On-demand private preview/integration | Scale-to-zero API, managed PostgreSQL available only for review windows, small lifecycle-managed object storage, and repeatable Infrastructure as Code | Recommended companion when cloud integration is needed. Teardown, health checks, expiry labels, and cost alerts are part of the environment. |
| Continuously running cloud development | Persistent shared API, database, storage, logs, and backups | Not justified for current intermittent single-owner work. Reconsider for continuous collaboration, automated environments, or production-like operational testing. |

## Managed Persistence Alternatives

All candidates must preserve standard PostgreSQL migrations and keep raster and
export bytes outside database columns.

| Alternative | Status | Potential fit | Required validation or rejection reason |
| --- | --- | --- | --- |
| External scale-to-zero PostgreSQL, such as Neon | Candidate | Low idle compute cost while retaining PostgreSQL/PostGIS semantics. | Prove Cloud Run TLS connectivity, pooling, cold starts, migrations, PostGIS, latency, backup/restore, usage reporting, regional placement, and cross-provider network cost. |
| Cloud SQL PostgreSQL | Candidate | Conservative same-provider networking, IAM, support, and production operations. | Compare its idle development baseline, stopped-instance residual costs, connection limits, private networking, backup, and operational simplicity. |
| Supabase PostgreSQL | Deferred candidate | Viable if the product intentionally adopts more of its Auth, Storage, API, or administrative platform. | Using only its database alongside Firebase services duplicates platforms; evaluate that overlap explicitly. |
| Firestore-first persistence | Rejected for the accepted model | Can reduce setup and idle cost for small document-shaped prototypes. | Conflicts with the accepted relational persistence model and introduces document/query constraints plus likely migration work. |
| File-backed authoritative runtime state | Rejected for the accepted model | Minimal local infrastructure. | Conflicts with accepted PostgreSQL ownership of projects, jobs, overlays, revisions, manifests, and imports. |

Do not treat an external provider as selected before the disposable proof. Use
no real owner data in that environment. The proof should also demonstrate
`pg_dump` and restore into another PostgreSQL instance so provider portability
is observed rather than assumed.

## Workload Model

Estimate monthly inputs before comparing current calculators:

| Input | Symbol |
| --- | --- |
| active users | `U` |
| projects created per user | `P` |
| acquired raster GiB per project before cleanup | `A` |
| retained fraction after lifecycle cleanup | `R` |
| browser transfer GiB per project view | `V` |
| project views per month | `Q` |
| acquisition compute seconds per project | `T` |
| managed database running hours per month | `H` |
| API-to-database transfer GiB per month | `D` |

```text
retained GiB        = U × P × A × R
viewer egress GiB   = U × Q × V
acquisition time    = U × P × T
database baseline   = current selected-instance price × H
external DB network = provider egress + application internet egress for D
```

Add storage operations and retrieval, backups, logging, memory, database
storage, and network charges. Do not reduce the baseline for cross-user raster
or tile deduplication until measured evidence supports it.

## Cost And Safety Controls

- Provision cloud environments through reviewed Infrastructure as Code and
  make persistent development deployment opt-in.
- Keep minimum compute instances at zero where the selected service and latency
  contract allow it; bound maximum instances and database connection pools
  together.
- Apply short development artifact retention, incomplete-upload cleanup, and
  explicit database/storage expiry or teardown behavior.
- Enforce product AOI, pixel, response-byte, retained-byte, and active-job
  quotas independently of provider billing alerts.
- Use separate development and production billing views, current budgets with
  multiple alert thresholds, and environment/owner/expiry labels.
- Bound log retention and verbosity and never log artifact or overlay bodies.
- Treat budget notifications as signals, not hard spending caps; use service
  quotas or an explicitly reviewed automated response for a hard brake.

## Primary References

- `https://cloud.google.com/run/pricing`
- `https://cloud.google.com/sql/pricing/`
- `https://docs.cloud.google.com/sql/docs/postgres/start-stop-restart-instance`
- `https://cloud.google.com/storage/pricing`
- `https://docs.cloud.google.com/storage/docs/lifecycle`
- `https://firebase.google.com/docs/firestore/pricing`
- `https://firebase.google.com/docs/firestore/quotas`
- `https://cloud.google.com/identity-platform/pricing`
- `https://docs.cloud.google.com/billing/docs/how-to/budgets`
- `https://neon.com/pricing`
- `https://neon.com/docs/introduction/scale-to-zero`
- `https://neon.com/docs/connect/connection-pooling`
- `https://supabase.com/pricing`
- `https://supabase.com/docs/guides/database/extensions`
