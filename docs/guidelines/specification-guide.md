# Functional Specification Guide

## Purpose

Describe the application as implemented: what an actor can do, under which
conditions, what happens, what persists, and what limitations or failures the
actor encounters. Include operator workflows when they provide product value.
Describe actual behavior even when it differs from an accepted requirement.

The [documentation guide](documentation-guide.md) defines adjacent content
owners. The [project lifecycle](project-lifecycle.md) defines when drafts are
prepared, reconciled, and removed, and who accepts the completed change.

## Functional Views

Start with `docs/spec/index.md` as the current capability map. Group details by
coherent actor goal or functional responsibility. Several views may share a
screen; one view may span multiple screens or an operator action. Do not split
by framework, controller, service, individual requirement, or speculative domain.
Split only when responsibilities can be understood and maintained separately.

Each capability has one authoritative functional description. Indexes and other
categories link to it. While multiple runtimes coexist, label their support
explicitly and distinguish differences; migration acceptance remains separate
from describing current behavior. Do not create empty views for future features.

## Document Shape

Use proportionate sections, normally:

1. **Scope**: actor, goal, runtime, supported entry conditions.
2. **Workflow**: inputs, actions, decisions, and observable outcomes.
3. **State and rules**: defaults, validation, persistence, interaction between
   actions, and reload/restart behavior.
4. **Failure and limitations**: empty, unavailable, partial, stale, invalid,
   cancelled, or failed behavior where applicable, including preserved data.
5. **Evidence and adjacent owners**: implementation and meaningful test links,
   related requirements, domain, architecture, and research.

Preserve product labels in their source language. Use realistic but public or
synthetic examples. Do not copy private project data, source bodies, transport
schemas, storage layouts, or command catalogs into the specification. Link to
their owners. State the actual level of evidence: code inspection, automated
checks, and browser/owner acceptance are different claims.

## Draft Representation

On a change branch, keep the implemented description intact. Add a clearly
separated `## Planned Change (Draft)` section to the affected view, or label an
entire new view as draft when the capability does not yet exist.

Describe the proposed functional result, affected workflows, defaults,
validation, persistence, and failure states. Link relevant requirements and
state unresolved choices. Keep delivery checklists in the project.

During implementation, distinguish current behavior from the remaining draft.
Promote only behavior supported by implementation evidence into current
sections. Record actual deviations and limitations. A draft, specification
update, or passing test does not establish owner acceptance.

Reconcile and remove drafts under the lifecycle closeout rules. This guide owns
their functional content and representation, not the delivery gate.

## Review Checklist

- Is each claim supported by implementation and its evidence limits stated?
- Can a reader distinguish current runtimes, actual limitations, and branch drafts?
- Are user actions, defaults, state, failure, and persistence behavior sufficient
  to understand the feature without reading technical design?
- Is each fact in its owning category, with links replacing duplicate detail?
- Is draft content clearly separated from current behavior and traceable to
  the affected workflow?
- Does the current view reflect the implementation and its actual evidence?
