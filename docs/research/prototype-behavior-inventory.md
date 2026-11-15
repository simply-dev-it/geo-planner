# Prototype Behavior Inventory

## Status And Decision Trace

- Status: ACTIVE
Observed on 2026-07-25 and expanded through code/configuration tracing on
2026-07-28 from:

- `mapa/map-fragment.template.html`;
- `mapa/scripts/build_map.py`;
- `mapa/scripts/edit_map_server.py`;
- `mapa/scripts/update_sources.py`;
- `mapa/project-config.json` and `mapa/map-config.json`;
- the generated map served by `edit-map.sh` on loopback.

- Question: what does the retained legacy application observably do, and which
  evidence must remain available for implementation comparison and cutover?
- Completed outputs: owner classification and accepted target behavior are
  recorded in [requirements](../requirements/index.md); migration state and
  cutover evidence are tracked in the
  [parity ledger](prototype-migration-parity-ledger.md); current functional
  behavior is owned by the
  [application specification](../spec/index.md); current legacy runtime
  flow is owned by [Map Build Flow](../architecture/legacy-map-build.md).
- Remaining use: compare each replacement capability against observed legacy
  success, degraded, failure, interaction, persistence, and spatial behavior.
- Return when: implementing a corresponding capability, changing legacy
  behavior or characterization tests, advancing a parity row, or proposing
  legacy cutover.

The business description was moved to `docs/spec/` after code/configuration
review on 2026-10-25. Original browser observations remain dated above; this
move does not claim a new browser acceptance run.

This is migration evidence, not a requirement that every prototype behavior be
retained. Requirements and the parity ledger identify accepted replacements
and explicitly discarded constraints.

## Evidence Routing

| Comparison subject | Current functional owner | Implementation evidence |
| --- | --- | --- |
| Configured project, build results, explicit refresh, degraded evidence | [Project and evidence](../spec/project-and-evidence.md) | `build_map.py`, `update_sources.py`, `edit_map_server.py`, synthetic fixture builds |
| Workspace, layer stack/defaults, navigation, parcel selection, raster/planning limits | [Map and layers](../spec/map-and-layers.md) | `map-fragment.template.html`, `map-config.json`, build characterization |
| Drawing, selection, removal, export, persistence modes and failures | [Sketches](../spec/sketches.md) | Template, editor validation/persistence tests, fixture round trips |
| Measured intersections absent; parcel percentages configured | [Current capability boundary](../spec/index.md#interpretation-boundary) | Project metadata, raster-only land classes, absence of an analysis implementation |

The specification records observed behavior; the requirements and parity
ledger decide which behaviors are retained or replaced. Candidate delivery
stages and prototype limitations do not constitute target acceptance.

## Implementation Evidence For Comparison

- The builder accepts parcel WKT Polygon/MultiPolygon rings and extracts
  configured APP types through `gml:posList`, normalizing configured XY/YX order
  and filtering by bbox. Exact requests remain in the
  [integration inventory](current-public-integrations.md).
- Rendering uses `geoIdentity` fitted to the bbox; raster files have anonymous
  image content, with extent supplied by the project configuration. The
  runtime loads `d3-geo` from a CDN.
- Browser features are a JSON array under
  `geo-planner:<projectId>:manual-overlays:v1`. Identity resolution prefers
  `properties.id`, normalized name/label, then serialized geometry; a second
  merge pass removes duplicate geometry.
- The wrapper enables file persistence only for HTTP on `127.0.0.1`,
  `localhost`, or `::1`. The browser updates local storage before posting the
  full FeatureCollection to `POST /api/manual-overlays`.
- The editor checks Origin when present, limits bodies to 5 MiB, validates
  collection/feature/geometry kinds, atomically replaces the local file, then
  rebuilds. It does not check CRS, coordinates, polygon validity, or revisions.
- The page polls `/api/build-version` every 1.5 seconds; a newer version causes
  a full reload. Browser poll failures are ignored; server rebuild failure
  returns HTTP 500. Save success and rebuild success are separate boundaries.

## Characterization Targets

The current automated suite covers core configuration, WMS bbox order, selected
WKT/GML parsing, overlay-file initialization, optional snapshot preservation,
the exact configured raster request layers and optionality, the fixed visual
stack, sidebar order, initial-visibility key coverage, and the land-class raster
wiring. It also records that every configured parcel is resolved independently
and that raster width/height remain fixed when the bbox changes. The editor
boundary characterizes acceptance of single and multi geometry types and
rejection of unsupported collection/geometry kinds. Its persistence tests now
cover a Unicode JSON round-trip, atomic replacement, old-file preservation, and
temporary-file cleanup when promotion fails. Selection characterization records
keyboard activation, layer re-enablement, drawing-mode exit, and draft reset.
The server pipeline records validation before write and forced rebuild, and
synthetic project builds record complete descriptor embedding plus a
multi-vertex LineString round-trip. It does not yet characterize:

- drawing completion and minimum-point failures;
- manual identity, merge, deduplication, delete, clear, and export semantics;
- local-storage failure behavior;
- hot-reload state loss and failure visibility.

These gaps identify legacy evidence that may still be required for parity or
cutover. They do not reopen accepted target behavior or make an uncharacterized
prototype accident a product contract.
