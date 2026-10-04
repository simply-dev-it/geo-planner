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
  [parity ledger](prototype-migration-parity-ledger.md); current legacy runtime
  flow is owned by [Map Build Flow](../architecture/legacy-map-build.md).
- Remaining use: compare each replacement capability against observed legacy
  success, degraded, failure, interaction, persistence, and spatial behavior.
- Return when: implementing a corresponding capability, changing legacy
  behavior or characterization tests, advancing a parity row, or proposing
  legacy cutover.

This is migration evidence, not a requirement that every prototype behavior be
retained. Requirements and the parity ledger identify accepted replacements
and explicitly discarded constraints.

## User-visible Surface

The prototype has one responsive workspace with an SVG map and a sidebar. The
standalone desktop layout keeps the map and independently scrollable sidebar
within the viewport; below 760 px they return to normal document flow.

The map renders:

- configured raster snapshots stretched over the project bbox;
- selected APP planning zones and OUZ geometry;
- focus and contextual parcel geometry;
- parcel labels for non-context parcels;
- repository and browser-local manual features;
- an in-progress drawing preview.

The sidebar provides:

- switches for ortho, parcels, EGiB buildings/numbers, land classes, planning
  zones, OUZ, addresses, power, water, sewer, and manual sketches;
- parcel and manual-feature selectors;
- details for the selected parcel or sketch;
- drawing mode and name controls;
- finish, undo point, undo last feature, delete selected, clear all, and GeoJSON
  export actions;
- project source and uncertainty text.

Initial visibility comes from `map-config.json`. A raster option marked with
`data-raster-option` is hidden when the corresponding file was not embedded.
During the observed run the optional addresses control was absent because its
raster snapshot was unavailable.

## Capability Trace

| Capability | User value and visible result | Inputs and implementation path | Degraded or unresolved behavior | Candidate stage |
| --- | --- | --- | --- | --- |
| Open a project map | Review one configured area with its title, description, evidence layers, and source warning in one workspace. | Project and presentation JSON, checked-in snapshots, optional private overlays, Python build, generated HTML, runtime `d3-geo`. | A build error prevents opening; a CDN failure leaves the interactive geometry runtime uninitialized without a dedicated explanation. | `MVP` |
| Compare source layers | Turn each supported layer on or off to visually compare the same bbox. The switches retain no state after reload. | Fixed HTML controls, `map-config.json` initial booleans, fixed SVG group order, embedded vector/raster data. | Missing rasters are empty; only controls explicitly marked as optional are hidden. There is no per-layer loading, stale, error, date, or coverage status. | `MVP` |
| Navigate the map | Zoom around a location, pan, and reset the view while preserving current selection and layer visibility. | Browser-local SVG transform over one bbox-fitted `geoIdentity` projection. | Pan is middle-button only; zoom/pan state is lost on reload; extent and rotation are not constrained beyond zoom 1–8. | `MVP` |
| Inspect a parcel | Select a parcel from geometry, label, or list and see its number, owner-supplied status, optional area, and owner-supplied zone percentages. | ULDK WKT geometry plus parcel entries in `project-config.json`; builder emits GeoJSON-like features; browser renders and formats metadata. | Context parcels have limited details. Area and zone percentages may be absent and are not calculated or source-qualified in the UI. | `MVP` |
| Read planning zones | See configured `StrefaPlanistyczna` and OUZ polygons over other evidence. Zone symbols affect styling; OUZ is one visual category. | One configured APP GML snapshot; Python extracts `gml:posList`, normalizes pair order, bbox-filters features, and embeds MultiPolygons. | The UI does not expose feature attributes, document status/date per selection, holes/multi-surface confidence, uncovered areas, or parse omissions. | `MVP` |
| Read raster evidence | Visually screen imagery, cadastral, address, land-class, and utility snapshots against parcels and planning vectors. | Fixed WMS downloads saved as anonymous image files and stretched over the configured bbox at build time. | There is no feature query, legend, opacity control, acquisition manifest, per-layer attribution/date, pixel-to-category interpretation, or proof that a raster still matches the bbox/CRS. | `MVP` |
| Select a sketch | Highlight a manual point, path, or area and view its name, category, geometry type, optional status, and description. | Embedded ignored GeoJSON-like data merged with project-namespaced browser storage; SVG hit paths, labels, and list selection. | Selection does not expose coordinates, measurements, source of persistence, editability, or conflicts. | `STAGE-2` |
| Create a sketch | Record an indicative point, path, or area with a name for local comparison and communication. | Explicit mode, map clicks inverted through the current transform/projection, in-memory draft, generated ID, local storage, and optional loopback file save. | The mode must be chosen before drawing. There is no snapping, vertex editing, metadata form beyond name, validity check, import, or clear distinction between open/closed intent while drawing. | `STAGE-2` |
| Manage and export sketches | Undo draft work, remove selected/recent/all editable sketches, and download the merged collection. | Separate draft and feature actions, identity-based merge/deduplication, confirmation dialogs, JSON Blob download. | “Last” refers to editable-list order, not necessarily visual creation order. Direct-file mode cannot delete embedded features. Export has no import counterpart or explicit CRS/provenance envelope. | `STAGE-2` |
| Persist through the local editor | Keep completed sketch changes in the ignored project file and see the rebuilt page reload. | Loopback POST of the full collection, shape/type validation, atomic replace, rebuild, and 1.5-second version polling. | Save is whole-collection replacement with no version precondition. Browser storage is updated before server success. Reload loses transient view/draft state; poll failures are silent. | `STAGE-2` |
| Refresh project sources | Replace parcel, planning, and raster snapshots for the configured bbox through an explicit operator action. | Sequential CLI downloads to temporary files, then atomic promotion; hard-coded ULDK/WMS request families and layer names. | No UI, progress model, manifest, response validation beyond `curl`, transaction across layers, rollback of earlier successful layers, or structured partial result. | `MVP` backend dependency |
| Analyze a sketch | Compare a user area with planning and cadastral classifications and report measured intersections. | Not implemented. Current parcel percentages are manually configured and KIEG land classes are raster-only. | Requires accepted vector sources, geometry/precision contracts, uncovered-area behavior, provenance, and legal-safety wording. | `STAGE-3` |

## Layer Inventory

The renderer uses a fixed bottom-to-top SVG order:
ortho → planning zones → OUZ → EGiB buildings/numbers → land classes →
addresses → power → water → sewer → parcels → manual sketches → current draft
→ parcel labels. The sidebar order differs, and users cannot reorder layers or
change opacity.

| Layer | User-facing purpose | Source and representation | Current interaction and default | Availability, safety, and migration question |
| --- | --- | --- | --- | --- |
| Ortho | Recognize terrain, buildings, roads, vegetation, and spatial context. | GUGiK ORTO WMS `Raster`; required opaque JPEG snapshot over the project bbox. | Visibility only; on by default; bottom visual layer. | Preview without per-layer date/attribution in the control. MVP needs explicit acquisition identity and stale/coverage behavior. |
| Parcels | Locate analyzed and contextual cadastral parcels and select one for details. | ULDK `GetParcelByIdOrNr` WKT parsed to Polygon/MultiPolygon; owner metadata is added from project config. | Visibility and selection; on by default; non-context labels shown; selected parcel receives emphasis. | Geometry is source evidence, while status/area/zone percentages may be owner metadata. MVP must keep those evidence classes distinct. |
| EGiB buildings and parcel numbers | Compare cadastral building outlines and parcel-number labels with other layers. | KIEG WMS `budynki,numery_dzialek`; required transparent PNG snapshot. | Visibility only; on by default. | Raster cannot expose a selected building or authoritative record. Exact layer identity, coverage, date, and preview-only warning belong in MVP. |
| Land use and soil classes | Visually screen published land-use and classification symbols. | KIEG WMS `uzytki,kontury`; required transparent PNG snapshot in current refresh code. | Visibility only; off by default; control hidden if file is absent. | County coverage varies and raster pixels cannot support authoritative intersection percentages. Decide whether absence is optional despite the current required download. |
| Planning zones | Compare parcels and intended uses with the configured general-plan zones. | APP GML `StrefaPlanistyczna`; embedded vector MultiPolygons with symbol/designation properties. | Visibility only; on by default; symbol controls CSS category. | The user cannot inspect zone properties or source status/date. Geometry extraction may flatten complex surfaces. MVP needs explicit document identity and feature inspection. |
| OUZ | See whether places fall within the configured area of infill development. | APP GML `ObszarUzupelnieniaZabudowy`; embedded vector MultiPolygons. | Visibility only; off by default. | Display does not distinguish empty, absent, outside bbox, or parse failure. MVP needs a visible meaning/status contract. |
| Addresses | Orient using street, place, and address labels. | KINA WMS 1.1.1 `prg-adresy,prg-ulice,prg-place`; optional transparent PNG snapshot. | Visibility only; off by default; control hidden when missing. | Only current explicitly optional download. Hidden absence gives the user no reason or last-known status. |
| Power | Screen the indicative electricity network against the area. | KIUT/GESUT WMS `przewod_elektroenergetyczny`; required transparent PNG snapshot. | Visibility only; off by default. | No legend, voltage/type attributes, query, completeness statement, or individual provenance. Preview must not imply survey-grade position. |
| Water | Screen the indicative water network against the area. | KIUT/GESUT WMS `przewod_wodociagowy`; required transparent PNG snapshot. | Visibility only; off by default. | Same limitations as power; absence and no-data are not distinguished. |
| Sewer | Screen the indicative sewer network against the area. | KIUT/GESUT WMS `przewod_kanalizacyjny`; required transparent PNG snapshot. | Visibility only; off by default. | Same limitations as power; absence and no-data are not distinguished. |
| Manual sketches | Record and revisit indicative user-authored points, paths, and areas. | Ignored GeoJSON-like file plus project-namespaced browser storage; vector display. | Visibility, selection, creation, deletion, clearing, and export; on by default. | Private user evidence, not source data. Deferred to `STAGE-2`; migration must preserve identity, CRS, privacy, and failure behavior intentionally. |
| Current draft | Preview vertices during one drawing action. | Transient browser memory only. | Always rendered while drawing; no layer switch. | Lost on mode change, selection, reload, or navigation away without warning. |

The current application does not render OpenStreetMap, terrain relief, a plan
WMS image, or a generic basemap beyond the embedded ortho snapshot. References
to those as current layers would be inaccurate unless new implementation
evidence is added.

## Map Navigation And Selection

- `+`, `-`, and Reset buttons control a transform limited to zoom levels 1–8.
- The mouse wheel zooms around the pointer.
- Middle-button drag pans the SVG; the browser context menu remains available
  on right click.
- A parcel can be selected from the map, its label, or the parcel list.
- A manual feature can be selected from its hit area, label, or the manual list.
- Map parcel/manual targets are keyboard-focusable and activate with Enter or
  Space.
- Selecting a hidden parcel or manual layer turns that layer back on.
- Selecting from either list exits drawing mode and discards the unfinished
  in-memory draft.
- There are no application-wide keyboard shortcuts for drawing, finishing,
  undoing, deleting, zooming, or resetting.

Parcel details show configured status, optional owner-supplied area, and
owner-supplied zone percentages. These percentages are metadata, not calculated
spatial intersections. Manual details show its name/label, category, geometry
type, optional status, and optional description.

## Drawing And Editing

The drawing modes create Point, LineString, or Polygon features in the
configured project CRS. A point completes after one click. A LineString accepts
two or more vertices so it can represent a bent road or pipe; adding a third
vertex does not make it a polygon. A Polygon is a separate mode, accepts three
or more user vertices, and is automatically closed only when Finish is chosen.
Finishing assigns a generated ID, the entered name or `Szkic`, and category
`manual`.

This is geometrically coherent but interactionally under-specified. The user
must choose semantic intent before drawing, the preview does not explain
open-versus-closed geometry, a visually closed LineString is never converted,
and an unfinished Polygon can resemble a path until completion. The accepted
replacement retains multi-vertex lines with explicit geometry intent and
finish/cancel/undo behavior; the prototype interaction is evidence, not the
target contract.

Undo point affects only the current draft. Undo last feature removes the last
entry from the editable local list, which is not necessarily the last feature
visible after repository/local merging. Delete selected and clear all require
browser confirmation. The interface does not edit an existing feature's
geometry or metadata and does not import GeoJSON.

Manual-feature identity is derived in this order:

1. `properties.id`;
2. normalized `properties.name` or `properties.label`;
3. serialized geometry.

A local feature replaces an embedded feature with the same identity. A second
deduplication pass collapses identical serialized geometries. The accepted
replacement uses backend-assigned immutable identity and permits geometric
duplicates, so this merge rule remains legacy evidence rather than a target
contract.

## Persistence And Export

### Generated file opened directly

Browser-local features are stored as a JSON array under
`geo-planner:<projectId>:manual-overlays:v1`. Invalid stored JSON is silently
treated as an empty list. Embedded repository features and browser-local
features are merged for display and export.

An embedded-only feature cannot be deleted in this mode. The UI instructs the
user to run the repository editor. Clear all removes only browser-local
features. Export downloads the merged collection as `manual-overlays.json`;
there is no import counterpart.

### Loopback editor

The standalone wrapper enables repository persistence only for HTTP on
`127.0.0.1`, `localhost`, or `::1`. On initialization it treats the merged
manual collection as the editable list in memory. Each completed delete, clear,
undo-last, or drawing action:

1. updates browser local storage;
2. sends the entire merged FeatureCollection to
   `POST /api/manual-overlays`;
3. writes a temporary file and atomically replaces the ignored
   `manual-overlays.json`;
4. rebuilds generated HTML.

The server accepts at most 5 MiB, permits only GeoJSON FeatureCollections, and
allows Point, LineString, Polygon, and their Multi variants. It checks the
request Origin when one is present. It does not validate coordinate shape,
numeric values, project CRS, feature properties, or polygon validity.

If the local file is missing, a build initializes it once from the tracked
empty example without replacing a concurrently or previously created file.

## Build, Refresh, And Reload

`build_map.py` is an offline assembly step. It validates project identity,
safe filenames, bbox order, axis settings, required source descriptors, and
raster dimensions; parses checked-in ULDK WKT and selected APP GML; embeds
available rasters and manual data; and writes two ignored HTML outputs.

There is no source-refresh action in the browser. `update_sources.py` is a
separate explicit network workflow that:

- downloads the planning document;
- resolves each configured parcel through ULDK;
- downloads configured WMS rasters;
- atomically promotes each successful temporary download.

An address-layer failure is optional: the updater prints a warning and keeps
the previous snapshot. Every other download failure stops the refresh and also
preserves the previous file for the failed request. The workflow is sequential,
has no aggregate progress model, and does not record a structured acquisition
manifest.

The loopback page polls `/api/build-version` every 1.5 seconds. A newer build
reloads the whole page. Polling and build-version failures are silently ignored
by the browser; server-side build failures return HTTP 500 but are not surfaced
in the page.

## Failure And Degraded Behavior

| Condition | Observable behavior |
| --- | --- |
| Invalid project config, missing parcel, missing plan, parcel-number mismatch, unsupported WKT, malformed GML, or missing template marker | Build stops with a contextual Python error; no in-page recovery exists. |
| Missing raster file | Build embeds an empty value. Optional raster controls are hidden when marked as optional; other missing raster layers have no explicit user warning. |
| `d3-geo` CDN unavailable | The module script cannot initialize, so geometry and controls depending on it do not start; no dedicated offline message exists. |
| Invalid browser-local JSON | Stored sketches are silently treated as absent. |
| Too few drawing points | Draft remains and the sidebar reports the required minimum. |
| No editable or selected feature for a destructive action | Nothing is removed and the sidebar explains why. |
| Repository save failure after a local edit | Browser-local state remains and the sidebar reports that file persistence failed. |
| Hot-reload polling or rebuild failure | The current page remains; the browser shows no warning. |
| Optional address refresh failure | CLI warning; last usable snapshot is retained. |
| Required source refresh failure | CLI exits unsuccessfully; the failed target is not promoted. |

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
