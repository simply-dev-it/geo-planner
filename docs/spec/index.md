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
| Angular replacement | Open the project workspace and see an unexpected-error alert | Replacement entry below |
| Angular with fixture simulator | Locate sampled public or fictional places and parcels, select an area, preview, create and reopen an in-memory project | [Project and evidence preparation](project-and-evidence.md#replacement-application-simulator-slice) |

These are functional responsibilities, not separate domains, services, or
necessarily separate screens. The legacy views share one map workspace.

## Replacement Entry

The Angular application opens `/projects/new` inside the compact Geo Planner
workspace. Unknown routes return to this entry. An unexpected application error
shows a Polish alert. The map stays visible during search, area editing and
preview/save. See [project preparation](project-and-evidence.md#replacement-application-simulator-slice)
for current behavior and fixture limitations.

The replacement map and project workflow use an offline contract simulator. Acquisition,
sketch workflows, spatial analysis, live geographic providers and durable
backend project storage are not delivered. The backend's test greetings and the
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

Legacy behavior was checked against repository code and configuration on
2026-10-25. The Angular simulator workflow was verified with unit/browser checks
on 2026-11-19 and accepted by the owner for frontend/simulator closeout on
2026-11-20. Production integration remains outside that acceptance.
Legacy interaction evidence and test gaps
remain in the [migration inventory](../research/prototype-behavior-inventory.md).

- [Requirements portfolio](../requirements/index.md): expected outcomes and acceptance.
- [Architecture](../architecture/target-product.md): current and accepted target technical boundaries.
- [Legacy runtime](../architecture/legacy-map-build.md): build, parser, and persistence mechanisms.
- [Repository guide](../guidelines/repository-guide.md) and [legacy operation](../../mapa/README.md): commands and setup.

Implementation evidence: [Angular workspace](../../frontend/src/app/features/project-creation/project-creation-page.html),
[routes](../../frontend/src/app/app.routes.ts), and
[application error presentation](../../frontend/src/app/app.html).
