# Project And Evidence Preparation

## Scope

Current retained legacy application. An operator prepares one configured spatial
subject for a map user. There is no project creation, project switcher, parcel
lookup form, or source-refresh action in the browser. Replacement project and
acquisition expectations belong to [requirements](../requirements/index.md).

## Prepare And Open A Project

1. The operator supplies project identity, title, description, locale, source
   note, parcel identifiers and metadata, planning source, and the spatial
   frame through project configuration.
2. A build combines the configured project with available evidence snapshots
   and local overlays into a standalone map and an embeddable fragment.
3. The user opens the standalone map directly or through the local editor.
   The workspace presents the configured title, description, map, parcel list,
   drawing controls, and source/uncertainty text.

The subject and context parcels are configured in advance. Bbox, CRS, raster
size, and coordinate order are operator inputs; there is no automatic buffered
AOI calculation. Changing the location, bbox, or CRS requires refreshing all
bound sources and rasters. A spatially distinct project needs a distinct ID to
keep browser sketches separate, as defined by the
[legacy spatial contract](../domain/legacy-map-model.md#spatial-invariants).

Building uses existing snapshots and never refreshes external data. An absent
local overlay file is initialized once from the empty tracked example; existing
private data is preserved. Generated maps may include private notes.

## Explicit Evidence Refresh

Refresh is a separate operator action with external access and replacement of
snapshots. Operational commands and authorization are in
[legacy operation](../../mapa/README.md#source-refresh).

| Evidence | Result used by the map | Refresh failure |
| --- | --- | --- |
| Configured planning document | Planning zones and OUZ | Stop refresh; preserve the failed target's previous file |
| Each configured parcel | Parcel geometry and identity resolved independently through ULDK | Stop refresh; preserve the failed target's previous file |
| Ortho, EGiB buildings/numbers, land classes, electricity, water, sewer | Separate raster snapshots for the configured spatial frame | Stop refresh; preserve the failed target's previous file |
| Addresses, streets, places | Optional orientation raster | Warn, keep the previous snapshot, and continue |

Successful downloads replace files individually. A later required failure does
not roll back earlier successful replacements, so a partially refreshed set can
remain. There is no aggregate progress view, cancellation workflow, structured
acquisition record, response-content validation, or per-layer freshness status.
A land-class download is required by the refresh code even though its map
control is hidden if the file is absent.

## Failure And Availability

Invalid project configuration, missing parcel or plan input, parcel-number
mismatch, unsupported parcel WKT, malformed planning GML, or a missing template
marker stops the build with an operator-facing error. There is no in-page
recovery. Missing raster files can still produce a map; their viewing behavior
is described in [Map and layer viewing](map-and-layers.md).

The editor rebuilds and reloads an open page when inputs change. Reload discards
transient navigation and unfinished drafts. A failed rebuild or reload poll
leaves the current browser page without a dedicated warning.

## Planned Change (Draft)

The approved PROJECT-001 replacement scope is not yet implemented; the legacy
workflow above remains unchanged. Product behavior and limits are owned by
[PROJECT-001](../requirements/projects-and-aoi.md#project-001--create-a-project-from-an-interactive-working-area).
The application API proposal still requires owner review before frontend client
generation or production provider calls.

A user can pan and zoom an interactive map across Poland and search for a
voivodeship, locality, street, or parcel number. Search results are typed and
ambiguous matches require an explicit choice. Parcels can also be selected by
clicking the map or entering an identifier. A project may be created without any
selected parcel.

An unambiguous parcel can suggest an initial rectangular working area with
100 m of context. The user can draw an area anywhere and resize it by dragging
edges or corners or through an accessible alternative. Later parcel selection
does not silently replace a manually edited rectangle. Parcel boundaries stay
unchanged; the working rectangle may cover only part of a selected parcel, and
the preview warns when selected geometry extends outside it.

The backend mediates raster map tiles through configured sources; the browser
does not access providers directly or submit arbitrary URLs. The provider and
full coverage for map scales and place-search types are not yet selected. The
preview includes the rectangle, optional parcel geometries, CRS, source,
observation date, attribution, warnings, and uncertainty. This is indicative
spatial evidence, not a legal, cadastral, or surveying determination.

The project permits zero to 100 parcel identifiers. The parcel-subject envelope
when present and the working rectangle are each limited to 2 km width, 2 km
height, and 4 km²; incomplete, ambiguous, invalid, stale, or excessive inputs
cannot create a project. Changing selection or rectangle invalidates the preview.
Before create, the backend validates the exact rectangle and re-resolves selected
parcels, and saves only a complete result matching the preview. Reopening by a
stable address after backend restart restores the area, selected parcel data,
CRS, and relevant provenance. No partial project is reported as successful.

## Evidence

- [Builder](../../mapa/scripts/build_map.py), [refresh implementation](../../mapa/scripts/update_sources.py), and [editor](../../mapa/scripts/edit_map_server.py).
- [Characterization](../../tests/test_build_map.py) and [synthetic project fixtures](../../tests/test_project_fixtures.py) cover deterministic assembly and selected failure paths.
- [Exact integration inventory](../research/current-public-integrations.md) owns protocol requests and dated provider evidence.
- [Legacy architecture](../architecture/legacy-map-build.md) owns technical assembly and reload flow.
