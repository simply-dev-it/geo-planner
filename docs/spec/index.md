# Application Specification

## Scope And Reading Map

This is the functional description of the application currently present in the
repository. It describes what users and operators can do, observable results,
state changes, and actual limitations. Requirements describe expected value;
accepted requirements are not proof of delivered functionality.

| Runtime | Available behavior | Functional view |
| --- | --- | --- |
| Retained Python/HTML application | Prepare one configured project and explicitly refresh its evidence | [Project and evidence preparation](project-and-evidence.md) |
| Retained Python/HTML application | Navigate, compare layers, and inspect parcels | [Map and layer viewing](map-and-layers.md) |
| Retained Python/HTML application | Draw, inspect, remove, persist, and export private sketches | [Sketches](sketches.md) |
| Angular replacement | Open an application foundation page and see an unexpected-error alert | Replacement foundation below |

These are functional responsibilities, not separate domains, services, or
necessarily separate screens. The legacy views share one map workspace.

## Replacement Foundation

The Angular application opens a page headed
`Nowy interfejs jest przygotowany do migracji funkcji.` inside the Geo Planner
frame labelled `Fundament aplikacji`. Unknown routes redirect to this page.
The page explains that it does not yet replace the working map. An unhandled
application error displays a Polish alert directing the user to the developer
console.

There is no map, project creation, acquisition, sketch workflow, or spatial
analysis in the replacement UI. The backend's test greetings and the
simulator's health response are development facilities, not business features.
They do not make any target requirement implemented or verified.

## Interpretation Boundary

The working map supports exploration and communication using source evidence,
configured owner metadata, and private indicative sketches. It does not
establish legal rights, cadastral accuracy, utility completeness, or planning
certainty. Exact evidence classes and safety invariants belong to the
[legacy domain](../domain/legacy-map-model.md) and
[Spatial Evidence domain](../domain/spatial-evidence.md).

Measured sketch intersections and land-class percentages are unavailable in
both applications. Configured parcel percentages are owner metadata. The
expected analysis remains in [requirements](../requirements/spatial-analysis.md).

## Evidence And Adjacent Owners

Behavior checked against repository code and configuration on 2026-10-25;
this documentation migration did not revalidate public providers or perform a
new browser acceptance session. Legacy interaction evidence and test gaps
remain in the [migration inventory](../research/prototype-behavior-inventory.md).

- [Requirements portfolio](../requirements/index.md): expected outcomes and acceptance.
- [Architecture](../architecture/target-product.md): current and accepted target technical boundaries.
- [Legacy runtime](../architecture/legacy-map-build.md): build, parser, and persistence mechanisms.
- [Repository guide](../guidelines/repository-guide.md) and [legacy operation](../../mapa/README.md): commands and setup.

Implementation evidence: [Angular page](../../frontend/src/app/features/foundation/foundation-page.html),
[routes](../../frontend/src/app/app.routes.ts), and
[application error presentation](../../frontend/src/app/app.html).
