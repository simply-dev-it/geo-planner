# Offline Simulator Fixture Catalogue

## Status And Scope

The loopback simulator exercises the provisional product contract without live
provider calls. It contains bounded real public-source captures, an archived
Ciężkowice orthophoto/parcel fragment, and three separate fictional places for
fault and workflow regressions. It does not reproduce the national services in
full or establish live availability, legal currency or cadastral completeness.
Projects and idempotency records are process-local and disappear on restart.

## Real Public Captures

Captured on 2026-11-19: Ciężkowice (gmina Ciężkowice), Bobowa and Gromnik (gmina
Gromnik). Seven locality candidates preserve native ambiguity: three Ciężkowice,
one Bobowa and three Gromnik. Detailed acquisition is scoped to the three nearby
municipalities. Each has five PRG streets and five EGiB parcels from an approximately 300 × 300 m
sample window; these are partial samples. Fifteen streets, fifteen parcels and three
qualified address examples are available. No street/address rows were invented.

| Locality | Street | House number | SIMC / ULIC |
| --- | --- | --- | --- |
| Ciężkowice | Kolejowa | `10` | `0815239` / `08828` |
| Bobowa | Słoneczna | `1` | `0417728` / `20254` |
| Gromnik | Witosa | `1` | `0820571` / `24454` |

- Native request URLs, response hashes, exact bytes and normalized examples:
  [public capture manifest](../../backend-simulator/fixtures/public-near-ciezkowice/snapshot.json).
  Adjacent `.response` files are unchanged UUG JSON, PRG GML, EGiB GeoJSON and ULDK text.
- Downloaded response bodies total **89483 bytes**, below the explicit 2 MiB text budget.
  Raw plus normalized records are about 210 KiB.
- EGiB field `DATA` is retained (2026-11-18 in this sample); it is not a legal
  effective date. Original UUG/ULDK observation dates can remain unknown.
- Public records use actual source identities. A parcel's captured map context
  does not establish a postal-locality/cadastral-precinct equivalence.
- Source ambiguity and empty replies are intentional: UUG can return
  `results=null` with zero returned rows, or fuzzy matches from another street.
  The normalized backend response qualifies chosen SIMC/ULIC/house number.

## Archived Ciężkowice Fragment

The owner-authorized import reads only public parcel responses and the existing
orthophoto from the retained legacy snapshot. It includes thirteen real parcels,
including `121601_4.0001.1092/2`, with actual Polygon/MultiPolygon rings and holes.
Source EPSG:2178 geometry/imagery is normalized to EPSG:2180. The 480 × 520 m
source crop becomes a 988 × 1065 RGBA grid at 0.5 m. Its compressed raster is
about 2.22 MiB. Import date is not the source observation date; the latter is
unknown. Metadata and source checksums live in
[the imported manifest](../../backend-simulator/fixtures/ciezkowice/snapshot.json).
No owner classifications, analytical percentages or private overlays are imported.

The archive is south of the official UUG town point. Locate its full parcel ID
above to see the orthophoto; do not misrepresent the crop centre as the town's
native search point. Outside imagery coverage, captured PRG lines and neutral
background are shown in real-data neighbourhoods. They are not a complete
cartographic base. Coverage is explicitly partial, including at parcel holes.

All fixture artifacts total about **2.44 MiB**; this is a small development snapshot,
not a reference registry or production ingestion pipeline.

Tile responses identify their fixture source through `X-Simulator-Fixture`:

| Marker | Content |
| --- | --- |
| `archived-ciezkowice-orthophoto-256px-png` | Archived public orthophoto pixels, source date unknown |
| `captured-public-vectors-256px-png` | Sparse captured PRG street vectors on a neutral background |
| `schematic-map-256px-png` | Generated fictional map for workflow and fault tests |

## Fictional Fault And Workflow Cases

Brzozowo / Dąbrowa / Jeziorna in fictional Północne / Południowe remain separately
identified synthetic examples. They have Lipowa and Leśna streets, Lipowa 1
addresses, and 24 rectangular parcels: Brzozowo `101/1`–`104/1`, `110/1`–`115/1`;
Dąbrowa `116/1`–`121/1`; Jeziorna `101/1`, distant `199/1`, `122/1`–`127/1`.
Full synthetic IDs use `999999_9...` and are not public cadastral identities.
`__fixture_unavailable__` is a deliberate search failure; `999999_9.9999.756`
is an ambiguous selector. These scenarios prove guards/errors, not source behaviour.

## Guided Journeys And Stage Boundaries

1. Find and choose a locality, optionally choose a street, then explicitly choose
   house number or short parcel number. Each view has one input. Skip street or
   number to choose visually later. A full parcel identity is a direct shortcut.
2. Search only locates. Project stage 2 owns parcel addition/removal and area
   drawing, discovery, fit and buffer. A located parcel has an explicit Add action.
   Source outlines are read-only in stage 1. Review/save in stage 3 is read-only.
3. Short numbers use the visible map neighbourhood, up to 2 × 2 km. Full IDs bypass
   map scope. Selecting a parcel does not create/fit the working rectangle.
4. Query/context edits cancel stale requests and cursors. Five-result pages use
   explicit More; the frozen samples cannot stand for complete native paging.
5. The simulator-only top-bar **Dane testowe** dialog lists short and full IDs.
   Production builds neither probe nor expose simulator facilities.

## Explicit Maintenance Only

Normal build, hot reload and verification never refresh sources. With separate
owner authorization for a new bounded public capture:

```bash
python3 backend-simulator/scripts/capture-public-snapshot.py
```

The script enforces the payload budget and reuses captured response files instead
of repeating existing requests. Native empties and ambiguity remain in raw bytes.
For the authorized archived import (offline), after normal frontend setup:

```bash
mise exec -- node backend-simulator/scripts/import-ciezkowice-snapshot.mjs
```

This optional importer uses pinned frontend proj4/OpenLayers tooling and macOS
`sips` for import-time JPEG decoding. Simulator runtime/build/tests consume the
checked-in data and need neither `sips` nor those frontend packages. Do not format
or hand-edit generated manifests/response bytes. Geometry tests preserve holes;
byte hashes catch accidental changes to native captures. After simulator code or
fixture changes, restart `mise run start simulator` before browser review.
