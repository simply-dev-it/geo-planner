# Current Public Integrations

## Status And Decision Trace

- Status: ACTIVE.
- Evidence checked: 2026-11-18 for baseline operations; 2026-11-19 for
  additional street/administrative filtering and pagination probes. Earlier legacy request observations remain explicitly separated below.
- Question: can public-authority APIs support location search, visible parcel
  outlines, map selection and bounded project preparation without commercial
  or community-operated third-party service dependencies?
- Owner constraint: public-authority services only; on 2026-11-19 the owner
  explicitly rejected locally maintained reference-data copies/indexes. Production provider adapters
  remain owner-backend work; the Angular application still uses the simulator.
- Completed outputs: [project gates](../requirements/projects-and-aoi.md),
  [current workflow](../spec/project-and-evidence.md), provider responsibility in
  [target architecture](../architecture/target-product.md), and
  [acquisition boundaries](../architecture/acquisition-and-artifact.md).
- Open evidence: production query completeness, stable pagination under updates,
  service-specific budgets, attribution and snapshot/cache permission, actual
  tile/image delivery, CRS edge cases and representative county coverage.
- Return before implementing a production adapter, source snapshot policy or
  lookup UX, or when service capabilities/terms change.

## Official Services And Live Evidence

The [probe manifest](evidence/public-service-probes-2026-11-18.json) records exact
URLs, status, MIME, byte counts and response hashes. Raw bodies were examined in
temporary research storage, not installed as fixtures or legacy snapshots.
All nine calls returned HTTP 200 with expected JSON, text or XML. This is a
point-in-time observation, not a service-level or national-coverage guarantee.
No tile/image or national dataset was downloaded.

| Purpose | Public endpoint / operation | Verified observation and boundary |
| --- | --- | --- |
| Place/street/address lookup | `https://services.gugik.gov.pl/uug`, `GetAddress` | `Marki` returned 10 locality candidates with SIMC, TERYT and administrative context; `Marki, Andersa` returned one street and multiline geometry. |
| Prefix behaviour | Same UUG operation, address `Mar` | Zero matches. A three-character frontend trigger does not establish general prefix autocomplete. |
| Resolve one parcel | `https://uldk.gugik.gov.pl/`, `GetParcelById` | Published example `141201_1.0001.6509` returned success status 0, EWKT `SRID=2180;POLYGON`, identity, number and county-WFS source. |
| Viewport parcel vectors | `https://mapy.geoportal.gov.pl/wss/service/PZGIK/EGIB/WFS/UslugaZbiorcza` | WFS 2.0 capabilities and schema, then a 200 × 200 map-unit EPSG:3857 BBOX with COUNT=3 returned three Polygon features. Web Mercator map units are not ground metres. |
| Indicative cadastral image | `https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow` | WMS 1.3.0 capabilities expose separate `dzialki`, `numery_dzialek`, `obreby` and `geoportal` (LPIS supplementation) layers. Pixels do not provide subject identity. |
| Nationwide basemap candidate | `https://mapy.geoportal.gov.pl/wss/service/WMTS/guest/wmts/BDOT10k-BDOO` | WMTS 1.0 capabilities expose PNG layer `BDOT10k`, EPSG:2180 matrix set, 13 matrices and 512-pixel tiles. Image delivery remains untested. |

The [UUG specification](https://services.gugik.gov.pl/uug/opis.html) documents
locality, locality/street and address text, plus `GetCity` by commune TERYT,
`GetStreet` by SIMC and `GetAddresses`. It does not document our regionId,
result-kind, limit or cursor parameters. The [ULDK specification](https://uldk.gugik.gov.pl/opis.html)
provides point resolution, identifier/precinct-plus-number lookup, snap and
aggregate geometry operations. Neither specification establishes a native
five-record, filtered, national parcel-prefix autocomplete. UUG row IDs in a
response must not be assumed globally stable; qualify identity with register
context. Confirm UUG output CRS during adapter validation, since sampled WKT
had no explicit SRID prefix.

The [national BDOO/BDOT10k composition announcement](https://www.geoportal.gov.pl/aktualnosci/nowa-usluga-przegladania-wmts-danych-bdoo-i-bdot10k-w-serwisie-geoportal-gov-pl/)
identifies the combined service as the replacement for `G2_MOBILE_500`, covering
national through local scales. This addresses the earlier single-BDOT10k scale
limitation; the [individual BDOT10k service](https://www.geoportal.gov.pl/pl/dane/baza-danych-obiektow-topograficznych-bdot10k/)
remains a separate product with its own scale range.

### Vector Contract Findings

The WFS layer is `ms:dzialki`. Its schema includes `ID_DZIALKI`,
`NUMER_DZIALKI`, precinct/commune fields and `DATA`. The sampled features retained
full parcel identities and source date `2026-11-17`; not all administrative
fields were populated. Do not substitute missing fields or treat DATA as a
survey/legal effective date without confirming its semantics.

Capabilities advertise result paging and sorting, with default count 1000,
but transaction-safe paging is false. Default count is not a proven hard limit.
Only BBOX is advertised as a spatial operator. Our backend must limit reads,
handle truncation/update consistency and compute positive-area intersection
against validated source polygons. The offline simulator now exercises polygon
clipping and holes on bounded captures; it does not prove production geometry
validation or national completeness. There is no need to reconstruct parcels by
sending a grid of point queries to ULDK.

The sampled GeoJSON explicitly requested EPSG:3857 to avoid assuming the axis
order of EPSG URNs. Product geometry stays EPSG:2180 easting/northing; normalize
projection and protocol-specific axes at the adapter. ULDK EWKT has an explicit
SRID prefix. The WMTS matrix identifiers/origin/resolutions and 512-pixel tile
size differ from the current synthetic XYZ grid: blindly forwarding its z/x/y
is invalid. A native grid descriptor or backend normalization is required.

## Coverage And Area Projects

A registered parcel is a unit of land registration, not necessarily a building
plot ([GUS definition](https://stat.gov.pl/metainformacje/slownik-pojec/pojecia-stosowane-w-statystyce-publicznej/3879,pojecie.html)).
That domain definition does not guarantee complete API geometry coverage.
[Official EGiB coverage documentation](https://www.geoportal.gov.pl/pl/dane/ewidencja-gruntow-i-budynkow-egib/)
describes remaining analogue/hybrid records and incomplete county vectors.
LPIS supplementation is indicative and may differ from county EGiB. Empty
responses or outlines cannot establish the absence of a real parcel.

The [aggregate WFS announcement and instruction](https://www.geoportal.gov.pl/aktualnosci/zbiorcza-usluga-wfs-dla-ewidencji-gruntow-i-budynkow-udostepniona-w-modulach-mapowych-serwisu-geoportal-gov-pl/)
confirms area-based parcel/building download in Geoportal. Thus visible outlines
and area discovery are feasible public-service capabilities, with source coverage
and operational limits. They do not justify making an explicit parcel subject
mandatory for every planning area. The accepted intent/area gates are owned by
[PROJECT-001](../requirements/projects-and-aoi.md), not by source coverage.

## Human Parcel Numbers And Location Context (2026-11-18)

ULDK supports a full identity or precinct name plus number; repeated precinct
names can return multiple matches and increase response work. A locality or
street is not a unique cadastral precinct. The official
[human-number search description](https://www.gov.pl/web/gugik/udoskonalenie-narzedzia-do-wyszukiwania-dzialek)
also shows hierarchical administrative/precinct selection. Keep contextual
ambiguity explicit and retain full identities. A short number alone plus a
voivodeship is not a confirmed efficient nationwide search contract.

## Usage And Persistence Constraints

The ULDK FAQ states commercial use is free, requires source attribution and no
standard API key. It publishes per-IP limits of 200 requests/minute between
06:00 and 18:00, 40/minute outside that interval and 10,000/day, with an optional
trusted-IP arrangement. These are dated publisher terms, not measured capacity;
do not assume they cover UUG/WFS/WMTS. A shared backend IP aggregates user load.

Observed WFS metadata says Fees/AccessConstraints `none`. KIEG and WMTS metadata
state no fee but explicitly exclude automated harvesting/collection from the
general use permission. A public endpoint is not blanket permission for a tile
archive or indiscriminate prefetch. Confirm the intended user-triggered snapshot,
cache, retention and attribution policy before production acquisition; do not
claim either that every screenshot is prohibited or that all caching is allowed.
[Acquisition architecture](../architecture/acquisition-and-artifact.md) owns the
resulting provider-specific policy and source qualification.

## Recommendation And Alternatives

Recommend UUG for qualified location lookup, ULDK for chosen-point/identity
resolution, aggregate EGiB WFS for bounded vectors, and combined BDOO/BDOT10k
WMTS as the basemap candidate. KIEG is an optional indicative raster overlay,
not a replacement for vector identity. All calls remain backend-mediated.
This is an integration recommendation, not a claim that adapters are delivered.

Filtered five-row UI pages remain feasible as our own backend contract. UUG
results require normalization/filtering and controlled continuation; ordinary
upstream query prefixes or a tiny upstream limit cannot be assumed complete.
The provisional search contract now carries an explicit bounded viewport for
short-number lookup. Production integration must qualify that coverage and
preserve truncated/unavailable outcomes. A selected locality does not establish
a unique precinct automatically.
The owner rejected a local TERYT/SIMC/ULIC index on 2026-11-19 because it would
require maintaining a second reference-data copy. Full-phrase UUG remains the
place/address path. Additional verified PRG street WFS filters now support
source-side dynamic street matching and paging without a mirror, as below.
Treat precinct-plus-number/full-identity lookup separately from address text.

| Alternative | Disposition / return condition |
| --- | --- |
| Commercial/free-tier SaaS or community-hosted geocoding/tiles | Rejected under the owner's public-authority-only constraint. |
| Guess all visible parcels through repeated point calls | Rejected: incomplete sampling and excessive traffic; use WFS BBOX candidates. |
| Infer EGiB identity from a raster or LPIS appearance | Rejected: distinct evidence classes and coverage. |
| Maintain a local city/street/cadastral reference index | Rejected by the owner on 2026-11-19: authoritative lookup stays with public services; adapt search UX instead of introducing ingestion/refresh ownership. |
| Treat the simulator as an upstream API specification | Rejected: frozen matches, fixture pagination and sampled geometries prove bounded normalized-contract cases only. |

## Extended Capability Investigation (2026-11-19)

The owner requested service capabilities first, then a friendlier aggregated
product and backend normalization. The [additional probe manifest](evidence/lookup-capability-probes-2026-11-19.json)
retains request/status/body hashes including failed exploratory variants. No
registry mirror or bulk feature acquisition was performed. The
[backend integration handoff](../architecture/public-api-integration.md) owns the
implementation-facing operation/filter/response matrix and provisional contract.

UUG `GetAddress(Lipowa)` returned 12 **localities**, while `Marki` returned 10
localities and `Marki, Andersa` one street. Therefore UUG alone does not establish
national street-name lookup. The newer official
[PRG/PRNG OGC API announcement](https://www.geoportal.gov.pl/aktualnosci/nowe-uslugi-ogc-api-features-dla-danych-prg-i-prng/)
was published 2026-09-25 and exposes street/address collections with OpenAPI.
The [publisher OpenAPI snapshot](evidence/prg-addresses-publisher-openapi-2026-11-19.json)
is retained unchanged. Core items/paging worked; an ad-hoc `nazwaUlicy` parameter
returned 400. Queryables returned HTTP 200 with a non-schema body exposing an
internal diagnostic URL. Metadata links/server names pointed to a test host;
none authorizes following arbitrary source-supplied URLs.

The official [WFS service catalogue](https://www.geoportal.gov.pl/pl/usluga/uslugi-pobierania-wfs/)
also exposes PRG addresses/streets. Its schema identified `adresyUlice:A08_Ulice`
and the street, locality and commune fields documented in the handoff. JSON
GetFeature was rejected; GML 3.2 worked. Namespace-qualified ValueReference
names failed, but the same unqualified names succeeded.

With source-side case-insensitive name matching `*Lipowa*`, COUNT=2 reported
2092 national matches and 289 in region 14. These are dated substring-query
observations, not a count of unique name codes or a permanent total. Eight more
COUNT=1 probes verified county prefix (7 matches), commune (1), locality (1),
street-code plus locality (1), combined human names (1), BBOX plus name (1), and
two distinct pages sorted by ID_IIP (289 matched on both). Only the bounded
requested rows were downloaded. This supports lazy street pages and a short
cancellable typing delay; it does not establish service-level load capacity.
Case-insensitivity was tested; upstream diacritic folding was not established.

Administrative PRG using exact type `ms:A02_Granice_powiatow` resolved płoński
within region 14 to county code 1420; property-only region lookup returned 16
names/codes, preserving leading zeroes. An earlier exploratory substring-based
type selection selected a civil-defence layer and returned no county; it is
retained as a failed exploration, not evidence of missing administrative data.
Production adapters must use allowlisted exact type names and validate semantics,
not infer capability from HTTP 200 or a matching word in a layer title.

The accepted public/free-source and backend-processing principles are owned by
the [requirements portfolio](../requirements/index.md#product-principles).
The normalized product map still needs a real imagery adapter: search returns
navigation data while separate map requests supply pixels. Exact upstream
image/WMTS normalization, intended snapshot permission and representative
coverage remain open integration evidence; filter success does not close them.

## Legacy Integration Evidence

The following inventory describes checked-in prototype request construction,
not current production guarantees. It is retained because migration and backend
reviews still use its exact protocols and failure policies. Earlier documentation
checks (2026-11-17) made no live calls; the live evidence above supersedes their
unverified endpoint/operation questions. No legacy source was refreshed.

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


The prototype has no OpenStreetMap basemap, terrain-relief request or planning
WMS request; D3 is a rendering dependency. KIEG land-class capabilities were
checked on 2026-07-24 for EPSG:2178, without establishing full county coverage.
Legacy implementation evidence is in `mapa/scripts/update_sources.py`,
`mapa/project-config.json`, `mapa/scripts/build_map.py` and
`mapa/map-fragment.template.html`. Additional source families remain in
[Candidate Map Layers](additional-map-layers.md).


## Short-Number Scope Follow-Up (2026-11-19)

Two bounded attribute-only EGiB probes combined `NUMER_DZIALKI=108/3` with
`ID_DZIALKI` prefixes for a known precinct (`146510_8.0502.*`) and commune
(`146510_8.*`). Both exceeded a 25-second read timeout. No feature bodies were
received and neither supports a claim of operational commune-wide number
lookup. This may reflect source/network performance rather than unsupported
syntax; return before enabling that production path.
The [probe manifest](evidence/parcel-number-scope-probes-2026-11-19.json) retains
exact requests and failures. Existing bounded BBOX feature acquisition remains
the evidence for a visible-map number path, with exact backend number matching
and explicit incomplete/unavailable coverage rather than a false negative.


## Sequential Lookup And Grounded Fixture Evidence (2026-11-19)

The [sequential probe manifest](evidence/sequential-lookup-probes-2026-11-19.json)
records UUG `Marki, Andersa 1`, ULDK precinct-at-point and a three-record PRG
precinct page. The address returns an actual point. The Marki point's precinct
`143402_1.0033` differs from all three precincts on the commune page: a locality
point is not a whole-locality cadastral scope. Native PRG paging reports unknown
total and a next page; do not assume that page is complete or follow next URLs
without allowlisted reconstruction. The owner selected bounded visible-map
short-number lookup on 2026-11-19; locality-wide number lookup remains unproven.

Owner-authorized one-off capture for Ciężkowice, Bobowa and Gromnik produced
89,483 response-body bytes under a 2 MiB budget. The
[native capture/normalization manifest](../../backend-simulator/fixtures/public-near-ciezkowice/snapshot.json)
retains exact request URLs, hashes and unchanged adjacent response files.
It contains actual ambiguous locality candidates, five streets and five parcels
per detailed locality, and three confirmed address cases. EGiB `DATA` is
2026-11-18 in the sample and must not be labelled a legal effective date.

Material adapter observations:

- UUG returns three Ciężkowice and three Gromnik locality candidates. The nearby
  municipalities are explicitly qualified by their actual TERYT codes.
- A Ciężkowice address query returns `type=address`, `found objects=15`,
  `returned objects=0`, `results=null`. Handle the empty returned set without
  inventing usable candidates or treating native found count as paging total.
- Bobowa Słoneczna 1 lookup also returns a fuzzy Słonecznikowa 1 candidate;
  selected SIMC/ULIC and exact house number qualify the product response.
- GML street coordinates use protocol-specific axes; parcel capture explicitly
  requests EPSG:3857 GeoJSON and normalizes to EPSG:2180. Per-feature raw source
  properties remain available for interpretation.
- The imported Ciężkowice orthophoto and 13 older ULDK polygons preserve a
  separate, unknown source observation date. They are not a fresh API refresh.
- Actual imagery exposed an adapter mismatch: the OpenLayers tile source had
  retained default EPSG:3857 while product tiles use EPSG:2180. Explicit source
  projection, origin/resolution assertions and a real-raster browser scenario
  now verify the common grid.

The [fixture catalogue](../architecture/simulator-fixtures.md) owns current
samples/commands; the [backend handoff](../architecture/public-api-integration.md)
owns mapping. This evidence supports representative normalized contract cases,
not exhaustive native fuzzy search, current availability, rate-limit behaviour,
complete locality coverage or snapshot/image retention permissions for production.
Return before implementing those production adapters or changing source protocols.
