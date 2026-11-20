# Repository Guide

## Environment

Root-level `mise.toml` pins the JDK and Node.js versions used by the Kotlin
backend, Angular frontend, OpenAPI Generator, and Node contract simulator.
Gradle uses the committed wrapper. The frontend and simulator have independent
npm lockfiles. Python 3, Bash, and `curl` support the retained legacy
application and requirements-index helper; they are not runtimes of the new
application.

Install tools and local dependencies from the repository root:

```bash
mise install
mise run setup
```

## Documentation Routing

The [application specification](../spec/index.md) describes current business
behavior, grouped by functional responsibility and labelled by runtime.
Before planning, reviewing, or changing a product workflow, read its current
specification alongside requirements, domain, and architecture. Maintain it
using the [specification guide](specification-guide.md).

Use the [documentation guide](documentation-guide.md) for shared category
responsibilities and the [project lifecycle](project-lifecycle.md) for workflow
selection, acceptance, and PR readiness.

## Root Tasks

Run from the repository root with `mise run <task> [parameters]`:

| Task | Parameters | Purpose |
| --- | --- | --- |
| `setup` | `--ci` optional | Install npm dependencies and Chromium; CI uses lockfiles and browser system dependencies. |
| `start` | `frontend`, `backend`, `simulator`, `storybook`, or `--all`; `frontend` also accepts `--simulator` | Start selected services; `--simulator` enables the frontend proxy. |
| `build` | `frontend`, `backend`, `simulator`, `storybook`, or `--all` | Build production artifacts. |
| `verify` | `frontend`, `backend`, `simulator`, `requirements`, `legacy`, or `--all` | Run selected quality gates; no parameters runs every gate. |
| `ci` | — | Run `setup --ci`, then `verify --all`. |
| `clean` | — | Remove generated application and test outputs. |

For example: `mise run start frontend`. Choose one target or `--all`.
`start` and `build` without parameters show help; `<task> --help` lists options.
The hidden `verify-legacy` task remains equivalent to `verify legacy`.

Aggregate `verify` includes task validation, workflow tests, local Markdown links,
requirements and all component checks. Legacy checks use checked-in snapshots without source refresh.
Setup is explicit; builds and verification may download missing dependencies.
Builds do not publish, and clean preserves legacy files and local user data.

## Components

### Backend

`backend/` is the Kotlin/Spring Boot application. Use `mise run start backend` and
`mise run verify backend` or, for a focused local check, the Gradle wrapper:

```bash
./gradlew :backend:check
./gradlew :backend:bootRun --console=plain
```

### Frontend

`frontend/` is the Angular CLI workspace. The root application uses `src/`;
reusable presentation code lives in `projects/ui/`; generated transport,
mapping, and application API boundaries live in `projects/geo-planner-api/`.

```bash
npm --prefix frontend start
npm --prefix frontend run start:simulator
npm --prefix frontend run storybook
npm --prefix frontend run test:unit
npm --prefix frontend run e2e
npm --prefix frontend run verify
npm --prefix frontend run api:generate -- "$PWD/docs/architecture/contracts/interactive-v1.openapi.yaml"
```

OpenAPI generation owns
`frontend/projects/geo-planner-api/src/lib/generated/`; never hand-edit its
output. Transport DTOs are mapped under `mappers/` and wrapped by the
application-facing `facade/` only when an accepted capability requires them.
Runtime deployment configuration is read from
`frontend/public/runtime-config.json`; `apiBaseUrl` must remain a same-origin
absolute path. For fixture-only development, start the simulator and proxied
frontend in separate terminals:

```bash
mise run start simulator
mise run start frontend --simulator
```

The simulator listens on port 4300 and the frontend on port 4200. If either
port is already in use, stop or reconfigure that service yourself before
starting. The normal `mise run start frontend` command does not enable the
proxy. The simulator combines frozen public samples with named synthetic fault fixtures.
Ciężkowice has an archived orthophoto crop; captured public streets provide sparse
vector context elsewhere. This is partial offline coverage, not a live basemap.
The simulator-only frontend configuration also enables a development catalogue
button after confirming simulator health. A production build neither probes
simulator endpoints nor exposes that catalogue. Search and area preferences are
validated, versioned local browser state; project persistence remains server-owned.
The full [fixture catalogue](../architecture/simulator-fixtures.md) lists all
administrative filters, places, streets, parcel numbers and fault scenarios.

After simulator source changes, stop its process and rerun
`mise run start simulator`: this command rebuilds once and does not hot reload.
Rebuilding alone leaves a running Node process serving the old fixtures. A stale
process can return blank tiles (`X-Simulator-Fixture: transparent-1px-png`) and
street candidates without context; current tile markers distinguish schematic,
archived orthophoto and captured public-vector tiles in the
[fixture catalogue](../architecture/simulator-fixtures.md). Reload the browser after restarting. Restarting clears
the simulator's in-memory projects and idempotency records.

The Angular persistent disk cache is disabled because the current transitive
native cache acceleration is unstable with the pinned Node.js build on macOS
ARM. This affects build speed only and can be revisited after the dependency is
corrected.

### Contract Simulator

`backend-simulator/` is a loopback-only Node adapter for frontend development.
It exposes `GET /_simulator/health` and provisional interactive v1 project,
search, parcel and tile routes. These use frozen public samples, synthetic fault
fixtures and process-local state, so they do not prove live provider coverage or durable persistence. Product routes,
payloads, fixtures, and named scenarios enter only with authorized contract
slices; the simulator never defines the contract.

```bash
npm --prefix backend-simulator run verify
mise run start simulator
```

### HTTP Examples

`http-client/` contains developer HTTP requests for implemented backend endpoints
and explicitly manual public-provider research requests. The
[public provider handoff](../architecture/public-api-integration.md) maps upstream
operations and filters to the provisional interactive OpenAPI. Real provider
adapters remain owner-implemented. Keep examples secret-free; external probes
are separate from ordinary builds and verification.

## Requirements Index

After changing a requirement, its status, priority, or delivery stage, update
the area index and regenerate the portfolio tables:

```bash
./scripts/update_requirements_index.py
```

The `mise run verify requirements` command compiles and unit-tests the index helper,
then runs the read-only check and rejects stale statistics.

## Pull Request Description

Before creating a PR, complete the owner-acceptance and documentation gates in
[Project Lifecycle](project-lifecycle.md#pull-request-readiness). This section
owns the repository's description format, not publication authorization.

Use `.github/pull_request_template.md` when creating or updating a pull request
unless the owner requests another structure. GitHub can surface it during
normal PR creation; API- or agent-driven creation must apply it explicitly.
Keep the four headings even when a section is brief:

- `What Changed`: implemented behavior and main repository areas changed;
- `Why`: the problem, rationale, and material accepted decisions;
- `Impact`: migration, compatibility, operations, data safety, and user impact;
- `Verification`: actual commands and checks, separating passed, failed, and
  not-run work.

Derive the description from the final diff and observed verification, not
intended work. Never imply that a failing or skipped gate passed. Summarize
durable decisions directly instead of linking to a temporary project file.

## Generated And Local Files

Build output, test reports, browser artifacts, local runtime state, and generated
clients follow their owning tool's ignore rules. Do not edit generated output
as source or commit private runtime data.

The `mapa/**` tree remains a runnable legacy application and migration reference.
Use `mapa/README.md` for its build, editor, interaction, configuration, source
refresh, and safety instructions. New application work must not change legacy
code, configuration, templates, or tracked data incidentally. Source refresh
always requires an explicit request because it replaces checked-in evidence.

Before writing migration requirements, authorized discovery must inspect the
implemented legacy behavior, external integrations, data, errors, and user
workflows. Produce requirements only after the behavior inventory,
characterization evidence, and integration analysis are available. Discard
unsupported drafts instead of retaining a speculative migration backlog.

## Troubleshooting

- Missing tools: run `mise install`, then confirm `mise current`.
- Missing npm dependencies or browser: run `mise run setup`.
- Backend dependency resolution failure: retry the focused Gradle task after
  confirming network and repository availability.
- Stale requirement totals: run the requirement-index updater, then
  `mise run verify requirements`.
- Frontend API generation failure: confirm the supplied OpenAPI file exists and
  is authorized for the target frontend; simulator contracts may remain
  provisional until the owner integrates the backend.
