# Map Interface And Local Editor

This directory contains the retained legacy application used until its
capabilities are replaced in the Angular/Kotlin product. It also provides
behavioral and data evidence for migration work.

The application generates `mapa-ciezkowice.html` and `map-fragment.html`. Both
are local, Git-ignored outputs and must not be edited manually. The reusable
interface lives in `map-fragment.template.html`.

## Build And Edit

From this directory:

```bash
./scripts/build-map.sh
./scripts/edit-map.sh
```

The editor prints the URL derived from `project-config.json`, normally
`http://127.0.0.1:8765/mapa-ciezkowice.html`. Use `--port 8877` to select
another port and stop it with `Ctrl+C`.

The loopback editor watches configuration, the template, source data, rasters,
and manual overlays. It rebuilds and reloads the browser after a change.
Completed sketches and deletions are written atomically to the local,
Git-ignored `manual-overlays.json`.

If `manual-overlays.json` does not exist, the first build creates it from the
tracked empty `manual-overlays.example.json`. Initialization never replaces an
existing local file. To reset it, delete the local file deliberately and run
the build again.

When opening generated HTML through `file://`, repository writes are
unavailable. Sketches remain in browser `localStorage`, namespaced by
`projectId`, and can be exported as GeoJSON.

## Interaction

- Mouse wheel: zoom.
- Middle-button drag: pan.
- Left click: select a parcel or sketch, or add a drawing point.
- Right click: browser context menu.
- Drawing modes: point, line, or polygon; finish explicitly except for points.
- Deletion: select the sketch first, then confirm removal.

The selected object receives a stronger outline and its metadata appears in the
side panel. Manual `category`, `status`, and `description` fields remain
optional and are never inferred by the editor.

## Configuration

`project-config.json` contains location and data concerns: identity, output
name, CRS, bbox, WMS axis order, raster dimensions, precinct, parcel list and
metadata, plan source/schema, services, raster paths, and source note.

`map-config.json` contains presentation only:

- parcel and manual label size and visibility;
- label halo width;
- manual overlay stroke and fill values;
- desktop and mobile map height and sidebar width;
- workspace layout and initial layer visibility.

Changing the bbox, CRS, or project location requires refreshing every bound
source and raster, not only rebuilding HTML.

The builder accepts an explicit project-map directory. The focused
`tests.test_project_fixtures` test builds two synthetic project datasets through
the same production template and `build_map.build(map_dir)` entry point without
source-code changes:

- `tests/fixtures/projects/single-xy`: one parcel in EPSG:2180, with XY GML
  coordinates and XY WMS 1.3 bbox serialization;
- `tests/fixtures/projects/multi-yx`: adjacent parcels in EPSG:2178, with YX
  GML coordinates and YX WMS 1.3 bbox serialization.

These directory names are test labels, not product IDs or real locations. The
test proves deterministic legacy assembly for those two configurations. It
does not prove that arbitrary CRS/provider combinations work or that acquisition
is portable. The legacy provider adapters and fixed raster layer catalog remain
specialized, and adding another layer kind still requires legacy interface and
configuration changes.

## Source Refresh

Source refresh is destructive to checked-in snapshots and requires an explicit
owner request. When authorized:

```bash
./scripts/update-sources.sh
./scripts/build-map.sh
```

Refresh uses ULDK, the configured planning GML URL, and configured WMS services.
The KIEG `uzytki,kontury` request supplies the optional map switch labelled
`Użytki i klasy gruntów`; symbols such as `RIIIa`, `ŁIV`, or `PsV` appear only
where the county service publishes them. Refresh is intentionally separate from
build and tests because it accesses the network and replaces snapshots. The
address layer is optional; other failures stop the refresh.

## Verification

From the repository root, prefer the aggregate gate:

```bash
mise run verify
```

For a focused legacy-only check:

```bash
mise run verify-legacy
```

Both use checked-in snapshots and do not refresh external sources.

## Safety Boundary

Government data and utility rasters are informative previews. The land-class
layer does not replace an official EGiB extract. The planning file may be a
draft. Manual roads, pipes, areas, and property notes are indicative sketches.
Use authoritative current documents and professional surveys for legal,
planning, design, and construction decisions.

See the root [repository guide](../docs/guidelines/repository-guide.md) for the
new application toolchain and the
[legacy map model domain](../docs/domain/legacy-map-model.md) for retained spatial
semantics.
