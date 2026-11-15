# Domain Documentation Guide

## Purpose

Domain documents define product meaning independently of UI, transport,
persistence, providers, and deployment. Create or split one only when a stable
set of concepts or invariants needs an authoritative owner; a document does not
automatically declare a bounded context, module, or service.

Configuration or serialized fields belong in domain only when they form a
stable product data contract. File paths, framework types, parser procedures,
HTTP shapes, and storage-provider details do not.

Use the [documentation guide](documentation-guide.md) for shared category
boundaries.

## Document Shape

Use only sections that help explain the model. Near the top, state:

- the named problem space and whether the document describes current, legacy,
  or target meaning;
- the terminology, contracts, and invariants it owns;
- adjacent durable owners for requirements, architecture, or evidence.

A useful order is:

1. **Status And Scope**;
2. concepts, identities, and relationships;
3. states, transitions, and invariants;
4. safety meaning and uncertainty boundaries;
5. links to requirements, architecture, or research for detail owned elsewhere.

Use a compact table for repeated concept definitions and Mermaid only when a
state model or relationship is materially clearer as a diagram. Do not add
decorative metadata or repeat the same contract in multiple domain files.

## Evolution Rules

- Describe accepted meaning positively and keep proposals or alternatives out
  of the current model.
- Keep legacy meaning explicitly separate from the target model while both are
  needed for migration evidence.
- Split a document when two concept groups change for different reasons or
  have different authoritative owners, not merely because it is long.
- Do not infer multiple domains or bounded contexts before product and
  implementation evidence supports that boundary.
- When implementation exposes a missing invariant, update the domain owner and
  the affected requirements or architecture rather than documenting it only in
  code.

## Review Checklist

- Does every statement define meaning, identity, state, an invariant, or a
  safety claim?
- Are runtime sequence, parser mechanics, storage layout, and deployment kept
  in architecture?
- Are current user workflows linked to the specification, and expected
  outcomes and acceptance linked to requirements rather than duplicated?
- Are source claims and unresolved evidence linked to research?
- Is current, legacy, and target meaning unambiguous?
