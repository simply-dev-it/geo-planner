# Public API Integration Handoff

## Status And Boundaries

This is the owner-backend handoff for the current simulator-backed Angular
workspace. The [product OpenAPI](contracts/interactive-v1.openapi.yaml) is the
single provisional contract consumed by the generated frontend client. It is
not the upstream GUGiK API or proof of a production backend implementation.
The [product principles](../requirements/index.md#product-principles) require
public, free-of-charge sources, backend normalization and a simpler aggregated
workflow without a local reference-data mirror.

Dated probe URLs, hashes, successful/failed variants and coverage limitations
belong to [integration research](../research/current-public-integrations.md).
Provider limits, errors, CRS and permissions are adapter responsibilities.
This document specifies what to fetch, transform and expose to the frontend.

## Product Operations To Implement

| Product operation | Backend responsibility | Frontend use |
| --- | --- | --- |
| `GET /api/v1/search/filters` | Read the small region code/name catalogue from public PRG; no city/street ingestion | Region options, identifiers treated as opaque |
| `GET /api/v1/search` | Route by requested kind/context, apply verified filters, normalize and return at most five candidates | Guided locality/street/house or short parcel lookup; direct identity; More |
| `POST /api/v1/parcels/resolve` | ULDK identity/point lookup; distinguish resolved, ambiguous and unavailable | Select/deselect a clicked parcel or resolve a chosen search identity |
| `POST /api/v1/parcels/intersections` | Bounded EGiB WFS acquisition, exact polygon intersection and qualified coverage | Faint viewport outlines and separate working-area suggestions |
| `GET /api/v1/map/layers/{layerId}/tiles/{z}/{x}/{y}` | Fetch/adapt source imagery to the product tile grid | Draw the interactive basemap, independently from search |
| `POST /api/v1/projects/previews` | Validate exact rectangle/subjects, qualify source evidence and compute fingerprint | Read-only review |
| `POST /api/v1/projects` | Revalidate/fingerprint match, idempotent transactional create | Explicit save and exact unknown-outcome replay |
| `GET /api/v1/projects/{id}` | Return saved area/subjects/provenance | Open the bounded project cutout |

The existing preview/create/read shapes and limit rules are in OpenAPI. The
source integrations below do not replace these task-oriented product operations.
Kotlin production code is intentionally left to its repository owner.

## Provider Catalogue

| Source | Base URL | Operations / data |
| --- | --- | --- |
| UUG | `https://services.gugik.gov.pl/uug/` | `GetAddress&address=Marki`, `Marki, Andersa`, `Marki, Andersa 1`; optional dictionaries `GetCity`, `GetStreet`, `GetAddresses` need TERYT/SIMC/ULIC context |
| PRG streets WFS | `https://mapy.geoportal.gov.pl/wss/ext/wfs/KrajowaIntegracjaNumeracjiAdresowej` | WFS 2.0 `DescribeFeatureType` / `GetFeature`, type `adresyUlice:A08_Ulice`; filtered street geometry and locality/commune metadata |
| PRG administrative WFS | `https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WFS/AdministrativeBoundaries` | Exact administrative types `ms:A01_Granice_wojewodztw`, `ms:A02_Granice_powiatow`, `ms:A03_Granice_gmin`; names/codes only when geometry is unnecessary |
| ULDK | `https://uldk.gugik.gov.pl/` | `GetParcelById`, `GetParcelByIdOrNr`, `GetParcelByXY`, administrative ID/point lookup; request explicit result fields and `srid=2180` |
| Aggregate EGiB WFS | `https://mapy.geoportal.gov.pl/wss/service/PZGIK/EGIB/WFS/UslugaZbiorcza` | WFS 2.0 `ms:dzialki`, bounded BBOX, GML or validated advertised GeoJSON; selected identity in `ID_DZIALKI` |
| Basemap WMTS | `https://mapy.geoportal.gov.pl/wss/service/WMTS/guest/wmts/BDOT10k-BDOO` | WMTS capabilities, layer `BDOT10k`, matrix set EPSG:2180; native grid requires adaptation |
| Optional KIEG WMS | `https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow` | WMS `dzialki`, `numery_dzialek`; LPIS supplementation is separate evidence |

The new PRG OGC API Features service at
`https://ogcapi.geoportal.gov.pl/res/ims/maps/prg_ad/apiFeatures` also publishes
[official OpenAPI](https://ogcapi.geoportal.gov.pl/res/ims/maps/prg_ad/apiFeatures/api?f=json).
Its tested Core API supports bounded items and paging but rejected an ad-hoc
street-name parameter. Use the verified WFS attribute filters for name lookup.
Its links/server metadata pointed to `ogcapitest.geoportal.gov.pl`, and the
queryables endpoint returned a non-schema body. Do not follow source-provided
URLs blindly or assume every HTTP 200 body is a valid capability description.

## Search Routing And Filtering

- Explicit `type=place` field: UUG `GetAddress` for locality or full address. Parse
  `type`, `found objects` and the `results` dictionary. A street-only-looking
  word can be a locality: `Lipowa` returned 12 cities in the observed sample.
  Never relabel those city results as streets. Preserve query specificity:
  locality lookup returns locality descriptors, not an expansion into every
  `GetStreet`/`GetAddresses` child record. A supplied street/address phrase can
  return its matching source descriptor. Apply this source query plan before
  product pagination; the frontend must not hide arbitrary rows after paging.
- Street kind: PRG street WFS. A standalone name is supported. Combine name
  matching, administrative context and optional viewport in a single native
  filter before pagination. A contextual phrase may also use UUG, but its kind
  and administrative metadata must be preserved.
- Parcel kind: ULDK full identity or precinct + number. A bare number without
  a qualified viewport/precinct returns `needs_context`, not guessed subjects.
  A viewport-based bare-number path can query/filter bounded EGiB candidates;
  validate that source-specific filter in the production adapter before enabling
  it. A locality/SIMC is not a cadastral precinct.
- The retained general API kind may combine UUG location candidates with supported street results
  or a clearly identified parcel query. Use an explicit bounded provider plan,
  deduplication and deterministic merge order. Do not retrieve national records
  and filter them locally. Provider failure must not masquerade as no-match.

### Verified PRG Street Filter Matrix

| Product input | Native WFS expression / backend mapping |
| --- | --- |
| Street text / partial name | `PropertyIsLike(NAZWA_ULICY, *Lipowa*)`, case-insensitive |
| `regionId` | `PropertyIsLike(ID_GMINY, 14*)` for mazowieckie |
| `countyId` | Commune-code prefix, e.g. `ID_GMINY LIKE 1420*` |
| `countyName` | Resolve name/code in administrative PRG, scoped by region; map code to the prefix above; ambiguous names return context request |
| `communeId` | Exact `ID_GMINY`, e.g. `1420032` |
| `communeName` | `NAZWA_GMINY`, case-insensitive name match |
| `localityId` | Exact `ID_MIEJSCOWOSCI` (SIMC), e.g. `0111515` |
| `localityName` | `NAZWA_MIEJSCOWOSCI`, case-insensitive name match |
| `streetId` | Exact `ID_ULICY` (ULIC), qualified by locality/commune; a name code alone is not a unique street instance |
| `bounds` | FES BBOX on `GEOMETRIA`, combined with attribute clauses inside FES And |
| More | `COUNT=5`, `STARTINDEX`, deterministic `SORTBY=ID_IIP`; detect exhaustion from counts, not just presence of a next URL |

Code strings preserve leading zeroes. Reject conflicting code/name constraints
or unsupported filter combinations explicitly. For UUG, there is no documented
native region/paging parameter: apply region/context to its qualified result
set before taking the five displayed rows. Never take an upstream first five
and then filter, which would falsely report no matches.

The tested street WFS needs **unqualified property names** inside ValueReference;
`adresyUlice:NAZWA_ULICY` was rejected, `NAZWA_ULICY` worked. Request GML 3.2:
the tested `application/json` variant returned HTTP 400. Parse both simple
LineString and MultiCurve, not only rectangular fixture geometry.

Example filter for a street and region (URL-encode the full FILTER value):

```xml
<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0">
  <fes:And>
    <fes:PropertyIsLike wildCard="*" singleChar="?" escapeChar="!" matchCase="false">
      <fes:ValueReference>NAZWA_ULICY</fes:ValueReference>
      <fes:Literal>*Lipowa*</fes:Literal>
    </fes:PropertyIsLike>
    <fes:PropertyIsLike wildCard="*" singleChar="?" escapeChar="!">
      <fes:ValueReference>ID_GMINY</fes:ValueReference>
      <fes:Literal>14*</fes:Literal>
    </fes:PropertyIsLike>
  </fes:And>
</fes:Filter>
```

Use an XML builder; escape XML entities and literal wildcard/escape characters
in user input. The source URL, type names, property names and operators are
allowlisted server configuration, never arbitrary client input.

## Normalized Response For The Frontend

The frontend consumes **data plus pixels through separate operations**. Search
returns navigation descriptors, not a rendered map and not provider XML:

```json
{
  "status": "ready",
  "candidates": [{
    "id": "uug-city-143402-0920901",
    "type": "locality",
    "label": "Marki",
    "contextLabel": "gmina Marki · powiat wołomiński · mazowieckie",
    "regionId": "14",
    "localityId": "0920901",
    "center": [644468, 498763],
    "extent": [643468, 497763, 645468, 499763],
    "crs": "EPSG:2180",
    "axisOrder": "easting-northing",
    "source": "GUGIK_UUG"
  }],
  "nextCursor": null,
  "provenance": {"provider": "GUGIK_UUG", "sourceDataDate": null, "limitations": []}
}
```

This is a normalized single-candidate example, not the raw ten-result Marki
response. The example extent is a derived camera frame, not a locality boundary
or project AOI. Use source geometry envelopes plus a bounded camera margin for
streets; for point results choose a documented navigation frame. Parcel results
also carry the full `parcelId` for subsequent ULDK revalidation.

| Source data | Normalize to product data |
| --- | --- |
| UUG `city`, `street`, administrative fields | Label + contextual disambiguation; retain actual kind |
| UUG TERYT/SIMC/ULIC, PRG `ID_IIP` | Qualified stable candidate identity; hash long source IDs to fit the 128-character candidate limit; do not use response row numbers as global identities |
| UUG numeric strings / WKT, WFS GML | Parse finite coordinates/geometries, normalize source CRS/axis order to EPSG:2180 easting/northing |
| Street `ID_GMINY` / UUG TERYT | Region/county qualification; resolve display metadata through public PRG where needed |
| Geometry | Camera center/envelope for search; full normalized Polygon/MultiPolygon only for parcel resolution/intersections |
| EGiB `DATA`, source metadata | Qualified source date; preserve null/unknown and do not claim a legal effective date |
| Multiple sources / missing coverage | Provenance/limitations, typed ambiguity/no-match/context/unavailable outcomes |

The frontend selects an ID, fits its camera to `extent`, then requests map tiles
and bounded parcel outlines for that view. It does not parse GML, query UUG/WFS,
resolve administrative codes, transform upstream formats or guess a precinct.
Changing the camera never creates the working rectangle automatically.
The UI is sequential: `type=locality` queries a chosen locality name, `type=street`
uses the selected SIMC and a street fragment, and `type=address` carries the house
number in `query`, with `localityId`, `streetId` and fallback `localityName` /
`streetName`. The backend composes the native UUG phrase or scopes an address
operation using source codes, then normalizes the result. `SearchCandidate.streetId`
is a locality-qualified ULIC code, not a global street instance ID.

The fresh Bobowa capture demonstrates why qualification matters: UUG returned
both Słoneczna 1 and Słonecznikowa 1 for a Słoneczna 1 phrase. Match the selected
SIMC/ULIC and exact house number before product pagination. The Ciężkowice
negative capture has `type=address`, `found objects=15`, `returned objects=0` and
`results=null`. This is no returned match, not a parse failure or fifteen usable
results. Native `found objects` is not a reliable product total/continuation.
Keep native aliases distinct from erroneous context: code qualification should
not reject a legitimate same-code canonical street-name expansion.

Short parcel numbers use an explicit visible-map scope, accepted by the owner
on 2026-11-19. Acquire bounded EGiB features and match `NUMER_DZIALKI` exactly,
then revalidate the chosen identity with ULDK. Truncated/unavailable acquisition
cannot establish a complete negative result. Full identities use ULDK directly
and bypass viewport filtering. Locality/point precincts are not whole-locality
coverage. PRG can list precinct names/codes for a commune, but that alone does not
establish an efficient whole-locality parcel-number search.

Source [fixture catalogue](simulator-fixtures.md) routes native request/response
bytes and normalized examples for backend adapter tests. The simulator implements
our normalized contract, not the raw UUG/WFS protocols. Its bounded frozen samples
replay representative source cases; live availability, fuzzy matching beyond
captures, national completeness and provider rate limits are not reproduced.
Search/navigation in project stage 1 never selects project subjects. That explicit
selection belongs to stage 2; preview/save belongs to stage 3.

## Map Pixel Contract

Implement `base-map` as an opaque configured source layer ID. The product uses
256-pixel PNG tiles in EPSG:2180 with extent `[-1000000,-1000000,2000000,2000000]`
and top-left origin `[-1000000,2000000]`. At zoom z:

```text
resolution = 3000000 / (256 * 2^z)
span = 256 * resolution
Emin = -1000000 + x * span
Nmax =  2000000 - y * span
tileBounds = [Emin, Nmax-span, Emin+span, Nmax]
```

The frontend uses the same grid. Native BDOO/BDOT10k WMTS uses 512-pixel tiles,
13 named matrices and a different origin/resolution series. The backend must
choose source resolution, map axis conventions, fetch covering tiles, mosaic/
resample and return the requested product tile. A compatible public WMS GetMap
bridge is an alternative adapter if its layer/scale/axis coverage is validated.
Do not forward z/x/y unchanged. Distinguish provider failure/OGC exception from
a valid blank image; validate MIME/signature/dimensions. Overzoom does not add
source precision. Source image delivery/mosaicking still requires production
integration testing; only metadata was probed in this research.

Saved project views clip and constrain the map to their stored frame. A persisted
source snapshot is a separate acquisition capability, subject to source terms.
The WMS/WMTS metadata excludes automated harvesting: agree permitted viewing,
request caching and user-triggered snapshot retention before production storage.

## Paging, Failure And Ownership

No local national registry or ingestion job is needed. Process each bounded
response in request memory. For UUG continuation either re-fetch/revalidate the
bounded result set with a signed query/filter/content fingerprint, or use an
explicitly agreed transient response policy; no reference registry is created.
For native WFS paging keep query, kind, region, context and viewport bound to the
cursor. Updates are not transaction-safe; stale/expired cursors require restart.
Do not forward arbitrary upstream next links (including test/internal hosts).

`needs_context` has no candidates/continuation and a human `contextPrompt`.
It differs from `no_match`, an unsupported query, source timeout, malformed
provider response and source failure. Preserve typed Problem details and
correlation IDs. No automatic mutation retries; preview/create/read and exact
idempotency recovery follow the product OpenAPI.

Integration checks should exercise same-name localities and streets, region and
combined filters, native sorted pages, CRS/axis fixtures, source outages, missing
coverage, GML/OGC error bodies with HTTP 200, and tile grid/image mapping. They
remain separate from normal deterministic simulator verification.

### Administrative Catalogue And Human-Name Resolution

PRG `ms:A01_Granice_wojewodztw` with `PROPERTYNAME=JPT_NAZWA_,JPT_KOD_JE` and
COUNT=16 returned the region catalogue without geometry. Map this directly to
`SearchFilters.regions`; the frontend never needs a local TERYT table.
For `countyName`, query exact type `ms:A02_Granice_powiatow` with the name clause
on `JPT_NAZWA_` and region-prefix clause on `JPT_KOD_JE`. The verified płoński/14
query returned code 1420, which then scopes street `ID_GMINY` by prefix. Use
attribute-only, bounded queries. Multiple county matches require disambiguation;
do not silently take the first. Exact layer identifiers matter: similarly named
special-purpose layers are not administrative counties.

Case-insensitive matching is verified; upstream accent folding is not. The backend
can normalize returned bounded candidates and selected codes, but must not claim
that every ASCII spelling is a native source match. Optional ID/name/context
filters must be consistently validated before their source plan is executed.
