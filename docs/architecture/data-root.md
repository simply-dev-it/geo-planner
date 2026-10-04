# Artifact Data Root Architecture

## Status And Scope

Accepted migration boundary for the future MVP and self-hosted backend.
The data root is the filesystem implementation of large-artifact storage, not
the user-state database and not the product's commercial deployment contract.
This describes storage ownership and safety; it does not claim that the Kotlin
persistence adapters exist.

## Deployment-neutral Storage Ports

Application and domain services must not depend on filesystem paths, Cloud
Storage, S3, or another provider SDK. They depend on two capability-oriented
ports:

- `RuntimeStateStore`: projects, AOI state, jobs, manifests, overlays,
  optimistic revisions, imports, and storage-schema version;
- `ArtifactStore`: bounded streaming write, abort, validated promotion,
  metadata/stat, ranged read, authorized delivery, and deletion by opaque key.

The first adapters are:

| Deployment | Runtime state | Large artifacts |
| --- | --- | --- |
| Local development / self-hosted | PostgreSQL in Docker or another managed local container | Files below the local artifact data root |
| Hosted / commercial | Managed PostgreSQL through the same port | GCS/S3-compatible object storage adapter |

A file-backed `RuntimeStateStore` is not part of the initial architecture.
Projects, AOI state, overlays, revisions, jobs, manifests, imports, ownership,
and storage-schema version use PostgreSQL even during local development. A
future single-binary distribution would need an explicitly accepted embedded
database adapter; it must not make JSON files an accidental persistence model.

The ports own storage semantics, not vendor-shaped DTOs. In particular:

- services pass opaque IDs, streams, checksums, sizes, media types, and spatial
  metadata, never absolute paths, bucket URLs, or provider request objects;
- a successful promotion means a complete validated artifact becomes visible
  exactly once, even when an object store implements it through temporary keys
  and manifest state rather than filesystem rename;
- incomplete writes remain undiscoverable and can be cleaned up idempotently;
- ranged reads are supported when required by COG or tile delivery;
- quotas, authorization, retention, and encryption policy are applied at or
  above the port boundary and cannot be bypassed by selecting an adapter;
- provider-specific signed URLs are optional delivery results behind the
  adapter and never become durable domain identity.

Adapter selection is deployment configuration. Switching `ArtifactStore` from
filesystem to object storage must not change project, acquisition, provenance,
overlay, or frontend API contracts. An artifact migration command copies
through the source and destination ports, verifies byte count and checksum,
updates the PostgreSQL manifest transactionally, and leaves the source
untouched until the operator separately accepts cleanup. PostgreSQL provider
migration uses versioned schema migrations and standard dump/restore tooling,
not artifact-file copying.

## Configuration

The backend owns one configurable local artifact data root:

- logical setting: `geo-planner.storage.root`;
- environment binding: `GEO_PLANNER_DATA_ROOT`;
- local development default: `<workspace>/.geo-planner-data`;
- the resolved root must be writable and is always ignored by Git.

Production deployment must set an explicit persistent path. Project input,
provider responses, filenames, and HTTP parameters never select or alter the
root.

In the MVP the backend runs on the user's machine, so artifact bytes are
physically client-local and do not consume centralized server storage. User
state is still authoritative in the local PostgreSQL container.

## Layout

```text
.geo-planner-data/
  artifacts/
    <artifact-id>/
      content
  exports/
    <export-id>/
      content
  tmp/
    <job-id>/
```

The logical layout may evolve behind `ArtifactStore`, but these ownership rules
remain:

- artifact and export bytes are runtime data; their authoritative metadata and
  lifecycle state remain in PostgreSQL;
- temporary downloads and their final artifact are created on the same
  filesystem so successful validation can use atomic promotion;
- PostgreSQL manifests refer to opaque storage keys, never arbitrary absolute
  paths;
- job, export, and artifact IDs are validated before path resolution;
- every resolved descendant must remain under the canonical data root;
- incomplete temporary content is never exposed as a ready artifact.

## Privacy And Repository Boundary

The artifact root may contain generated exports, provider snapshots, and
location-identifying pixels. PostgreSQL contains private sketches and property
state. Neither store may be staged, logged as content, embedded into frontend
source, or copied into test fixtures.

Tracked spatial material is limited to explicitly reviewed public samples and
fully synthetic fixtures under `tests/fixtures/`. The legacy
`mapa/sources/`, `mapa/assets/`, and ignored `mapa/manual-overlays.json` remain
reference inputs until cutover; they are not silently migrated or moved by
normal startup.

Legacy import is an explicit user action. It reads the selected source,
previews and reports the result, writes new backend-owned state under the data
root and PostgreSQL as appropriate, and never modifies or deletes the source
file.

## Startup And Failure Behavior

- Startup creates the configured root and required subdirectories when
  permitted.
- Startup fails with a contextual configuration error when the root cannot be
  resolved, created, or written.
- Artifact bytes use temporary files plus atomic replacement; authoritative
  metadata is committed through PostgreSQL transactions.
- Restart recovery reconciles PostgreSQL manifests with temporary artifact
  content and marks interrupted jobs without promoting partial content.
- Quotas are evaluated before and during writes; exceeding one preserves the
  last valid state and reports the limiting budget.
- Cleanup targets only validated descendants of `tmp/` and never follows an
  unresolved user-controlled path.

Backup duration, retention values, encryption keys, and the selected hosted
providers remain deployment decisions for later plans. The storage ports and
filesystem/object-store interchangeability are required architecture from the
first persisted slice.
