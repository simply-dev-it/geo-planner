# Spatial Evidence Domain

## Status And Scope

The Spatial Evidence domain covers assembling, qualifying, and comparing
geospatial evidence for a bounded property project. This document defines its
accepted terminology, identity, state, and safety meaning. The model is a
target model and is not yet implemented by the replacement applications.
Observable behavior and exact accepted limits remain owned by the
[requirements portfolio](../requirements/index.md).

Within this domain, projects and AOI, acquisition, layer viewing, sketches, and
analysis are cohesive capability areas. They are not declared as separate
domains, bounded contexts, or deployment units without implementation evidence.

## Evidence Classes

Every user-visible statement or geometry has an explicit class:

| Class | Meaning | Required qualification |
| --- | --- | --- |
| Source evidence | Data acquired from a named external provider or document. | Source identity, observation or document date, coverage, CRS, attribution, and limitations. |
| Project metadata | User-supplied classification, preference, or note. | Visible as user input rather than an official attribute. |
| Sketch | Private user-authored or explicitly imported geometry. | Identity, CRS, persistence state, and indicative status. |
| Derived result | A calculation from qualified source geometry and project or sketch input. | Inputs, source snapshots, uncovered data, tolerance, and uncertainty. |

Presentation, APIs, exports, and persistence must preserve these distinctions.
A raster pixel does not become feature identity, user metadata does not become
an official source attribute, and a derived value does not become legal,
cadastral, utility, planning, or surveying certainty.

## Project And Area Of Interest

A project is the authoritative container for one bounded spatial subject. It
has a stable ID, name, locale, privacy classification, canonical AOI geometry,
explicit CRS, selected catalog layer IDs, typed preferences, immutable
acquisition references, and backend-owned sketch state.

A project never contains executable provider URLs, credentials, filesystem
paths, bucket keys, or UI-specific branching. Spatially distant subjects become
separate projects rather than one unbounded acquisition.

AOI resolution produces canonical subject geometry and a buffered acquisition
extent. Coordinate order and CRS are explicit at every boundary. Invalid,
ambiguous, unresolved, or over-budget input cannot create a partial project.
The accepted parcel count, buffer range, and extent limits are owned by
[PROJECT-001](../requirements/projects-and-aoi.md).

## Source, Layer, And Readiness

A source catalog is server-owned. Each source and layer has a stable identity,
provider, protocol, attribution, licence note, uncertainty warning, supported
spatial contract, and acquisition policy. A project selects catalog IDs; user
input never becomes an unrestricted upstream request.

Layer readiness is independent per project layer:

- `loading`: work is active and no final result is claimed;
- `ready`: a validated usable result exists;
- `no coverage`: the source responded successfully but has no applicable data;
- `failed`: acquisition or validation did not produce a usable result;
- `unavailable`: the source or capability is not supported for the project;
- `stale`: a previously valid result no longer matches current project or
  source assumptions.

Failure of one evidence layer does not invalidate an otherwise valid project.
The last usable artifact is preserved unless the product contract explicitly
requires removal. Layer presentation and inspection behavior is owned by
[Layer Viewing Requirements](../requirements/layer-viewing.md).
Candidate source families and their evidence risks remain in
[Candidate Map Layers](../research/additional-map-layers.md) until discovery
produces an accepted requirement.

## Sketch Identity And Concurrency

A sketch is an explicit Point, LineString, or Polygon intent in the project
CRS. Geometry type does not change because of vertex count or visual closure.

The backend assigns every persisted sketch an immutable ID. Name, label, and
serialized geometry are content, not identity. Geometrically identical
sketches may represent different intent and are not silently merged.

Mutations use an optimistic collection revision. A stale revision rejects the
write and preserves the newer authoritative state. Legacy import is explicit,
previewed, reported, and idempotent for the same source; it never modifies or
deletes the source file. Detailed interaction and persistence behavior is owned
by [Sketches Requirements](../requirements/sketches.md).

## Acquisition, Record, And Artifact

An acquisition job moves through:

`QUEUED -> RESOLVING -> DOWNLOADING -> VALIDATING -> READY`

`FAILED` and `CANCELLED` are terminal alternatives. Results are independent per
layer, so a completed job may contain usable artifacts and explicit warnings.
Repeated normalized commands use backend-supported idempotency.

An acquisition record identifies the catalog and capability versions,
sanitized upstream request, spatial inputs, format, acquisition time, checksum,
size, provenance, warnings, job, and stale or superseded state. An artifact has
opaque identity; a path, bucket URL, or signed delivery URL is never its domain
identity.

Only a complete validated artifact becomes ready. Exact acquisition budgets
and observable failure behavior are owned by
[ACQUIRE-001](../requirements/layer-acquisition.md). Runtime orchestration and
storage handoff are defined in
[Acquisition And Artifact Architecture](../architecture/acquisition-and-artifact.md).

## Safety Invariants

- Source date, provenance, coverage, and uncertainty remain visible wherever a
  result is interpreted or exported.
- Missing data means unknown or no published coverage according to the source
  response; it never proves absence in the real world.
- Ambiguous CRS or coordinate order is rejected rather than guessed.
- Private project and sketch bodies are not logged or committed as fixtures.
- Planning previews do not determine building rights; raster cadastral and
  utility layers do not provide survey-grade feature identity.
- Spatial analysis reports qualified inputs, uncovered area, and tolerance and
  never derives authoritative categories from raster pixels.
