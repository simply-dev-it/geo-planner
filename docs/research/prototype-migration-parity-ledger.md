# Prototype Migration Parity Ledger

## Status And Decision Trace

- Status: ACTIVE
- Evidence baseline reviewed: 2026-07-28; migration status reviewed on
  2026-08-13.
- Question: which legacy capabilities and safety boundaries must be proven
  before the retained prototype can be removed?
- Evidence owner: [Prototype Behavior Inventory](prototype-behavior-inventory.md).
- Durable outputs: accepted behavior belongs to the linked requirement files;
  cross-cutting target boundaries belong to the
  [target architecture](../architecture/target-product.md) and
  [local data-root contract](../architecture/data-root.md).
- Current progress: functional rows have accepted requirements but no row has
  implementation or end-to-end verification evidence yet; the repository-data
  boundary is decided but not verified for target runtime startup.
- Return when: a linked requirement changes status, implementation evidence is
  produced, a cutover gate is reviewed, or legacy removal is proposed.

Advance a row only together with a link or precise repository reference to the
evidence supporting its new state. Requirement acceptance, implementation,
verification, and owner cutover acceptance remain distinct.

## Purpose

This ledger prevents the prototype from being removed based on remembered
appearance or broad feature claims. Each retained capability advances through
observable evidence:

`BASELINED -> DECIDED -> REQUIREMENT_ACCEPTED -> IMPLEMENTED -> VERIFIED -> CUTOVER_ACCEPTED`

`NOT_RETAINED` means the observed behavior was explicitly classified as a
prototype constraint and needs no target imitation. Only the owner can accept a
requirement or cutover.

## Parity Matrix

| ID | Capability | Stage | Legacy evidence | Target boundary | Current state | Evidence required for `VERIFIED` |
| --- | --- | --- | --- | --- | --- | --- |
| `PARITY-001` | Create/open project from one or several parcel subjects plus context | MVP | Project config, parcel sources, build failure tests, sanitized single/multi fixtures | [PROJECT-001](../requirements/projects-and-aoi.md): canonical AOI resolution, visible context, and hard safety profile | `REQUIREMENT_ACCEPTED` | Both fixtures resolve the same subjects and explicit context; excessive separation is rejected before acquisition; restart preserves project input. |
| `PARITY-002` | Discover and control current source layers | MVP | Fixed controls, descriptor embedding, layer stack and visibility tests | [LAYER-001](../requirements/layer-viewing.md): server catalog, independent readiness, and accepted visibility profile | `REQUIREMENT_ACCEPTED` | All retained catalog layers appear with ready/degraded state; toggles persist; a missing layer is visible as state, never silent blank success. |
| `PARITY-003` | Navigate and reset the map | MVP | Zoom, pointer-centered wheel behavior, middle-button pan, reset, selection preservation | [LAYER-001](../requirements/layer-viewing.md): Angular/OpenLayers view state | `REQUIREMENT_ACCEPTED` | Automated interaction coverage plus manual narrow/desktop checks demonstrate zoom, pan, reset, selection, and no unintended page gesture conflicts. |
| `PARITY-004` | Select and inspect parcel subjects/context | MVP | Geometry/list/label selection and keyboard characterization; current detail fields | [LAYER-002](../requirements/layer-viewing.md): queryable parcel vector with evidence-class separation | `REQUIREMENT_ACCEPTED` | Mouse and keyboard select the same feature; number, role, provider/date, and qualified fields match the normalized response; missing optional fields remain explicit. |
| `PARITY-005` | Display and inspect planning zones and OUZ | MVP | APP GML parser, XY/YX fixtures, current vector styling | [LAYER-003](../requirements/layer-viewing.md): normalized planning vectors and provenance | `REQUIREMENT_ACCEPTED` | Both axis fixtures render in the correct location; feature symbol/designation and document provenance are inspectable; empty/no-coverage/parse failure differ. |
| `PARITY-006` | Display ortho, EGiB, land-class, address, and utility evidence | MVP | Exact WMS request matrix, raster stack, current reference snapshots | [LAYER-004](../requirements/layer-viewing.md): validated artifacts with provenance and warnings | `REQUIREMENT_ACCEPTED` | Spatial control points align on both fixtures; readiness/stale/no-coverage/failure are distinct; raster pixels do not expose invented feature identity. |
| `PARITY-007` | Acquire/refresh source evidence without losing last valid data | MVP backend dependency | Explicit refresh, optional/required failure, atomic promotion tests | [ACQUIRE-001](../requirements/layer-acquisition.md): bounded acquisition, validation, promotion, and progress | `REQUIREMENT_ACCEPTED` | Deterministic adapter tests cover success, OGC error, MIME/signature mismatch, timeout, cancellation, partial tile failure, retry, and last-valid preservation. |
| `PARITY-008` | Select and inspect a sketch | STAGE-2 | Map/list/label selection, keyboard behavior, current manual details | [SKETCH-002](../requirements/sketches.md): backend-owned versioned overlay features | `REQUIREMENT_ACCEPTED` | Mouse/keyboard selection agrees; immutable ID, geometry type, metadata, editability, and persistence state are visible without leaking private content. |
| `PARITY-009` | Draw point, multi-vertex line, and area | STAGE-2 | Draft/minimum-point behavior and geometry round-trip baseline | [SKETCH-001](../requirements/sketches.md): explicit geometry intent and finish/cancel/undo interaction | `REQUIREMENT_ACCEPTED` | Point, bent line, and polygon round-trip in project CRS; open/filled preview, Enter/double-click/finish, Escape, undo, and conversion offer match the accepted contract. |
| `PARITY-010` | Persist, edit, delete, and clear sketches safely | STAGE-2 | Whole-collection loopback save, atomic file replacement, failure preservation | [SKETCH-002](../requirements/sketches.md): immutable IDs, optimistic revision, and authoritative backend storage | `REQUIREMENT_ACCEPTED` | Stale writes cannot overwrite newer data; create/edit/delete/clear survive restart; duplicate geometries remain distinct; failed writes preserve the accepted revision. |
| `PARITY-011` | Import/export legacy sketches | STAGE-2 | GeoJSON export and ignored `manual-overlays.json` | [SKETCH-003](../requirements/sketches.md): previewed, reported, idempotent import and CRS-qualified export | `REQUIREMENT_ACCEPTED` | Same-file re-import creates no duplicates; valid IDs persist; missing IDs stabilize; source remains untouched; export round-trips geometry, CRS, identity, and metadata. |
| `PARITY-012` | Calculate source/sketch spatial relationships | STAGE-3 | Not implemented; owner-supplied percentages are non-calculated metadata | [ANALYSIS-001](../requirements/spatial-analysis.md): qualified vector sources and measured intersections | `REQUIREMENT_ACCEPTED` | Representative intersections, holes, multipart geometry, uncovered area, precision, provenance, and failure cases pass end-to-end acceptance. |
| `PARITY-013` | Keep runtime data out of tracked repository content | MVP foundation | Ignore rules, local overlay behavior, synthetic-fixture checks | [Local data-root contract](../architecture/data-root.md): PostgreSQL user state and authorized artifact storage remain valid product storage | `DECIDED` | Clean clone/startup creates only ignored artifact state and local PostgreSQL data; path traversal and unwritable-root tests fail safely; tracked fixtures remain unchanged. |

## Behaviors Not Retained As Product Contracts

| Legacy behavior | Reason |
| --- | --- |
| One global bbox, raster size, CRS-axis flag, and fixed raster catalog in HTML | Prototype configuration constraint replaced by AOI and source descriptors. |
| Anonymous rasters stretched over the bbox | Replaced by spatially explicit validated artifacts. |
| Browser-local and repository overlay merge by name/geometry | Replaced by authoritative immutable identity and optimistic revision. |
| Whole-page rebuild/reload after each save | Prototype development loop, not target mutation behavior. |
| CDN-loaded geometry runtime | Replaced by bundled Angular/OpenLayers dependencies. |
| Generated HTML as the normal application runtime | Replaced by frontend plus controlled backend data delivery; future share/export value requires its own accepted requirement. |
| Silent local-storage parse and polling failures | Replaced by explicit actionable state. |

## Cutover Gates

Legacy removal is blocked until:

1. every retained MVP row is `VERIFIED`;
2. the Angular frontend passes representative desktop, narrow-viewport,
   keyboard, slow-request, cancellation, and degraded-layer checks;
3. backend adapter fixtures cover both sanitized locations and XY/YX rules;
4. overlay import is verified on a reviewed copy without modifying the source;
5. privacy and local-data-root boundaries pass on a clean clone;
6. the owner performs the side-by-side spatial review and sets the applicable
   rows to `CUTOVER_ACCEPTED`;
7. any intentionally deferred STAGE-2/STAGE-3 capability has an explicit
   retained legacy route or accepted temporary absence.

Until those gates pass, correctness, privacy, deterministic comparison, and
fixture maintenance may change the legacy path; new legacy product features do
not.
