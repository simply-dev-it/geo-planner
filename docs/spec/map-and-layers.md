# Map And Layer Viewing

## Scope

Current retained legacy application: visual comparison of one configured area.
The map and sidebar share a responsive workspace. On desktop both fit within
the viewport and the sidebar scrolls independently; below 760 px they return
to normal document flow. Presentation settings control sizes and labels.

## Layers And Defaults

The configured defaults below apply on every reload. Visibility changes are
transient. Each available layer has an independent switch.

| Layer / Polish control | User-visible content and interaction | Initial visibility |
| --- | --- | --- |
| Ortho / `Ortofotomapa` | Aerial imagery background; visibility only | On |
| Parcels / `Działki analizowane` | Subject and context geometry; select from map/list and non-context labels | On |
| EGiB / `Budynki i numery EGiB` | Raster building outlines and parcel numbers; visibility only | On |
| Land classes / `Użytki i klasy gruntów` | Published land-use and soil-class markings; visibility only | Off |
| Planning / `Strefy planu ogólnego` | Configured APP planning zones, styled by symbol; visibility only | On |
| `OUZ` | Configured infill-development areas; visibility only | Off |
| Addresses / `Nazwy ulic i adresy GUGiK` | Street, place, and address labels; visibility only | Off |
| Power / `Sieć elektroenergetyczna` | Indicative electricity network raster; visibility only | Off |
| Water / `Wodociąg` | Indicative water network raster; visibility only | Off |
| Sewer / `Kanalizacja` | Indicative sewer network raster; visibility only | Off |
| Manual / `Ręczne szkice` | User points, paths, and areas; see [Sketches](sketches.md) | On |

The bottom-to-top order is fixed: ortho → planning zones → OUZ → EGiB → land
classes → addresses → power → water → sewer → parcels → sketches → drawing
preview → parcel labels. Sidebar order differs. Users cannot reorder layers or
change opacity. Ortho is the only background; OpenStreetMap, terrain relief,
and planning WMS imagery are not displayed.

Land-class and address controls are hidden when their raster is absent. Other
missing rasters produce no imagery and no explicit warning. There is no
per-layer loading, no-coverage, stale, or failure indicator. An absent planning
feature does not distinguish no coverage from missing type or parser omission.

## Navigate And Select

- `+`, `-`, and Reset control map zoom and position; zoom is limited to 1–8.
- The mouse wheel zooms around the pointer; middle-button drag pans.
  Right click keeps the browser context menu.
- Parcel geometry, label, and list select the same parcel with visual emphasis.
  Map parcel and sketch targets are focusable and activate with Enter or Space.
- Selecting a parcel or sketch re-enables its hidden layer. Selection and
  visibility survive ordinary map navigation.
- Selecting an item from either list exits drawing mode and discards the draft.
- Zoom, pan, selection, and visibility choices do not persist across reload.
  There are no application-wide shortcuts for drawing, finishing, undo,
  deletion, zoom, or reset.

Parcel details show its number, configured status, optional configured area,
and configured planning-zone percentages. Context parcels have limited details
and no ordinary parcel labels. Area and percentages are owner metadata, not
calculated intersections; the current UI does not qualify them individually as
source versus user input.

Planning zones and OUZ can be displayed but not selected for attribute
inspection. The map does not expose per-feature planning document status/date,
geometry confidence, parse omissions, or uncovered areas.

## Interpretation And Failure Limits

Rasters support visual screening. They have no feature query, legend, individual
acquisition manifest, per-control date/attribution, or proof of continued
alignment after a configuration change. Pixels do not identify a building,
land class, address, or utility record. Land-class coverage varies and markings
such as `RIIIa`, `ŁIV`, or `PsV` do not replace an official EGiB extract.

Planning GML display may flatten complex holes or multi-surface geometry;
comparison with the authoritative document is needed. Planning previews do not
determine building rights, and utility rasters do not establish network
completeness or survey-grade position. Full safety meaning belongs to the
[legacy domain](../domain/legacy-map-model.md).

If the external geometry runtime cannot load, interactive geometry and related
controls do not initialize and no dedicated offline explanation appears.

## Evidence

[Interface](../../mapa/map-fragment.template.html),
[presentation configuration](../../mapa/map-config.json),
[builder](../../mapa/scripts/build_map.py), and
[characterization tests](../../tests/test_build_map.py).
[Migration evidence](../research/prototype-behavior-inventory.md) records the
limits of automated coverage; replacement expectations remain in
[layer requirements](../requirements/layer-viewing.md).
