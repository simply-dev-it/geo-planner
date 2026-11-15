# Documentation Guide

## Purpose

Each fact or rule has one authoritative home selected by its purpose. This guide
owns the shared documentation categories and their boundaries. Category guides
own their document shape and quality rules; the
[project lifecycle](project-lifecycle.md) owns workflow, acceptance, and closeout.

## Responsibilities

| Owner | Content | Detail guide |
| --- | --- | --- |
| Root README | Purpose, safety boundary, quick start, essential durable entry points | Repository policy |
| Root agent instructions | Permanent owner policy, repository map, and task routing | Owner-controlled repository policy |
| Repository guide | Setup, commands, operations, and repository-specific navigation | Repository policy |
| Specification | Current actor workflows, results, defaults, persistence, and observable limitations | [Specification guide](specification-guide.md) |
| Requirements | Expected functional value, provenance, and acceptance criteria | [Requirements guide](requirements-guide.md) |
| Domain | Terminology, identities, contracts, states, invariants, and safety meaning | [Domain guide](domain-guide.md) |
| Architecture | Technical responsibilities, dependencies, state ownership, and runtime/data flow | [Architecture guide](architecture-guide.md) |
| Research | Dated evidence, comparisons, uncertainty, and decision rationale | [Research guide](research-guide.md) |
| Projects | Temporary proposal, delivery state, decisions, and acceptance evidence | [Project lifecycle](project-lifecycle.md) |
| Guidelines | Reusable standards and category-specific rules | [Engineering guide](engineering-guide.md) |
| Skills | Focused reusable execution procedures | [Skill guide](../../.agents/skill-guide.md) |

## Content Boundaries

A domain description defines meaning independently of interface, persistence,
and deployment; its scope alone does not describe delivered functionality.
Architecture explains technical structure from above. It may retain accepted
target technical decisions when implementation state is explicit. Requirements
record expected value; neither requirements nor target design establish current
support. The specification records actual behavior, including known limitations
and differences from accepted requirements.

Research preserves observations and sources needed to revisit decisions. Move
current functional descriptions to the specification, retaining dated migration
or comparison evidence when a named return condition still needs it. Plans track
bounded active delivery; they are not durable roadmaps or technical owners.

## Maintenance

- Preserve unique facts, constraints, uncertainty, and provenance before moving
  content. Replace duplicate detail with links to its authoritative owner.
- Link general boundaries here from category guides instead of reproducing a
  responsibility map in each one.
- Keep portable procedures separate from repository topology and product facts.
  Repository policy determines the local paths and routing.
- Describe accepted behavior positively. Use the
  [engineering writing rules](engineering-guide.md#technical-documentation)
  for findings, decisions, alternatives, and open questions.
- Follow lifecycle for draft reconciliation, follow-up routing, owner acceptance,
  temporary-plan deletion, and PR publication. Category guides do not grant
  authorization to close a change.
