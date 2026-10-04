# Legacy Map Model Domain

## Status And Scope

This document owns the terminology, evidence classes, spatial invariants, and
safety meaning of the retained map workflow. It describes legacy meaning, not
the complete target product model. Runtime, build, parser, and persistence flow
are owned by [Legacy Map Build Architecture](../architecture/legacy-map-build.md).

The Spatial Evidence domain model is defined in
[Spatial Evidence Domain](spatial-evidence.md); accepted behavior is indexed in
the [requirements portfolio](../requirements/index.md).

## Purpose And Safety Boundary

Geo Planner combines selected parcel geometries, planning data, raster previews, and owner-authored sketches in one local interactive map. It supports exploration and communication. It does not replace an extract from the land register, a planning decision, a utility survey, a boundary survey, or legal due diligence.

Every displayed statement has one of three evidence classes:

- source data: downloaded from a named external service on a known date;
- project metadata: an owner-supplied classification or note in `project-config.json`;
- manual overlay: an indicative geometry drawn or imported by the user.

The interface must not blur these classes. Unverified ownership, access, utility, or development claims remain qualified in their status or description.

## Legacy Project Identity And Spatial Contract

`mapa/project-config.json` is the single source of legacy project identity and
spatial meaning:

- `projectId` is a stable lowercase identifier and namespaces browser storage;
- `title`, `description`, `locale`, and `sourceNote` define project-facing text;
- `crs`, `bbox`, `wms130AxisOrder`, and `rasterSize` define the spatial frame;
- `precinctId` and `parcels` define ULDK requests and parcel metadata;
- `plan` identifies the GML file, schema namespace, source date, and coordinate order.

`mapa/map-config.json` owns presentation only. It must not contain the bbox, CRS, parcel identity, source URLs, or facts about a property.

## Spatial Invariants

- Coordinates embedded in the current map, source parcel files, manual overlays, and raster footprint must use the configured CRS.
- `bbox` uses `[minX, minY, maxX, maxY]` regardless of WMS axis order.
- `wms130AxisOrder` controls request serialization, not the internal coordinate model.
- Source coordinate order is explicit; normalized planning coordinates use
  `[x, y]`.
- Raster files do not carry georeferencing in the HTML. Each is stretched over the configured bbox and must be refreshed after bbox or CRS changes.
- Parcel numbers and source filenames are unique inside one project.
- A new `projectId` must be used for a spatially distinct project to prevent browser sketch leakage.

## Evidence And User Data Meaning

`sources/` and `assets/` are external-evidence snapshots, not disposable build
output. Their source identity and observation date qualify any interpretation.

`manual-overlays.json` and project-namespaced browser sketches are private local
user data. They are not fixtures, source evidence, or generated artifacts and
must not be replaced by initialization or ordinary verification.

Generated HTML is a derived delivery artifact. It may contain embedded evidence
and private notes, so it is not an authoritative data owner and is never tracked.

## Supported Geometry

Legacy parcel evidence supports Polygon and MultiPolygon geometry, including
multiple rings. The displayed model supports Point, LineString, Polygon, and
their Multi variants; interactive sketches use the three single-geometry types.

Planning evidence distinguishes `StrefaPlanistyczna` and
`ObszarUzupelnieniaZabudowy`. Complex GML holes and multi-surface semantics
remain uncertain and require visual confirmation against the authoritative
source.

## Layer Semantics

- parcels: selected or contextual cadastral geometry from ULDK;
- zones and OUZ: planning proposal geometry from the configured GML snapshot;
- ortho: aerial imagery preview;
- EGiB: building and parcel-number raster preview;
- land classes: KIEG raster preview of land-use contours and soil
  classification contours, including markings such as `RIIIa`, `ŁIV`, `PsV`,
  or non-agricultural land-use symbols where published by the county;
- addresses: optional street/address raster preview;
- power, water, sewer: indicative utility raster previews;
- manual: user-authored points, lines, and areas with optional status and description.

Candidate layers and their evidence/sourcing risks are evaluated in
[Candidate Map Layers](../research/additional-map-layers.md).

The land-class raster supports visual screening only. County KIEG coverage may
be missing, incomplete, or differently current, and the displayed marking does
not replace an official EGiB extract or competent cadastral interpretation.
