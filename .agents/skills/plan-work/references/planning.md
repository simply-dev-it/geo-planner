# Planning Reference

## Proposal Content

Define a positive, reviewable outcome and the behavior delivered by the project.
The plan describes:

- the problem and intended outcome;
- positive in-scope behavior;
- confirmed decisions, assumptions, and open questions;
- existing code and library reuse choices;
- affected components, ownership, and data/runtime flow;
- failure behavior, data safety, and migration impact;
- implementation stages;
- automated and manual verification;
- acceptance criteria.

Keep non-goals short. Include only an adjacent capability that a reader could
reasonably mistake as part of the outcome and whose exclusion affects the design. Do
not inventory the rest of the product, enumerate unrelated providers or platforms,
or include a sequence of future projects.

## Design Review

Before implementation, inspect and make each materially affected surface reviewable:

1. **Scope and assumptions** — intended outcome, in-scope behavior, boundaries,
   and unresolved product assumptions.
2. **Architecture and component composition** — show the affected components from
   above: their responsibilities, dependency directions, state ownership, and
   data/runtime flow. When component relationships materially affect the design,
   draw a multi-line plain-text diagram with the actual components and labeled
   connections. Keep file, class, and method details out of this view.
3. **Planned code composition** — for structural code changes, draw a separate
   multi-line file/type tree. Mark existing, modified, and new files; place planned
   classes, interfaces, and key methods inside their intended files, and show local
   calls or ownership where they clarify the change. Use real planned names or mark
   undecided names as provisional. A single arrow between two names is not a
   composition diagram.
4. **Reuse analysis** — identify existing modules, classes, and patterns to reuse.
   For functionality outside the repository, assess suitable stable libraries
   against target compatibility and maintenance before proposing custom code.
   Record the selected approach and its reason.
5. **UI** — for user-facing changes, provide low-fidelity mockups of primary screens,
   components, relevant states, and responsive breakpoints. For material UI changes,
   include a self-contained HTML mockup that is interactive when navigation or state
   transitions materially affect the design. Keep it with the active plan by
   default. When the owner wants a reusable visual reference, keep the mockup in the
   repository's design area and link to it from the plan without duplicating the
   working file. It must run locally without a build, server, network access, or
   external assets,
   use fixture-only data, and perform no persistence or other side effects. Provide
   representative mobile-portrait and desktop-landscape viewport presets plus any
   materially different intermediate breakpoint. Link the mockup from the plan and
   state how to open it. When the primary review surface cannot safely run local
   HTML, include a directly readable static fallback sufficient to assess the
   affected layouts and states. Treat mockups as design evidence, not production
   implementation or acceptance evidence. A retained reference stays a proposal
   until the related behavior is implemented and accepted.
6. **UX** — navigation and interaction flows plus applicable content, empty,
   loading, offline, unavailable, validation, and failure states.
7. **Delivery** — implementation stages, migration and safety behavior,
   verification, and acceptance evidence.

Small copy, styling, or isolated maintenance changes may omit unaffected surfaces with
a short explanation. Use diagrams to expose intended placement and relationships,
not as decoration.

## Owner Decisions

For a new material choice outside the authorized scope, present one decision cluster:
the evidence, exact choice, viable options, material tradeoffs, and a recommendation
when supported. Ask the smallest question that resolves it, record the decision, and
pause only dependent implementation until it is resolved. Do not split one plan into
routine approval checkpoints.

## Project Template

````markdown
# [Change name]

## Status

- Phase: [Repository phase or status]

## Problem And Outcome

## Scope And Non-goals

## Decisions And Assumptions

## Open Decisions

## Reuse Analysis

## Planned Code Composition

```text
module/
├── [modify] path/ExistingFile.ext
│   └── ExistingType
│       ├── add resolve(input): Result
│       └── calls NewType.validate(input)
└── [new] path/NewFile.ext
    └── NewType
        └── validate(input): Result
```

## Architecture And Component Composition

```text
[Presentation]
    │ commands ↓ / view state ↑
    ▼
[Application] (owns workflow state)
    │ reads / writes
    ▼
[Data boundary] (owns durable data)
```

## UI And UX Proposal

[For user-facing work: mockups, responsive variants, flows, and states.]

## Data Or Runtime Flow

## Failure Behavior, Safety, And Migration

## Implementation Plan

1. [pending] [Implementation step]

## Verification And Acceptance

- `[Verification command]`
- [Relevant manual check]

## Result

- [Temporary implementation summary]
````

Use repository progress markers when defined; otherwise use `[pending]`,
`[in-progress]`, and `[done]`. Omit unaffected decision surfaces with a short
explanation when their absence would otherwise be ambiguous.
