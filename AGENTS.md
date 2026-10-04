# Agent Briefing

Use this file to select repository context. Read every routed document for the
touched area before planning, reviewing, or changing it. Keep detailed rules in
`docs/**` and reusable work procedures in `.agents/skills/**`.

## Required Workflow

- For non-trivial work, follow `docs/guidelines/project-lifecycle.md`. An
  explicit request to plan and execute in one task lets the project enter
  `APPROVED FOR IMPLEMENTATION` for that named scope. Ordinary reversible
  decisions need no further approval; a newly discovered material owner
  decision still blocks dependent work until accepted.
- Respect stream ownership: Codex implements the Angular frontend under owner
  review; the owner implements the Kotlin backend under Codex review. Do not
  modify backend production code unless explicitly requested for a named scope.
- Treat `AGENTS.md` as owner-controlled permanent policy. Do not change it
  unless the owner explicitly requests that exact change or approves wording.
- Persist accepted reusable ways of working in an agnostic guideline or skill.
  Persist repository topology, routing, product constraints, and architecture
  in project-specific documents. Do not rely on conversational memory.
- Keep active plans under `docs/projects/**`; remove completed plans only after
  accepted decisions are reflected in durable docs.
- Do not start another project plan while one is active. Finish it or obtain an
  explicit decision to suspend or abandon it first.
- Keep code and technical documentation in English. Preserve Polish user-facing
  text and source terminology where they are part of the product or evidence.

## Documentation Boundary

- Reusable but locally owned and allowed to evolve with reviewed repository needs:
  `.agents/skills/**`,
  `docs/guidelines/engineering-guide.md`, domain and architecture documentation
  guides, technology engineering guides,
  `docs/guidelines/project-lifecycle.md`, `docs/guidelines/research-guide.md`, and
  `docs/guidelines/requirements-guide.md`.
- Repository-specific and recreated for another repository: root `README.md`,
  `AGENTS.md`, `docs/guidelines/repository-guide.md`, and all content under
  `docs/architecture/`, `docs/domain/`, `docs/requirements/`,
  `docs/research/`, and `docs/projects/`.
- Keep the primary repository README at the root. The retained legacy
  application may keep `mapa/README.md` as the single exception while it remains
  runnable. Put other operational detail in the repository guide and durable
  technical detail in its owning docs category.
- Do not link agent-facing reusable guides from the root README. The
  repository guide is the only guideline linked there because it owns human
  setup and command discovery.

## Repository Map

| Path | Responsibility |
| --- | --- |
| `README.md` | Project purpose, safety boundary, quick start, and essential documentation links. |
| `INBOX.md` | Unstructured owner input awaiting interactive classification. |
| `mise.toml` | Pinned toolchain and authoritative repository task graph; `[tasks.verify]` is the aggregate quality gate. |
| `frontend/` | Angular application, reusable UI library, generated API boundary, and browser tests. |
| `backend/` | Owner-implemented Kotlin/Spring Boot application and backend tests. |
| `backend-simulator/` | Loopback-only Node contract simulator for accepted frontend scenarios. |
| `http-client/` | Secret-free developer HTTP examples for implemented backend contracts. |
| `mapa/**` | Retained runnable legacy application and migration evidence; operational instructions live in `mapa/README.md`. |
| `tests/**` | Legacy characterization tests invoked by the aggregate verification gate. |
| `scripts/update_requirements_index.py` | Requirements portfolio index generator and checker. |
| `scripts/verify.sh` | Internal implementation of the legacy mise verification component; not the aggregate entry point. |
| `docs/domain/**` | Product terminology, data contracts, invariants, and safety meaning. |
| `docs/guidelines/**` | Reusable practices plus the project-specific repository guide. |
| `docs/architecture/**` | Current and target runtime, storage, and data-flow descriptions. |
| `docs/requirements/**` | Evidence-backed product requirements and project-specific delivery stages. |
| `docs/projects/**` | Temporary bounded proposals and active implementation plans. |
| `docs/research/**` | Durable investigations, evidence, comparisons, and conclusions. |
| `.agents/skills/**` | Reusable repository-agnostic planning, implementation, documentation, triage, and review procedures. |

## Task Routing

| Task or touched area | Read before work |
| --- | --- |
| Any repository change | `docs/guidelines/repository-guide.md` and `docs/guidelines/engineering-guide.md` |
| Product concepts, spatial data, provenance, uncertainty, or safety | `docs/guidelines/domain-guide.md`, relevant `docs/domain/**`, and `docs/requirements/**` |
| Runtime boundaries, persistence, storage, API contracts, or integrations | `docs/guidelines/architecture-guide.md`, relevant `docs/architecture/**`, and `docs/research/**` |
| Requirements discovery or writing | `docs/guidelines/requirements-guide.md`; create requirement files only after owner-authorized discovery |
| Research creation, review, or closeout | `docs/guidelines/research-guide.md`, relevant durable docs, and the active project when applicable |
| Angular feature, API client, component, state, rendering adapter, or frontend test | `docs/guidelines/angular-engineering-guide.md`, `docs/architecture/target-product.md`, accepted requirements, and a feature-specific plan |
| Planned Kotlin/Spring backend, provider adapter, or persistence | accepted requirements, `docs/guidelines/kotlin-backend-engineering-guide.md`, relevant architecture and research, and a backend plan |
| Kotlin/Spring backend review | all backend documents routed above |
| Non-trivial planning and delivery | `docs/guidelines/project-lifecycle.md` and the active `docs/projects/**` file |
| Loose notes, links, ideas, or requirements | `INBOX.md` and relevant requirement/domain/research docs |
| Documentation or repository routing | the relevant category guide, implemented behavior, and affected durable docs |
| Legacy application use or migration evidence | `mapa/README.md`, the minimum necessary implementation files, relevant domain docs, and migration research |

## Repository-Specific Instructions

- The legacy application under `mapa/**` may be built, run, and used according
  to `mapa/README.md`. Do not modify its code, configuration, templates, or
  tracked data unless the owner explicitly requests a named legacy scope.
- Do not refresh legacy external sources unless explicitly requested. A build
  or verification using checked-in snapshots is not a source refresh.
- Treat ignored legacy `manual-overlays.json` as private local user data. Never
  stage, clear, normalize, copy, or replace it.
- Use `mise run verify` as the aggregate repository gate; it includes the
  retained legacy application. Use `mise run verify-legacy` only for a focused
  legacy check and do not invoke `scripts/verify.sh` directly.
- Keep network refresh and live product integrations separate from normal build,
  tests, hot reload, and verification.
- Do not claim legal, cadastral, utility, planning, or analytical certainty from
  preview data. Preserve source dates, provenance, and uncertainty.
- Generated clients and build artifacts are tool-owned; regenerate them through
  their documented task rather than editing them manually.
