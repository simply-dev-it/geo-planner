# Projects And AOI Requirements

## Application Area

Project identity, parcel subjects, surrounding context, and bounded spatial
extent. Source-layer acquisition and rendering belong to separate areas.

## Requirement Index

| ID | Delivery stage | Status | Priority | Capability |
| --- | --- | --- | --- | --- |
| `PROJECT-001` | `MVP` | `ACCEPTED` | `MUST` | Create a project from an interactive working area |

## PROJECT-001 — Create a project from an interactive working area

- Status: ACCEPTED
- Priority: MUST
- Delivery stage: MVP
- Source evidence: owner decisions from 2026-07-28 and 2026-11-17;
  `docs/research/area-of-interest-and-raster-sizing.md`; sanitized
  single/multi-parcel fixtures.

### Outcome

A user navigates a map of Poland, finds a place or parcel, and creates a project
from an editable bounded working area without calculating coordinates. Parcel
selection is optional and its source geometry remains distinct from the area.

### Contract

- The user can pan and zoom an interactive map across Poland independently of
  search, and can draw a project rectangle at any location without selecting a
  parcel.
- Search accepts a voivodeship, locality, street, or parcel number and moves the
  map to a selected candidate. Ambiguous results are presented for explicit
  choice; the system does not guess. Parcels can also be selected by map click
  or typed identifier.
- A project can contain zero to 100 selected parcels. Selecting an unambiguous
  parcel may suggest an initial area with 100 m context; later parcel changes
  must not silently overwrite a rectangle the user has edited.
- The project working area is a rectangle editable by its edges or corners,
  including an accessible alternative to pointer dragging. It may intersect
  only part of a selected parcel. Editing it never changes the source parcel
  boundary; the UI warns when selected parcels extend outside the area.
- The backend mediates map tiles through server-configured sources; the browser
  does not send arbitrary provider URLs. The provider and exact tile/search
  coverage remain implementation decisions subject to service evidence and
  owner review.
- Preview presents the rectangle, selected parcel geometries when present, CRS,
  source, observation date, attribution, warnings, and limits/uncertainty.
  Geometry is indicative evidence, not a legal or cadastral determination.
- Before creation, the backend validates the submitted rectangle and resolves
  selected parcels again; it saves only a complete result matching the preview.
  A successful project has a stable address and reopening after restart restores
  the rectangle, parcel identifiers/geometries, CRS, and relevant provenance.
- Unresolved or ambiguous parcels, invalid geometry, and any parcel-subject
  envelope or working rectangle exceeding 2 km width, 2 km height, or 4 km²
  block creation. The user can correct the retained input; there is no override.

### Acceptance Criteria

- The map can be navigated without a query; searches distinguish candidate kinds
  and show ambiguity instead of selecting an arbitrary result.
- A zero-parcel project and projects with selected parcels can both be
  previewed; point selection resolves the containing parcel or shows candidates.
- Editing the rectangle preserves selected parcel geometry, supports partial
  intersection, and reports parcels outside or partly outside the area.
- Single/multiple parcel fixtures and rectangle boundary fixtures produce
  deterministic extents and respect the CRS and axis-order declarations.
- Incomplete, ambiguous, stale, invalid, or excessive input cannot create a
  project; accepted width, height, and area limits have no confirmation override.
- Repeating an uncertain create with the same idempotency key and payload does
  not create a duplicate; changing the payload with that key is rejected.
- Restart preserves the project area, selected parcel identifiers/geometries,
  CRS, and relevant provenance.

### Out Of Scope

- Arbitrary polygon editing, source-layer acquisition, and downstream spatial
  analysis are separate requirements. They do not change parcel boundaries or
  expand this interactive rectangular project-creation requirement.
