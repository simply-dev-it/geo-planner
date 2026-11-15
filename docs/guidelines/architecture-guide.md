# Architecture Documentation Guide

## Purpose

Architecture documents define how accepted product behavior is structured and
operated: component responsibilities, dependencies, state ownership, runtime
and data flow, persistence, failure recovery, security, and deployment
boundaries. They describe current implementation or accepted target design;
shared boundaries with functional specification, requirements, research, and
plans are defined by the [documentation guide](documentation-guide.md).

Exact API shapes belong to an accepted contract artifact such as OpenAPI and
its implementing slice. Do not preserve speculative endpoint tables in durable
architecture.

## Document Shape

Near the top, state whether the document is **current** or **target**, how much
is implemented, what boundary it owns, and which adjacent durable documents own
domain meaning, requirements, and evidence.

Use only relevant sections, normally in this order:

1. **Status And Scope**;
2. responsibilities and component composition;
3. runtime or data flow and state ownership;
4. persistence, failure, restart, and migration behavior;
5. security, privacy, deployment, and operational boundaries;
6. accepted alternatives or open decisions when they remain useful.

An overview may route to focused architecture documents. A focused document
owns one coherent boundary or flow and should link back to the overview rather
than restating the whole system.

## Diagrams

Use Mermaid when relationships among three or more components, state owners, or
flow stages are materially easier to assess graphically.

- Keep diagrams focused and explain consequential boundaries in nearby text.
- Distinguish current components, accepted target capabilities, and planned
  delivery visually and in the legend.
- Show authoritative state writes and failure paths independently of success
  artifacts or transient client updates.
- Do not imply a runtime call, persistence guarantee, or implemented capability
  merely to make a diagram symmetrical.

## Evolution Rules

- Describe observed current behavior separately from accepted target design.
- Record durable design decisions and constraints, not implementation history.
- Keep provider SDKs, filesystem paths, and vendor DTOs behind the ports whose
  semantics they implement.
- Preserve failure, cancellation, restart, data-safety, and migration behavior;
  a success-only flow is incomplete when state can outlive a process.
- Revalidate mutable provider or platform facts through research before an
  implementation slice depends on them.

## Review Checklist

- Is current versus target implementation state explicit?
- Are responsibilities, dependency direction, state ownership, and flow clear?
- Are failure, cancellation, restart, migration, privacy, and security covered
  where applicable?
- Does domain meaning remain in domain, current observable behavior in the
  specification, and expected value and acceptance in requirements?
- Do diagrams and prose describe the same model without speculative contracts?
