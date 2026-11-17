# PROJECT-001: Interactive Project Area Selection

## Status

- Phase: `APPROVED FOR IMPLEMENTATION` for the previously authorized parcel-based
  scope. The interactive revision below is a proposal for review; moving this
  plan does not itself authorize implementation of the revised scope. API
  contract details remain subject to owner agreement.
- Requirement: [PROJECT-001](../requirements/projects-and-aoi.md#project-001--create-a-bounded-project-area-from-parcels), accepted but not implemented or verified; it still describes the older parcel-based scope and needs revision.
- Functional draft: [Project and evidence preparation](../spec/project-and-evidence.md#planned-change-draft) still describes the older scope and needs revision; the legacy description remains current.
- Owner responsibility: the owner implements Kotlin backend production code; frontend work is under owner review. Full acceptance requires the real backend and PostgreSQL, not just the simulator.

## Problem And Outcome

The replacement application has a foundation page but no project creation or
product API. A user needs to navigate a map of Poland, find a location or parcel,
and select a bounded working area without calculating coordinates. The project
can then be created and reopened after a restart, with source qualification and
no partial writes.

## Scope And Boundaries

- Pan and zoom the map independently of search; draw a rectangular working area
  anywhere on the map, including without selecting a parcel.
- Search by voivodeship, locality, street, or parcel number. Move to a selected
  result and present contextual candidates rather than guessing ambiguous input.
- Select up to 100 parcels by clicking or entering a number. An unambiguous
  parcel proposes an initial area with 100 m context; keep source parcel
  boundaries distinct from the working rectangle. Subsequent selection must not
  silently overwrite a manually adjusted area.
- Resize the rectangle by dragging edges or corners, with an accessible
  non-drag alternative. It may cut through a selected parcel, but must never
  alter parcel geometry. Warn when selected parcels extend outside it.
- Preview and explicitly confirm. Show CRS, source, observation date,
  attribution where applicable, and limits/uncertainty. The backend revalidates
  the submitted rectangle and re-resolves selected parcels; only a complete
  matching result can be saved. Reopen by stable address and restore the area,
  parcel geometries and identifiers, CRS, and relevant provenance.
- Retain inputs for correction on incomplete, ambiguous, invalid, or excessive
  results. The proposed retained limits for the parcel subject, when present,
  and working extent are 2 km width, 2 km height, and 4 km²; direct users to
  separate projects rather than offering an override.
- Neighboring parcels, if returned, are context only. Source-layer acquisition
  and arbitrary polygon editing are outside this slice. Do not migrate or alter
  legacy code, tracked data, private overlays, or external snapshots.

## Findings And Decisions

- At planning start, Angular had only the foundation page, `geo-planner-api`
  had a client-generation workflow but no accepted project contract, and the
  simulator had only health. It now has provisional synthetic project routes;
  neither these routes nor the generator establish accepted product behavior.
- [Target architecture](../architecture/target-product.md) assigns transient
  UI state and OpenLayers rendering to Angular; the backend owns authoritative
  projects, provider access, validation, provenance, and PostgreSQL state.
- The owner selected **revalidation** over temporary preview tokens. On create,
  the backend validates the area and resolves any selected ULDK parcels again,
  compares the result to the displayed preview, and persists only a match.
- The owner confirmed that parcels are optional, the working area is an
  editable rectangle, and it may cut through selected parcels without changing
  their boundaries. Basemap tiles go through our backend rather than directly
  from a provider to the browser. The detailed contract remains unaccepted.
- Existing PROJECT-001 limits and 100 m initial context are carried forward as
  proposed assumptions for the revised scope; their application to an optional
  parcel subject and a manually edited rectangle must be reflected in the
  requirement. The name field, fingerprint, idempotency, and detailed UI remain
  proposals rather than separately accepted requirements.
- [ULDK and integration evidence](../research/current-public-integrations.md)
  and [AOI research](../research/area-of-interest-and-raster-sizing.md) contain
  dated findings. The official ULDK operation description was checked on
  2026-11-17; the research record preserves its scope and limitations. This was
  documentation research, not a live-service check. Verify public map, place
  search, and ULDK capabilities, formats, CRS, licensing, attribution, caching,
  coverage, and operational limits before selecting providers or implementing
  adapters. Live requests must be explicitly scoped and separate from builds
  and tests; do not refresh legacy data.

## Alternatives Considered

- **Not selected:** a backend-held preview token. The owner chose fresh
  revalidation instead; transient server preview storage is not required.
- **Not selected:** direct provider tiles in the browser. The owner chose the
  backend-mediated alternative after considering privacy and backend load.
- **Not selected as the current basemap decision:** a commercial free tier,
  such as [MapTiler](https://docs.maptiler.com/guides/account/sessions-vs-requests),
  which requires a key and has usage limits. The public
  [OSM tile service](https://operations.osmfoundation.org/policies/tiles/)
  also has usage restrictions; public
  [Nominatim](https://operations.osmfoundation.org/policies/nominatim/)
  prohibits autocomplete. Check current conditions before selecting any source.
- **Not selected for this version:** an arbitrary editable polygon. The owner
  selected a rectangle with handles instead.

## Open Decisions And Contract Proposal

The owner previously authorized implementation of the parcel-based scope; the
interactive revision is presented here for review. The concrete versioned
OpenAPI contract still requires owner agreement before dependent production API
calls or generated client are implemented. The owner requested examining public
APIs, proposing the backend contract and modeling it in the simulator for review.
The current parcel-only draft is
[project-001-openapi-proposal.yaml](project-001-openapi-proposal.yaml), not an
accepted or authoritative production contract. ULDK remains a parcel-data
source, not the application contract or its authority. Agree the authoritative
contract location rather than making the simulator or backend queue another
contract owner. The draft must be revised to cover these conceptual operations:

1. `getMapTile(layerId, z, x, y)` returns bounded image bytes and cache and
   attribution metadata from a server-owned, allowlisted source.
2. `searchPlaces(query, context)` returns typed, disambiguated candidates and
   navigation coordinates or extents; `resolveParcel(point | query, context)`
   returns full identifiers and geometries or explicit ambiguity/errors.
3. `preview(parcelIds[], workingExtent, crs)` returns parcel geometries, exact
   rectangle, provenance, warnings, and a fingerprint for a complete result;
   zero parcels is valid.
4. `create(name, parcelIds[], workingExtent, crs, previewFingerprint,
   idempotencyKey)` revalidates and compares before transactional persistence.
5. `getProject(projectId)` restores the saved area and any parcel data, with
   source and uncertainty metadata.

The contract decision must specify:

- Fingerprint algorithm, version, canonical representation and equality of
  identifiers, geometry, CRS, and exact rectangle, including precision,
  tolerances, coordinate/ring ordering and geometry validity. Do not rely on
  unstable vertex order or observation time; fail rather than guess CRS or axes.
- Structured field, unresolved-parcel, excessive-extent, stale-preview,
  source-unavailable, timeout, and unexpected error semantics; request, response,
  time, retry, and concurrency bounds; correlation IDs and compatibility rules.
- Idempotency scope, key/payload binding, conflict behavior, durable result and
  retention, replay order, and recovery after an unknown result or browser and
  backend restart. The proposed replay returns the original committed result
  without re-resolving; changing payload with the same key is rejected. No
  automatic frontend mutation retries; an uncertain attempt may be retried only
  with the same key and payload. Resolve how a user safely recovers the same
  attempt after reload before claiming restart-safe duplicate prevention.
- What source date means and what is displayed when it is unavailable; exact
  project fields, naming/identifier validation, coordinate representations,
  authentication/deployment assumptions, and data retention.
- Exact application of width, height, and area limits to a parcel subject and
  independently edited working rectangle, including disconnected parcels.
- Selected providers' actual coverage across national and parcel zoom levels,
  tile matrices, capabilities, CRS, licensing, attribution, cache rules, rate
  limits and failures; support for isolated street names and ambiguous parcels.

Contract examples, fingerprint fixtures, and acceptance of the owner-owned
backend implementation are necessary before they are treated as guarantees.
The recommended geometry convention in the old proposal is normalized
`EPSG:2180`, with explicit easting/northing coordinate order and metric extents;
the exact wire geometry and fingerprint canonicalization remain owner decisions.
Define extent order, transforms, candidate types, partial results and structured
errors; restrict upstream identifiers, bounds, concurrency, time and size, and
validate image MIME types and provider/OGC errors. Never accept arbitrary URLs.

## Reuse Analysis

Use the existing Angular standalone/lazy-route, typed Reactive Forms, signals,
and API facade/mapping conventions. Generate transport code using the existing
OpenAPI generator only after contract acceptance; never hand-edit generated
output. Keep `RuntimeConfigService`'s same-origin API boundary. The loopback
simulator may exercise the explicitly provisional proposal and synthetic
fixtures for owner review; it is not the contract authority, a ULDK client, or
evidence of backend persistence.

The accepted target is OpenLayers behind a feature adapter: its established
projection, map interaction, and vector rendering support fits this slice and
avoids a custom map engine. Confirm that a stable package is compatible with
the pinned Angular/Node toolchain before adding it. Use backend-mediated tiles;
the fixture simulator must not contact live providers. Reuse or adapt synthetic
`tests/fixtures/projects/single-xy` and `multi-yx`, preserving their CRS and
axis-order meaning without copying private data.

[GUGiK WMS/WMTS](https://www.geoportal.gov.pl/pl/usluga/uslugi-przegladania-wms-i-wmts)
is a candidate basemap, not a confirmed source; its
[BDOT10k WMTS](https://www.geoportal.gov.pl/pl/dane/baza-danych-obiektow-topograficznych-bdot10k)
has limited scales, so one layer must not be assumed to cover every zoom level.
[ULDK documentation](https://uldk.gugik.gov.pl/opis.html) describes
`GetParcelByXY` and `GetParcelByIdOrNr`; precinct/name searches may yield
multiple matches. Evaluate GUGiK UUG and a suitable authoritative source for
voivodeship, locality and street lookup. Document proven capabilities and gaps
rather than promising unsupported free-text behavior.

## Architecture And Component Composition

```text
[Angular: search, selection, workflow state] <--results / errors--> [API facade]
        |                                                           |
        v                                                           v
[OpenLayers: map and rectangle editing]                    [Owner backend]
                                                                    |
                +-------------------+------------------+------------+
                v                   v                  v            v
        [Allowlisted tiles]   [Place search]         [ULDK]     [PostgreSQL]

[Simulator: fictional fixture responses] is an alternative test endpoint;
it is neither the contract authority nor evidence of provider access or persistence.
```

The feature owns form and transient request state; the adapter renders and
edits the rectangle. The backend owns canonical geometry, limits, comparison,
provider access and durable project state. Generated transport objects stop at
the facade/mappers. The browser does not access providers directly.

## Planned Code Composition

Frontend names and paths remain provisional until the contract is agreed.

```text
frontend/
├── [modify] src/app/app.routes.ts                    lazy create/detail routes
├── [new] src/app/features/project-creation/
│   ├── project-creation-page.*                      search, form and actions
│   ├── project-creation-state.ts                    selection, preview, create and cancel
│   └── aoi-map-adapter.ts                           map, rectangle editing and cleanup
├── [new] src/app/features/project-detail/           ProjectDetailPage: reopen project
├── [new] projects/geo-planner-api/src/lib/
│   ├── generated/                                   generator-owned accepted DTO/client
│   ├── mappers/                                     map transport to domain/view models
│   └── facade/                                      tile/search/parcel/preview/create/read
├── [modify] package.json and lockfile               OpenLayers dependency
└── [new] e2e/ project journeys                      browser validation
docs/projects/
├── project-001-parcel-aoi.md                        active plan
├── project-001-openapi-proposal.yaml                provisional; revise for interactive scope
└── project-001-mockup.html and PNGs                 revise for interactive scope
backend-simulator/src/ [modify]                      provisional synthetic routes and fixtures
backend/ [owner implements]                          provider, validation, state
docs/requirements/projects-and-aoi.md [revise for confirmed product decisions]
docs/spec/project-and-evidence.md [draft then reconcile]
docs/research/current-public-integrations.md [provider evidence and limitations]
docs/requirements/backend-api-implementation-queue.md [after contract acceptance]
```

The owner determines actual Kotlin composition and persistence migrations.
The agent does not implement backend production code under this proposal.

## UI And UX Proposal

The existing self-contained [mockup](project-001-mockup.html),
[desktop preview 1440 × 900](project-001-desktop.png), and
[mobile preview 390 × 844](project-001-mobile.png) illustrate the **old
parcel-only scope**, not the interaction proposed here. Update them before
implementation: use fictional data, no network or persistence, and open the HTML
locally. They are design evidence, not implementation or acceptance evidence.
The following is a directly readable fallback for the revised interaction:

```text
Desktop                                  Mobile portrait
[Search locality / street / parcel]       [Search               ]
[Results / selected parcels       ]       [Results / selection  ]
[Map: parcels + editable rectangle]       [Map + rectangle      ]
[Extent / warnings] [Preview] [Create]    [Extent / preview     ]
                                          [Create               ]
```

The main journey is browse/search → draw or select → edit → preview → confirm →
stable project view. Support empty, loading, no match, ambiguity, invalid,
partial, excessive, unavailable/offline map or search, stale, cancelled, saving,
uncertain outcome, and restored-project states. Editing inputs or the rectangle
invalidates the preview; late responses cannot reinstate it. The user can correct
inputs and knowingly retry an uncertain create only as the agreed idempotency
contract permits. Provide labels, visible focus, keyboard operation and rectangle
editing, announced asynchronous messages, and non-color-only distinctions.

## Failure, Safety, And Migration

Reject unrecognized projection/axis order and invalid or incomplete geometries;
do not infer official cadastral, legal, utility, planning, or survey certainty.
Show provenance and limitations, including unknown dates where applicable.
Bound upstream calls and input sizes; do not allow arbitrary provider URLs or
log private project data. Preserve existing durable projects on failure and
make no partial write. A timeout does not imply a failed commit: show an
unknown outcome and follow the accepted idempotent recovery protocol.

There is no automatic legacy migration, source refresh, or destructive storage
change in this slice. Backend schema and any required migration remain owner
work and must preserve existing data; normal builds and tests use fixtures.

## Implementation Plan

1. [in-progress] Consolidate the interactive scope in this active plan. Revise
   the requirement and functional draft for optional parcels, a rectangle and
   partial overlap; research and record dated public provider evidence. Update
   the offline mockup and desktop/mobile previews for the new journey and
   failure states, and verify responsive, accessible interaction.
2. [pending] Revise the OpenAPI proposal for tiles, place search, parcel lookup,
   rectangle preview, create and read. Define CRS, comparison, fingerprint,
   idempotency/recovery, limits, security and errors for owner review. Adapt the
   simulator with deterministic fictional images, searches, geometry, failures
   and contract tests. Keep production calls and generated clients blocked
   until the owner accepts the contract; update the backend queue afterward.
3. [pending] After contract acceptance, generate the client and implement the
   lazy Angular map, backend-mediated tiles, search and disambiguation, and
   parcel selection by map click and text. Test navigation, accessibility,
   cancellation, ambiguity and provider failure with simulator fixtures.
4. [pending] Implement drawing and resizing the rectangle, accessible controls,
   initial parcel proposal without overwriting manual changes, warnings and
   authoritative preview. Test coordinate transforms, limits, zero parcels,
   partial overlap, invalidation and stale responses.
5. [pending] Add fingerprint-bound creation, uncertain-result recovery with an
   unchanged key and payload, and stable project reopening. Test complete UI
   journeys against the simulator. The owner implements the Kotlin backend,
   providers, PostgreSQL persistence and safe migration; verify the real
   contract, revalidation, idempotency and reopen after process restart.
6. [pending] Reconcile the draft with observed behavior, route follow-ups, run
   verification, and present evidence and limitations for explicit owner
   acceptance. Keep the project until lifecycle closeout is authorized.

## Verification And Acceptance

- Test fictional tiles, places and parcel-by-point/number, ambiguous candidates,
  unavailable providers and invalid tile coordinates without live access.
- Test rectangle draw, resize and keyboard editing, CRS/axis transforms, zero,
  one and 100 parcels, partial overlaps, invalid geometry and exact/exceeded
  width, height and area limits. Verify manual edits are preserved on selection.
- Cover equivalent geometry encodings and meaningful differences according to
  the agreed canonical comparison; stale preview, input changes, cancellation,
  out-of-order results, source errors, timeouts, and no partial writes.
- Verify identical idempotent replay, key/payload conflicts, concurrent attempts,
  unknown outcomes, browser recovery, and backend restart as the accepted
  contract specifies. A simulator cannot establish these real guarantees.
- Unit-test form, API mapping, feature state, projection adapter and cleanup;
  run browser journeys for candidate selection, parcel selection, rectangle
  editing, preview, create, reopen, errors, keyboard, accessibility and desktop
  and narrow screens, using synthetic data and no live provider dependency.
- Run focused frontend/simulator checks, then `mise run verify`. Against the
  owner-delivered backend and PostgreSQL, verify real contract conformance,
  persistence, reopen after process restart, and duplicate-safe recovery.
- Full PROJECT-001 completion requires all requirement criteria, actual
  end-to-end evidence, documented limitations and explicit owner acceptance.
  Until real backend integration and acceptance exist, report it as blocked,
  not verified. Record commands actually run and any omitted or failed checks.

## Result

The prior parcel-based scope was authorized. The interactive revision is
recorded here for review; the existing parcel-only contract, simulator and
mockup need revision before they represent it. Contract decisions and the
owner-owned backend implementation remain pending agreement and delivery.
`cd backend-simulator && npm run verify` passed (13 tests), and the OpenAPI YAML
was parsed successfully. `mise run verify` passed before the final simulator
changes, which were checked separately. No live ULDK request, frontend
implementation, or real backend/PostgreSQL verification has been run.