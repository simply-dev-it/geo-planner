# Current Public Integrations

## Status And Decision Trace

- Status: ACTIVE
- Evidence checked: 2026-11-17 against the checked-in prototype and official
  GUGiK documentation for ULDK, UUG/OpenLS, and WMS/WMTS; no live-service
  validation was performed.
- Question: which specific allowlisted map layer and provider operations can
  satisfy interactive Poland-wide navigation and typed place/parcel search,
  with acceptable coverage, source terms, coordinate systems, and limits?
- Completed outputs: [ACQUIRE-001](../requirements/layer-acquisition.md) owns
  safe acquisition, [LAYER-004](../requirements/layer-viewing.md) owns raster
  interpretation, and
  [acquisition flow](../architecture/acquisition-and-artifact.md) owns
  provider-adapter and catalog boundaries. This document now records a dated,
  documentation-only check for the interactive map and search candidates below.
- Remaining work: identify exact current layer/service endpoints and capabilities;
  validate live CRS/tile-matrix mapping, license, attribution, coverage, cache
  terms, provider limits, failure behavior, and search query/response semantics.
- Return before: making a live probe or implementing any real map, place-search,
  or ULDK provider adapter.

The legacy request inventory below describes what the prototype requests, not
what a current public service guarantees. Documentation evidence below is
separate from live-service validation and must not be used to claim availability.

## Integrations Used by the Prototype

| Capability | Public system | Protocol or format | Current prototype use |
| --- | --- | --- | --- |
| Parcel lookup | GUGiK ULDK | HTTP query returning WKT | Resolve parcel geometry from cadastral identifiers |
| Orthophoto | GUGiK national geoportal | WMS `GetMap` | Download a raster for the configured bbox and CRS |
| Buildings and parcel numbers | GUGiK KIEG | WMS `GetMap` layers `budynki,numery_dzialek` | Download an indicative transparent cadastral reference raster |
| Land use and soil classification | GUGiK KIEG | WMS `GetMap` layers `uzytki,kontury` | Download an indicative transparent raster with cadastral land-use and classification markings |
| Addresses, streets, and places | GUGiK KINA | WMS `GetMap` layers `prg-adresy,prg-ulice,prg-place` | Optionally download an orientation-label raster |
| Utility networks | GUGiK KIUT/GESUT | WMS `GetMap` for electricity, water, and sewer conduit layers | Download three indicative transparent utility rasters |
| Local planning data | Configured public BIP file endpoint | APP 2.0 GML/XML document | Download one document and extract selected planning-zone and OUZ geometry |

The checked-in prototype does not require an account or application token for
these reads. Public accessibility does not remove licensing, attribution,
availability, fair-use, or rate-limit obligations.

## Exact Request Inventory

| Artifact | Endpoint/config key | Operation and request inputs | Expected response | Current failure policy |
| --- | --- | --- | --- | --- |
| Parcel WKT files | `services.uldk` | HTTP GET `GetParcelByIdOrNr`; `id=<precinctId>.<parcel.number>`; `result=geom_wkt,teryt,parcel`; `srid` derived from project CRS | Text containing geometry and parcel identity | Required; a failed request stops refresh and the temporary file is discarded |
| Planning GML | `plan.url` | Direct HTTPS download with no query contract in the prototype | Configured APP namespace GML/XML document | Required; a failed request stops refresh |
| Ortho JPEG | `services.ortho` | WMS 1.3.0 `GetMap`; layer `Raster`; empty style; configured CRS, axis-ordered bbox, width, and height; `image/jpeg`; opaque | JPEG raster | Required |
| EGiB reference PNG | `services.egib` | WMS 1.3.0 `GetMap`; layers `budynki,numery_dzialek`; configured spatial inputs; `image/png`; transparent | PNG raster | Required |
| Land-class PNG | `services.egib` | WMS 1.3.0 `GetMap`; layers `uzytki,kontury`; configured spatial inputs; `image/png`; transparent | PNG raster | Required by current code, despite variable county coverage |
| Address PNG | `services.addresses` | WMS 1.1.1 `GetMap`; layers `prg-adresy,prg-ulice,prg-place`; `SRS`, bbox in internal xy order, width, and height; `image/png`; transparent | PNG raster | Optional; warn, retain the previous snapshot, and continue |
| Power PNG | `services.utilities` | WMS 1.3.0 `GetMap`; layer `przewod_elektroenergetyczny`; configured spatial inputs | PNG raster | Required |
| Water PNG | `services.utilities` | WMS 1.3.0 `GetMap`; layer `przewod_wodociagowy`; configured spatial inputs | PNG raster | Required |
| Sewer PNG | `services.utilities` | WMS 1.3.0 `GetMap`; layer `przewod_kanalizacyjny`; configured spatial inputs | PNG raster | Required |

All downloads use `curl` redirects, bounded retry counts, temporary files, and
per-file atomic promotion. The prototype does not request capabilities, validate
response MIME/signatures or OGC exception bodies, capture HTTP/provider
metadata, checksum artifacts, or create a structured acquisition record.

## ULDK Operation Documentation Check (2026-11-17)

The official [ULDK operation description](https://uldk.gugik.gov.pl/opis.html)
documents `GetParcelByIdOrNr` as an HTTP GET operation with an `id`, requested
`result` fields, and optional `srid` (whose documented default is `EPSG:2180`).
The legacy request asks for `geom_wkt,teryt,parcel`; the documented response
starts with a result count and then returns requested parcel records. The
operation accepts parcel identifiers as well as parcel-number lookup forms;
precinct/name-based lookup can be ambiguous and must not be used as evidence
that a full identifier resolved uniquely. The documentation check did not send
a live request, validate current response bytes, or verify current service
availability, license, attribution, rate limits, or CRS axis behavior.

For project creation, this source operation is an adapter input, not a suitable
product API contract by itself. A backend-facing contract should expose typed
preview/create/read semantics, explicit CRS and coordinate order, provenance,
structured partial/error results, and revalidation behavior without accepting
arbitrary provider URLs or leaking raw provider query syntax to Angular.

## Interactive Map And Search Documentation Check (2026-11-17)

### Map imagery

GUGiK's official [WMS/WMTS service catalogue](https://www.geoportal.gov.pl/pl/usluga/uslugi-przegladania-wms-i-wmts)
lists browsing services for several national map products. Its description says
WMTS serves pre-generated raster tiles, while WMS generates an image for each
request. This supports evaluating WMTS for backend-mediated tiles but does not
identify a selected layer or prove a normalized web tile grid, CRS, full Poland
coverage, terms, attribution, or cache policy.

The official [BDOT10k service guide](https://www.geoportal.gov.pl/en/data/topographic-objects-database-bdot10k)
states that its WMTS is available from scale 1:50,000 to 1:1,000 and recommends
WMS outside that range. Therefore this candidate alone does not establish a
continuous national-to-parcel-scale basemap. Other catalogued products or
multiple scale-banded layers may be evaluated, but a specific source remains
unselected. These are documentation findings only; no capabilities document,
tile, or WMS request was fetched or tested.

### Place and parcel search

GUGiK's official [UUG service page](https://services.gugik.gov.pl/uug) describes
the Universal Geocoding Service as locating point addresses, streets,
localities, and kilometre posts. The official
[OpenLS service page](https://www.geoportal.gov.pl/pl/usluga/usluga-openls)
describes the GUGiK profile as locating an address point and returning its
address-register identity. This is relevant to address, street, and locality
search, but does not document a voivodeship-name search, guarantee arbitrary
free-text/autocomplete behavior, or prove current query syntax, response shape,
limits, terms, or availability. The actual UUG parameter document and response
have not been independently validated in this check.

The official [ULDK operation documentation](https://uldk.gugik.gov.pl/opis.html)
lists parcel lookup by point (`GetParcelByXY`) and by full identifier or
precinct-name plus parcel number (`GetParcelByIdOrNr`), with default geometry
projection `EPSG:2180`. It explicitly warns that precinct-name plus parcel
number can return multiple parcels. It also lists lookups for voivodeship,
county, commune, and region by identifiers or coordinates; that is not evidence
of free-text place-name search by voivodeship. Full parcel identity, candidate
disambiguation, and point-to-parcel resolution belong behind the application
backend rather than exposing ULDK query syntax to Angular.

### Product boundary and remaining unknowns

The owner chose backend-mediated tiles; this is a product boundary, not a
selection of GUGiK or another provider. A proposed product API uses server-owned
layer IDs and synthetic examples only. Before a production adapter, confirm
exact map endpoints, tile matrices/projections and scale
coverage, provider terms and attribution, cache/rate limits, and UUG/ULDK
request/response behavior. Do not copy upstream URLs from public pages into
client input or allow arbitrary proxy URLs.

## Evidence in the Repository

- `mapa/scripts/update_sources.py` contains ULDK and WMS request construction.
- `mapa/project-config.json` records services, layers, CRS, bbox, and sources.
- `mapa/scripts/build_map.py` parses artifacts and embeds normalized results.
- `mapa/map-fragment.template.html` renders the embedded artifacts and imports
  `d3-geo` from jsDelivr at browser runtime.

The current code contains no OpenStreetMap tiles, terrain-relief request, or
planning WMS image. The ortho snapshot is the only current background image.
`d3-geo` is a required runtime dependency for vector projection/rendering, not
a map-data provider.

Provider normalization, capability discovery, allowlisting, provenance, and
portability are owned by the acquisition architecture. Sources beyond the
legacy set are evaluated in [Candidate Map Layers](additional-map-layers.md).

## KIEG Land Classification Evidence

KIEG capabilities checked on 2026-07-24 advertise queryable `uzytki` and
`kontury` layers with `EPSG:2178` support. GUGiK states that the integrated
service can display cadastral land-use and classification contours, but not
every county publishes them. The prototype therefore treats a downloaded image
as a dated visual snapshot rather than a complete national or legal record.

## Official References

- [GUGiK ULDK operation documentation](https://uldk.gugik.gov.pl/opis.html)
- [GUGiK ULDK service](https://uldk.gugik.gov.pl/)
- [GUGiK UUG service](https://services.gugik.gov.pl/uug)
- [GUGiK OpenLS service](https://www.geoportal.gov.pl/pl/usluga/usluga-openls)
- [GUGiK WMS/WMTS service catalogue](https://www.geoportal.gov.pl/pl/usluga/uslugi-przegladania-wms-i-wmts)
- [GUGiK BDOT10k browsing services](https://www.geoportal.gov.pl/en/data/topographic-objects-database-bdot10k)
- [GUGiK EGiB and KIEG overview](https://www.geoportal.gov.pl/pl/dane/ewidencja-gruntow-i-budynkow-egib/)
- [Polish national geoportal](https://www.geoportal.gov.pl/)
- [OGC Web Map Service standard](https://www.ogc.org/standard/wms/)
