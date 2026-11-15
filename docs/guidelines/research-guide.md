# Research Guide

## Purpose

Research under `docs/research/**` is a dated decision aid. It preserves evidence,
comparison, uncertainty, and conclusions that inform a named requirement,
architecture choice, source selection, implementation slice, or product
decision. It is not an implementation plan, backlog, or permanent history of
completed work.

Each research document answers one cohesive question. Split independent
technologies or decisions into separate records when they can be evaluated or
revisited independently.

Follow the technical-writing rules in
[Engineering Guide](engineering-guide.md#technical-documentation). Present
evidence before conclusions, distinguish accepted and unselected alternatives,
and keep open decisions explicit.

## Required Traceability

Every active or deferred research document makes these items visible near the
top:

- the exact question and decision or requirement it informs;
- status and last evidence-check date;
- completed outputs linked to their durable requirement, specification, domain,
  architecture, or guideline owners;
- unresolved questions;
- the next decision, implementation slice, evidence change, or re-evaluation
  trigger that requires returning to the research.

Use links to stable durable documents, not specific temporary project files.
Progress describes evidence and decision coverage, not implementation tasks.

## Evidence And Conclusions

- Record provenance, observation date, source version, scope, and material
  limitations for time-sensitive or external evidence.
- Prefer primary and authoritative sources for technical claims.
- Distinguish repository observation, owner decision, external fact, inference,
  and proposal.
- Revalidate mutable services, capabilities, laws, prices, product features, and
  provider limits before relying on old evidence for implementation.
- Preserve material reasons for rejecting viable alternatives and state whether
  each is rejected, rejected for now, or deferred.
- Give every deferred alternative a concrete return condition when one is known.
- Keep the current functional description in the
  [specification](specification-guide.md), retaining dated observations and
  comparison evidence here only when needed for a named return condition.
- Do not copy an accepted model into research after its durable owner records it;
  link to that owner and retain only evidence still needed for later work.

## Lifecycle

### Active

Evidence collection or an owner decision remains open. State the next question
or validation action without turning the document into a delivery checklist.

### Deferred

No work is currently planned, but a named trigger requires future return. Keep
the minimum evidence, alternatives, uncertainty, durable-output links, and
trigger needed to resume safely.

### Completed

When the selected path, material constraints, and reasons for rejecting viable
alternatives have durable owners, remove resolved comparisons, candidate
requirements, implementation sequencing, and completed remediation narration.

Delete the research file when no named return condition remains. Before
deletion:

1. preserve unique facts, dates, sources, warnings, and rejected-alternative
   rationale in the appropriate durable owner;
2. repair inbound links;
3. verify that requirements and architecture do not depend on the file for
   facts they should own;
4. rely on Git for historical recovery rather than retaining a closed research
   file as an archive.

## Research Template

```markdown
# <Research Subject>

## Status And Decision Trace

- Status: ACTIVE | DEFERRED
- Evidence checked: <date and scope>
- Provenance: <owner context and source origin>
- Question: <exact question>
- Completed outputs: <durable links or none>
- Open decisions: <remaining choices or none>
- Return before/when: <implementation slice or evidence trigger>

## Findings

## Decision Or Recommendation

## Alternatives Considered

## Open Decisions

## Sources And Limitations
```

Omit empty sections when they do not apply, but never omit the decision trace
for an active or deferred research file.
