# Project And Evidence Preparation

## Scope

The retained legacy application is described below. An operator prepares one configured spatial
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

## Replacement Application: Simulator Slice

The Angular workspace provides a complete fixture journey: search/select ->
area -> preview/name/save -> saved project map. It fills the viewport, keeping
map and primary actions visible. Desktop has a side panel; mobile places a
bounded panel below the map. Result lists and panel contents scroll internally.
The simulator combines frozen public-source samples with named synthetic fault
fixtures and keeps project/idempotency state in memory. Live provider access,
backend persistence and national geographic coverage remain unimplemented or
unverified.

Search advances after an explicit search-result choice or deliberate map-only
entry. Typed text, restored preferences and map navigation alone do not establish
location intent. Returning to area editing permits correction of an existing
invalid rectangle; that rectangle still blocks review and save.

Search is a guided sequence with one active input: **Miejscowość**, optional
**Ulica**, then an explicit choice of **Numer budynku** or **Krótki numer działki**.
Street and number can be skipped. A separate **Mam pełny numer działki** shortcut
looks up a full identity without a locality. There is no smart input-kind
detection or simultaneous multi-field form. Selecting a locality opens street
lookup; selecting a street opens the number choice. Changing an upstream choice
invalidates downstream lookup context, drafts and obsolete requests/cursors.
House numbers require a chosen street; they are not parcel numbers.

Locality/full-identity/number fields use explicit search or Enter. Street lookup
supports a name fragment from three characters after 400 ms. Guidance belongs
to the active input immediately, including before typing. A locality-only query
does not enumerate child streets or addresses. Ambiguous source names show
administrative descriptions for explicit choice. Five-row pages and explicit
**Pokaż więcej** remain bounded within the panel. Source errors and partial
snapshot coverage are distinguished from a reliable empty result.

Stage 1 is navigation and lookup only. Map outlines are read-only, there are no
area-drawing or subject-add/remove controls, and state guards reject those
commands. A found parcel is resolved and framed, not added to the project.
**Pomiń wyszukiwanie — wybiorę na mapie** explicitly opens stage 2 without
creating an area. Otherwise a chosen result establishes location intent.

Short parcel numbers are restricted to the explicitly described visible map
neighbourhood, up to 2 × 2 km. A wide view asks for zoom-in; a locality point is
not its cadastral boundary. Full identities bypass map bounds. The user enters
no coordinates or precinct codes. Choosing a street and then a short parcel
number does not assert that a parcel belongs to that street.

Only stage 2 permits parcel selection/removal, area drawing/resizing, discovery
and explicit fitting. A located parcel has a **Dodaj znalezioną działkę do
projektu** action there. Returning to lookup retains already selected project
subjects and the working area, with read-only display. Existing invalid areas
can return to stage 2 for correction but cannot enter stage 3.

The simulator combines frozen public-source samples for Ciężkowice, Bobowa and
Gromnik, an archived orthophoto/parcel fragment of Ciężkowice, and separately
named synthetic fault cases. These are limited offline samples, not live
national coverage. Actual source IDs, polygons/holes and available source dates
are preserved after CRS normalization. Details and examples belong to the
[fixture catalogue](../architecture/simulator-fixtures.md).
Selection alone creates no working rectangle; only drawing or
**Dopasuj do działek** creates one.

In stage 2, draw an intentional rectangle on the map or explicitly fit selected parcels.
Keyboard-accessible map buttons resize an existing rectangle without coordinate
or dimension entry. An invalid rectangle has a red outline, a persistent error
and a disabled continuation action; navigation guards also reject advancing.
With a chosen location/parcel or an explicit map-only choice, search advances to stage 2
so the user can select subjects, draw or explicitly fit parcels. Dimensions are
read-only on the map. The source geometry of selected parcels remains separate.
Area discovery proposes positive-area intersections for explicit addition;
boundary-only contact is excluded. Existing selected subjects survive edits. Clicking a selected parcel on the
map deselects it; this preserves the current working rectangle.
Loading, unavailable, truncated, empty and failed discovery remain distinguishable.
A separate faint outline layer loads parcel geometries for a settled viewport
up to 2 × 2 km, bounded to 100 records. Wider views request zooming in; viewport
changes cancel obsolete reads. Outlines are indicative and do not select parcels
or alter the project area. Empty, failed, unavailable and incomplete views have
separate messages. The selected-parcel list uses remaining panel space in area
and preview rather than a fixed small height.
**Dopasuj do działek** explicitly fits all selected subjects plus the buffer
(default 100 m, slider 0-500 m). Buffer changes alone preserve the manual area.
An excessive fit keeps the previous area and reports the 2 km bound.

A valid area can be reviewed without selected parcel subjects. The action is
**Podgląd obszaru** in that case and the summary says **Bez wybranych działek**;
this describes user selection, not the absence of parcels in the real world.
Preview validates the exact rectangle/selection and frames the map for review.
The user provides a project name and explicitly saves. The parcel list and map
are read-only in preview, with no removal actions. To change geometry or subjects,
the user returns to editing, which invalidates preview; name changes are independently validated at save. Source,
date, CRS, legend and uncertainty are available through compact details. Saved
projects show a bounded map cutout, title, dimensions and optional source details.
Imagery and parcel rendering are clipped to the saved rectangle. Pan and zoom
stay within that frame; zooming out cannot return to the national map. The
current cutout reloads the available fixture tiles rather than storing an immutable image
snapshot. Persisted source snapshots, layer composition and private planning
drawings are subsequent acquisition/sketch capabilities.

If a create result is unknown, the tab keeps the same command and idempotency
key for explicit retry. Closing the tab or restarting the simulator loses the
corresponding recovery/deduplication state; this is not durable recovery.
Validated interface preferences (search/filter state and buffer) are remembered
locally, independently of projects.

Product screens contain no fixture catalogue or repeated developer instructions.
The simulator development build exposes **Dane testowe** only after confirming
connection; production builds do not probe or expose these facilities. All
current data and representative journeys are in the
[fixture catalogue](../architecture/simulator-fixtures.md).

## Production Integration Limitations

The Angular flow above runs against the offline contract simulator. Live
provider mediation and durable Kotlin project storage remain unimplemented;
their accepted target behaviour is owned by
[PROJECT-001 requirements](../requirements/projects-and-aoi.md#project-001--create-a-project-from-an-interactive-working-area)
and the [integration handoff](../architecture/public-api-integration.md).
Passing fixture tests does not establish national coverage or persistence after
restarting the simulator. The retained legacy workflow is unchanged.

## Evidence

- [Angular workflow state](../../frontend/src/app/features/project-creation/project-creation-state.ts),
  [workflow regressions](../../frontend/src/app/features/project-creation/project-creation-state.spec.ts)
  and [browser journeys](../../frontend/e2e/interactive-project.spec.ts) cover the
  simulator-backed flow. The owner accepted this frontend/simulator result and
  requested plan closure on 2026-11-20; production integration remains separate.
- [Builder](../../mapa/scripts/build_map.py), [refresh implementation](../../mapa/scripts/update_sources.py), and [editor](../../mapa/scripts/edit_map_server.py).
- [Characterization](../../tests/test_build_map.py) and [synthetic project fixtures](../../tests/test_project_fixtures.py) cover deterministic assembly and selected failure paths.
- [Exact integration inventory](../research/current-public-integrations.md) owns protocol requests and dated provider evidence.
- [Legacy architecture](../architecture/legacy-map-build.md) owns technical assembly and reload flow.
