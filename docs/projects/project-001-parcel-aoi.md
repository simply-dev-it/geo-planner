# PROJECT-001: Parcel-Based Project And Area Of Interest

## Status

- Phase: `APPROVED FOR IMPLEMENTATION` — the owner authorized this named scope
  together with its plan; API contract details remain subject to owner agreement.
- Requirement: [PROJECT-001](../requirements/projects-and-aoi.md#project-001--create-a-bounded-project-area-from-parcels), accepted but not implemented or verified.
- Functional draft: [Project and evidence preparation](../spec/project-and-evidence.md#planned-change-draft); the legacy description remains current.
- Owner responsibility: the owner implements Kotlin backend production code; frontend work is under owner review. Full acceptance requires the real backend and PostgreSQL, not just the simulator.

## Problem And Outcome

The replacement application has a foundation page but no project creation or
product API. A user needs to enter parcel identifiers, understand the subject
and bounded surrounding context, and create a project that can be reopened
after a restart without calculating a bbox. This project delivers that vertical
slice while preserving source qualification and rejecting incomplete subjects.

## Scope And Boundaries

- Enter a name, 1–100 full parcel identifiers, and a 0–500 m buffer, default
  100 m. Typing identifiers is the proposed first selection interaction.
- Preview individual selected parcels, their union, buffered context, and the
  acquisition extent. Show CRS, source, observation date, attribution where
  applicable, and limits/uncertainty; distinguish derived and source evidence.
- Identify unresolved parcels and retain inputs for correction. Reject partial,
  ambiguous, or excessive results: the subject and buffered extent must each
  stay within 2 km width, 2 km height, and 4 km². Direct users to separate
  projects instead of providing a limit override.
- Invalidate the preview when its inputs change. Create only after backend
  revalidation matches the preview; open the saved project using a stable
  address and restore identifiers, geometry, CRS, and buffer after restart.
- Neighboring parcels, if returned, are context only. Neighbor lookup, map-click
  parcel selection, source-layer acquisition, and expert polygon/bbox editing
  are not part of this slice. No legacy code, tracked data, private overlays,
  or external snapshots are migrated or changed.

## Findings And Decisions

- The Angular routes load the foundation page; `geo-planner-api` has a client
  generation workflow but no accepted project contract. The simulator has only
  a health route. These foundations are not evidence of product functionality.
- [Target architecture](../architecture/target-product.md) assigns transient
  UI state and OpenLayers rendering to Angular; the backend owns authoritative
  projects, provider access, validation, provenance, and PostgreSQL state.
- The owner selected **revalidation** over temporary preview tokens: the
  backend resolves ULDK again on creation, compares the result to the displayed
  preview, and persists only a matching complete result. This selection does not
  approve the remaining contract or implementation.
- Limits and source operation are accepted in PROJECT-001. The name field,
  typed input, route flow, fingerprint, idempotency, and detailed UI described
  here are proposals for review rather than separately accepted requirements.
- [ULDK and integration evidence](../research/current-public-integrations.md)
  and [AOI research](../research/area-of-interest-and-raster-sizing.md) are
  dated. Recheck the exact service, response, CRS/axis order, licensing,
  attribution, and operational limits before implementing its adapter. Live
  requests are explicit, not part of ordinary builds or tests.

## Alternatives Considered

- **Not selected:** a backend-held preview token. The owner chose fresh
  revalidation instead; transient server preview storage is not required.
- **Deferred:** selecting parcels directly on a map. Typed identifiers provide a
  narrower initial input without changing the requirement's parcel semantics.

## Open Decisions And Contract Proposal

The owner authorized implementation of PROJECT-001 and this plan in one task.
The concrete versioned OpenAPI contract still requires owner agreement before
dependent production API calls or generated client are implemented. The user
specifically requested deriving a backend-contract proposal from the parcel
lookup behavior used by the external map workflow, then modeling that proposal
in the simulator for review. ULDK remains a parcel-data source, not the
application contract or its authority. Agree the authoritative contract
location rather than making the simulator or backend queue another contract
owner. Propose these task-level operations; paths and payloads are intentionally
undecided:

1. `preview(parcelIds, bufferMetres)` returns complete or explicitly partial
   results, geometries, union, buffer, extent, CRS and axis order, source
   provenance, warnings, and a versioned fingerprint for a complete result.
2. `create(name, parcelIds, bufferMetres, previewFingerprint, idempotencyKey)`
   re-resolves and compares before transactional persistence; it returns a
   stable project identity or a structured error. It never saves partial data.
3. `getProject(projectId)` restores accepted project and spatial data with
   source and uncertainty metadata.

The contract decision must specify:

- Fingerprint algorithm, version, canonical representation and equality of
  identifiers, geometry, CRS, buffer, and extent, including precision,
  tolerances, coordinate/ring ordering and geometry validity. Do not rely on
  unstable vertex order or observation time; fail rather than guess CRS or axes.
- Structured field, unresolved-parcel, excessive-extent, stale-preview,
  source-unavailable, timeout, and unexpected error semantics; request, response,
  time, retry, and concurrency bounds; correlation IDs and compatibility rules.
- Idempotency scope, key/payload binding, conflict behavior, durable result and
  retention, replay order, and recovery after an unknown result or browser and
  backend restart. The proposed replay returns the original committed result
  without re-resolving; changing payload with the same key is rejected. No
  automatic frontend mutation retries. Resolve how a user safely recovers the
  same attempt after reload before claiming restart-safe duplicate prevention.
- What source date means and what is displayed when it is unavailable; exact
  project fields, naming/identifier validation, coordinate representations,
  authentication/deployment assumptions, and data retention.

Contract examples, fingerprint fixtures, and acceptance of the owner-owned
backend implementation are necessary before they are treated as guarantees.

## Reuse Analysis

Use the existing Angular standalone/lazy-route, typed Reactive Forms, signals,
and API facade/mapping conventions. Generate transport code using the existing
OpenAPI generator only after contract acceptance; never hand-edit generated
output. Keep `RuntimeConfigService`'s same-origin API boundary. Use the existing
loopback simulator only for explicit accepted examples and deterministic tests.

The accepted target is OpenLayers behind a feature adapter: its established
projection and vector rendering support fits this slice and avoids a custom map
engine. Confirm the selected stable package version is compatible with the
pinned Angular/Node toolchain before adding it. Do not fetch background tiles;
the preview can render returned geometry alone. Reuse or adapt synthetic
`tests/fixtures/projects/single-xy` and `multi-yx`, preserving their CRS and
axis-order meaning without copying private data.

## Architecture And Component Composition

```text
[Angular form / feature state] <--results / errors--> [API facade + generated client]
        |                                                    |
        |                                              commands / results
        |                                                    v
        |                                     [Owner backend: AOI + projects]
        |                                       |                    |
        |                         resolve / re-resolve        transactional create
        |                                       v                    v
        |                                 [ULDK adapter]        [PostgreSQL]
        |                                       |
        |                                       v
        |                                     [ULDK]
        v
[OpenLayers adapter: render only]

[Simulator: accepted fixture responses] substitutes for the API in tests;
it is neither the contract authority nor evidence of backend persistence.
```

The feature owns form and transient request state; the backend owns canonical
geometry, limits, comparison and durable project state. Generated transport
objects stop at the facade/mappers. Rendering consumes typed view models; it
does not validate spatial authority or access the provider.

## Planned Code Composition

Names and paths for new files are provisional until the contract is agreed.

```text
frontend/
├── [modify] src/app/app.routes.ts                    lazy create/detail routes
├── [new] src/app/features/project-creation/
│   ├── project-creation-page.*                      ProjectCreationPage: form/actions
│   ├── project-creation-state.ts                    ProjectCreationState: preview/create/cancel
│   └── aoi-map-adapter.ts                           AoiMapAdapter: render/dispose
├── [new] src/app/features/project-detail/           ProjectDetailPage: reopen project
├── [new] projects/geo-planner-api/src/lib/
│   ├── generated/                                   generator-owned accepted DTO/client
│   ├── mappers/                                     map transport to domain/view models
│   └── facade/                                      ProjectApi: preview/create/read
├── [modify] package.json and lockfile               OpenLayers dependency
└── [new] e2e/ project journeys                      browser validation
backend-simulator/src/ [modify]                      accepted contract scenarios
backend/ [owner implements]                          provider, validation, state
docs/spec/project-and-evidence.md [draft then reconcile]
docs/requirements/backend-api-implementation-queue.md [after contract acceptance]
```

The owner determines actual Kotlin composition and persistence migrations.
The agent does not implement backend production code under this proposal.

## UI And UX Proposal

Review the self-contained [interactive mockup](project-001-mockup.html) by
opening it locally in a browser. It uses fictional schematic data, performs no
network access or persistence, and is not implementation or acceptance evidence.
Representative previews: [desktop 1440 × 900](project-001-desktop.png) and
[mobile 390 × 844](project-001-mobile.png). A directly readable fallback:

```text
Desktop                              Mobile portrait
[Project name          ]             [Project name          ]
[Parcel ID] [Add]      [PREVIEW]     [Parcel ID] [Add]
[Parcel list / errors] [legend ]     [Parcel list / errors]
[Buffer: 100 m        ]              [Buffer: 100 m        ]
[Show preview]                       [Show preview]
[Create project]                     [PREVIEW + legend]
                                     [Create project]
```

The main journey is entry → preview → create → stable project view. Support
empty, loading, invalid, partial, excessive, unavailable/offline, stale,
cancelled, saving, uncertain outcome, and restored-project states. Changing
an input invalidates the preview; late responses cannot reinstate it. The user
can correct inputs and knowingly retry an uncertain create only as the agreed
idempotency contract permits. Provide labels, visible focus, keyboard operation,
announced asynchronous messages, and non-color-only geometry distinctions.

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

1. [pending] Review this proposal, draft specification, mockup, and scenarios;
   agree versioned OpenAPI, canonical comparison, idempotency/recovery, errors,
   and safe limits with the owner. Recheck ULDK evidence before its adapter is
   implemented. After contract acceptance, route the backend work to its queue.
2. [pending] After authorization, generate the client, add accepted simulator
   scenarios, typed Angular form and state, and OpenLayers preview adapter;
   test spatial presentation, invalidation, errors, and accessibility.
3. [pending] Add create and stable project-detail flows against the accepted
   contract; model stale and unknown outcomes and safe user-initiated retry.
4. [pending] The owner implements the Kotlin backend, ULDK adapter, PostgreSQL
   persistence, and safe migration. Verify the complete slice against the real
   backend, including revalidation, idempotency and process restart.
5. [pending] Reconcile the draft with observed behavior, route follow-ups, run
   verification, and present evidence and limitations for explicit owner
   acceptance. Keep the project until lifecycle closeout is authorized.

## Verification And Acceptance

- Test single and adjacent multi-parcel synthetic cases with declared CRS/axis
  order; buffer 0, 100, and 500 m; 1 and 100 identifiers; invalid boundaries;
  exact and exceeded width, height, and area; distant and unresolved parcels.
- Cover equivalent geometry encodings and meaningful differences according to
  the agreed canonical comparison; stale preview, input changes, cancellation,
  out-of-order results, source errors, timeouts, and no partial writes.
- Verify identical idempotent replay, key/payload conflicts, concurrent attempts,
  unknown outcomes, browser recovery, and backend restart as the accepted
  contract specifies. A simulator cannot establish these real guarantees.
- Unit-test form, API mapping, feature state, projection adapter and cleanup;
  run browser journeys for preview, errors, keyboard, accessibility and desktop
  and narrow screens, using synthetic data and no live provider dependency.
- Run focused frontend/simulator checks, then `mise run verify`. Against the
  owner-delivered backend and PostgreSQL, verify real contract conformance,
  persistence, reopen after process restart, and duplicate-safe recovery.
- Full PROJECT-001 completion requires all requirement criteria, actual
  end-to-end evidence, documented limitations and explicit owner acceptance.
  Until real backend integration and acceptance exist, report it as blocked,
  not verified. Record commands actually run and any omitted or failed checks.

## Result

Implementation is authorized for the named PROJECT-001 scope. API contract
details and owner-owned backend implementation remain pending agreement and
delivery.