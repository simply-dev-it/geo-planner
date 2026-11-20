# Projects And AOI Requirements

## Application Area

Project identity, parcel subjects, surrounding context, and bounded spatial
extent. Source-layer acquisition and rendering belong to separate areas.

## Requirement Index

| ID | Delivery stage | Status | Priority | Capability |
| --- | --- | --- | --- | --- |
| `PROJECT-001` | `MVP` | `ACCEPTED` | `MUST` | Create a project from an interactive working area |

## PROJECT-001 — Create a project from an interactive working area

- Status: ACCEPTED
- Priority: MUST
- Delivery stage: MVP
- Source evidence: owner decisions from 2026-07-28, 2026-11-17 and 2026-11-18;
  `docs/research/area-of-interest-and-raster-sizing.md`; sanitized
  single/multi-parcel fixtures.

### Outcome

A user navigates a map of Poland, finds a place or parcel, and creates a project
from an editable bounded working area without calculating coordinates. Parcel
selection is optional and its source geometry remains distinct from the area.

### Contract

- Initial continuation requires an explicitly chosen location/search result
  or an explicit map-only entry. Query text,
  region filters, restored preferences and navigation alone do not pass this gate.
- The user can pan and zoom an interactive map across Poland independently of
  search, and can draw a project rectangle at any location without selecting a
  parcel.
- Guided search locates a locality, optional street and optional house/short parcel
  number, or accepts a full parcel identity directly. It navigates to the chosen result. Ambiguous results are presented for explicit
  choice; the system does not guess. Parcels can also be selected by map click
  or a pasted identifier in the same search. Clicking a selected parcel on the map deselects it.
- Search accepts human parcel numbers including fractions such as `101/1`
  with locality/precinct context, offers explicit ambiguous matches, and retains
  stable full identity internally. Users may still paste a full identifier.
  A locality or street must not be treated as a unique cadastral precinct.
- A project can contain zero to 100 selected parcels. Selection alone never
  creates or fits the working rectangle. Drawing
  or the fit-to-parcels button creates it; parcel changes preserve it.
- The project working area is a rectangle editable by its edges or corners,
  including an accessible alternative to pointer dragging. It may intersect
  only part of a selected parcel. Editing it never changes the source parcel
  boundary; the UI warns when selected parcels extend outside the area.
- The backend mediates map tiles through server-configured sources; the browser
  does not send arbitrary provider URLs. Use free-of-charge public-authority services; commercial
  or community-operated third-party services are not product dependencies. The provider and exact tile/search
  coverage remain implementation decisions subject to service evidence and
  owner review.
- Finishing or applying a rectangle edit discovers source-qualified parcel
  suggestions with positive-area intersection. The user explicitly adds each
  desired subject; discovery never silently selects neighboring parcels or
  removes existing selections. Boundary-only contact is excluded. Incomplete,
  unavailable and empty complete results remain distinguishable; real provider
  coverage and operations require integration evidence.
- A separate fit-to-parcels action replaces the working rectangle with the
  envelope of all selected subjects plus the chosen buffer. Changing selection
  or the buffer alone preserves the manual area. Excessive fit proposals retain
  it and require correction; no selected subject is silently omitted.
- Coordinate entry is not a user workflow. Map interaction and keyboard-operable
  resize controls support editing an intentional area without coordinate or dimension entry.
- Preview frames the actual validated rectangle and shows dimensions and subject
  count before confirmation. It also presents the rectangle, selected parcel geometries when present, CRS,
  source, observation date, attribution, warnings, and limits/uncertainty.
  Geometry is indicative evidence, not a legal or cadastral determination.
- Before creation, the backend validates the submitted rectangle and resolves
  selected parcels again; it saves only a complete result matching the preview.
  A successful project has a stable address and reopening after restart restores
  the rectangle, parcel identifiers/geometries, CRS, and relevant provenance.
- Unresolved or ambiguous parcels, invalid geometry, and any parcel-subject
  envelope or working rectangle exceeding 2 km width, 2 km height, or 4 km²
  block creation. The user can correct the retained input; there is no override.

### Acceptance Criteria

- Lookup shows one input at a time: locality -> optional street -> explicit
  house-number or short-parcel-number choice. A full parcel identity is a separate
  shortcut. There is no smart intent detection. Upstream changes invalidate
  downstream lookup context. Street fragments debounce from three characters;
  other inputs submit explicitly. Guidance is available before typing.
- Stage 1 only locates/navigates; stage 2 selects parcels and defines the area;
  stage 3 reviews and saves. Visible controls and state/map guards enforce these
  boundaries. A lookup result never silently adds a project subject or area.
- Skipping street/number and explicit map-only entry support users without a
  complete address. A located parcel can be explicitly added in stage 2.
- Short numbers use a labelled bounded map neighbourhood; full identities bypass
  map scope. A locality or street is not a unique cadastral precinct. House
  number lookup qualifies actual locality/street identity before offering results.
- Administrative filters remain deferred advanced search. Ambiguous names have
  human context; locality-only lookup does not enumerate streets/addresses.
- Queries are cancellable; restored preferences initiate no lookup. Five-row
  pages and More never displace the map. Partial/unavailable source coverage is
  explicit, and actions remain accessible on desktop and narrow screens.
- Indicative parcel outlines are visible before selection at a bounded map scale;
  viewport reads are limited and cancellable, with explicit coverage/failure states.
  Selected lists use available panel space in area and preview.
- The saved project view is clipped and constrained to its saved rectangle;
  zooming out cannot expand the project into an unbounded national map.
- An invalid rectangle blocks review/save, has a red outline and persistent
  feedback, and can return to stage 2 for correction. Correction restores review.
  Lookup never permits area edits, including when revisiting an existing area.
- Preview is read-only for parcel selection, working rectangle and fit buffer;
  changes require returning to editing.
- Preview/save forms use the same qualified selection; save opens the saved
  map. Developer fixtures are outside the production workflow and documented
  separately, with an optional simulator-only catalogue.

- The map can be navigated without a query; searches distinguish candidate kinds
  and show ambiguity instead of selecting an arbitrary result.
- A project with no selected parcel subjects and projects with selected parcels can both be
  previewed; point selection resolves the containing parcel or shows candidates.
  Area-only review is explicitly labelled; missing source coverage is not treated
  as proof that the ground has no parcels and does not force a parcel subject.
- A rectangle containing or partially intersecting a parcel proposes it without
  selecting it. Explicit addition invalidates preview, preserves the rectangle,
  avoids duplicates and respects the 100-subject limit. Edits discard stale
  suggestions and preserve already selected subjects; discovery failure does not
  become an empty complete result.
- Editing the rectangle preserves selected parcel geometry, supports partial
  intersection, and reports parcels outside or partly outside the area.
- Single/multiple parcel fixtures and rectangle boundary fixtures produce
  deterministic extents and respect the CRS and axis-order declarations.
- Incomplete, ambiguous, stale, invalid, or excessive input cannot create a
  project; accepted width, height, and area limits have no confirmation override.
- Repeating an uncertain create with the same idempotency key and payload does
  not create a duplicate; changing the payload with that key is rejected.
- Restart preserves the project area, selected parcel identifiers/geometries,
  CRS, and relevant provenance.

### Out Of Scope

- Arbitrary polygon editing, source-layer acquisition, and downstream spatial
  analysis are separate requirements. They do not change parcel boundaries or
  expand this interactive rectangular project-creation requirement.
