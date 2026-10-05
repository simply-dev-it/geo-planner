# Current Public Integrations

## Status And Decision Trace

- Status: DEFERRED
- Evidence reconstructed: 2026-07-28 from the checked-in prototype and
  configuration; no fresh live-service validation was performed.
- Question: which exact public operations, layers, formats, and legacy failure
  behavior must inform replacement ULDK, WMS, and APP adapters?
- Completed outputs: [ACQUIRE-001](../requirements/layer-acquisition.md) owns
  safe acquisition, [LAYER-004](../requirements/layer-viewing.md) owns raster
  interpretation, and
  [acquisition flow](../architecture/acquisition-and-artifact.md) owns
  provider-adapter and catalog boundaries.
- Remaining work: validate the exact live endpoint, capabilities, licence,
  coverage, and operational limits for each adapter slice.
- Return before: implementing or materially changing any ULDK, ORTO, KIEG,
  KINA, KIUT, or APP adapter.

This document records what legacy code requests, not what a current public
service guarantees.

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
| Parcel WKT files | `services.uldk` | `GetParcelByIdOrNr`; `id=<precinctId>.<parcel.number>`; `result=geom_wkt,teryt,parcel`; `srid` derived from project CRS | Text containing geometry and parcel identity | Required; a failed request stops refresh and the temporary file is discarded |
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

- [GUGiK ULDK documentation](https://uldk.gugik.gov.pl/)
- [GUGiK EGiB and KIEG overview](https://www.geoportal.gov.pl/pl/dane/ewidencja-gruntow-i-budynkow-egib/)
- [Polish national geoportal](https://www.geoportal.gov.pl/)
- [OGC Web Map Service standard](https://www.ogc.org/standard/wms/)
