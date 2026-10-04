# Geo Planner

Geo Planner is being rebuilt as an Angular client backed by a Kotlin/Spring
Boot application. The current repository contains the application foundation;
the target product will organize map evidence, projects, acquisition, sketches,
and spatial analysis while preserving provenance and uncertainty.

Government, cadastral, planning, utility, and derived layers are informative
unless an authoritative source and validation process explicitly establish
otherwise. Sketches are not surveying or legal evidence.

The Python/HTML implementation under `mapa/**` remains available as the legacy
application and as migration evidence until its capabilities are replaced.
Its operating instructions live in `mapa/README.md`.

## Quick Start

Install the pinned tools and local dependencies once:

```bash
mise install
mise run setup
```

Start the backend and frontend in separate terminals:

```bash
# terminal 1
mise run start backend

# terminal 2
mise run start frontend
```

Open `http://localhost:4200`. The current replacement is an application
foundation; the retained working map is started separately according to
[Legacy map operation](mapa/README.md).

For focused development, run `mise run start simulator` instead of the backend when
an accepted deterministic contract scenario exists, or `mise run start storybook`
to start the UI workshop.

After making changes, run the repository-wide verification gate:

```bash
mise run verify
```

Use `mise run build frontend` or `mise run build backend` to produce application
artifacts, or `mise run build --all` to include the simulator and Storybook.

## Documentation

- [Repository setup and commands](docs/guidelines/repository-guide.md)
- [Target product architecture](docs/architecture/target-product-architecture.md)
- [Acquisition and artifact flow](docs/architecture/acquisition-and-artifact-flow.md)
- [Spatial Evidence domain](docs/domain/spatial-evidence.md)
- [Legacy map model and safety contracts](docs/domain/legacy-map-model.md)
- [Requirements portfolio](docs/requirements/index.md)
- [Legacy map operation](mapa/README.md)
