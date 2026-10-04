# GCP Development Topology

## Status And Decision Trace

- Status: DEFERRED
- Research recorded: 2026-07-28.
- Question: which GCP-facing connections could provide a private development
  deployment without presenting it as an accepted SaaS architecture?
- Completed outputs: the
  [target architecture](../architecture/target-product.md) owns
  the accepted application, persistence-port, and artifact-store boundaries;
  the [local data-root contract](../architecture/data-root.md) owns local
  artifact safety.
- Open choices: frontend hosting, identity provider, managed PostgreSQL
  provider, artifact delivery, and durable job orchestration.
- Return before: provisioning the first private GCP environment, accepting
  public user writes, or selecting production hosting and identity services.

Provider products, compatibility, regions, limits, and cost must be rechecked
before selection. Current comparisons and the required provider proof belong
to [GCP Cost Options](gcp-cost-options.md).

## Product Stage Versus Deployment

`MVP` describes product capability, not a localhost-only deployment. The same
feature set may run as:

- required local development or self-hosting;
- an early private cloud environment for integration and review;
- a later SaaS profile with identity, tenant ownership, quotas, retention,
  billing, and production operations.

A cloud deployment of MVP code is not SaaS-ready by itself.

## Candidate Private-GCP Connections

This is an option map, not an accepted provider topology:

```text
Angular
  -> candidate static hosting (Firebase Hosting or equivalent)
  -> candidate identity token (before accepting public writes)
  -> Spring Boot/Kotlin on Cloud Run
       -> accepted PostgreSQL persistence port
            -> candidate external scale-to-zero PostgreSQL
            -> candidate Cloud SQL PostgreSQL
       -> accepted ArtifactStore port
            -> candidate Cloud Storage
       -> later, only if required:
            -> CDN/range or tile delivery
            -> durable job orchestration
```

Local development continues to use the Node contract simulator for isolated
frontend journeys, Spring Boot with local PostgreSQL for real backend slices,
and the filesystem artifact adapter. Cloud-specific emulators or adapters enter
only with an accepted slice that uses the corresponding capability.

## Selection Boundaries

- Managed PostgreSQL must preserve the accepted relational model and migration
  path; the provider remains a deployment choice.
- Application-container files are temporary workspace, never authoritative
  project or artifact storage.
- Cloud Storage or an equivalent object service is a candidate `ArtifactStore`
  adapter, not a domain dependency.
- Authentication must precede public user writes, but Firebase Authentication
  is not yet an accepted product dependency.
- CDN delivery and Cloud Run Jobs, Cloud Tasks, Pub/Sub, or another durable job
  mechanism require measured delivery or reliability needs.
- A private environment must not silently establish multi-user tenancy,
  retention, quota, billing, or production-support contracts.

## Open Decision Gate

Before provisioning, select and validate one coherent combination of:

- static frontend hosting and same-origin routing;
- identity boundary appropriate to the environment;
- managed PostgreSQL provider and connectivity model;
- object-storage adapter and artifact delivery path;
- teardown, retention, cost controls, and infrastructure ownership.

The decision requires the current workload/cost model and a disposable proof
with no real owner data. Exact proof criteria and provider alternatives remain
in [GCP Cost Options](gcp-cost-options.md).

Primary references:

- `https://docs.cloud.google.com/run/docs/container-contract`
- `https://docs.cloud.google.com/sql/docs/postgres/connect-run`
- `https://firebase.google.com/docs/auth/admin/verify-id-tokens`
- `https://docs.cloud.google.com/storage/docs/lifecycle`
