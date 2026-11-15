# Requirements Guide

## Purpose

Product requirements capture concrete functional value that must be preserved or introduced. They explain what a user can accomplish, which real business/data integration enables it, and how the result is accepted end to end.

Use the [documentation guide](documentation-guide.md) for boundaries with the
current specification, domain, architecture, research, and delivery plans.

## Organization And Indexing

`docs/requirements/index.md` is the portfolio index. Requirements are grouped
by application area: a cohesive product module or user-facing responsibility,
not a business-domain model and not one file per requirement. Each area has one
`docs/requirements/<application-area>.md` file with:

- a short area purpose and boundary;
- an area index listing every requirement ID, delivery stage, status,
  priority, and title;
- the full requirement records below the index.

The portfolio index links the application-area files and aggregates:

- total requirements and `VERIFIED` requirements per application area;
- totals by delivery stage;
- totals by status;
- one grand total across all areas.

Update the area index and any portfolio summary in the same change as a
requirement addition, removal, status change, stage change, split, or merge.
Use the repository-owned indexing command. The aggregate verification task
must reject stale generated summaries. Stable requirement IDs are never reused.

## Requirement Statuses

| Status | Meaning |
| --- | --- |
| `DRAFT` | Evidence-backed candidate that has not been accepted. |
| `ACCEPTED` | Accepted requirement; implementation is not authorized by this status. |
| `IMPLEMENTED` | Behavior exists but has not passed end-to-end acceptance. |
| `VERIFIED` | Behavior passed end-to-end acceptance and counts as completed. |
| `DEFERRED` | Valid requirement intentionally postponed. |
| `REJECTED` | Requirement retained for traceability but not selected for delivery. |

`DEFERRED` and `REJECTED` remain visible in portfolio statistics but do not
count as completed.

## Delivery Stages

The requirements index defines the repository's delivery-stage vocabulary and
meaning. Stages describe product delivery order, not requirement status or
technical implementation sequence. A requirement moves between stages only
through an authorized product decision. Dependencies needed for an earlier
stage must be visible in that requirement rather than hidden in a later-stage
story.

## Authorization And Timing

- Only the authority named by repository policy can approve a project for implementation or requirements discovery.
- Do not infer approval from a request to edit, review, expand, or discuss a plan.
- Create requirements only from authorized discovery and sufficient evidence;
  discard unsupported drafts instead of promoting them as a speculative backlog.
- Creating or accepting a requirement does not authorize implementation. A selected coherent feature still receives its own temporary project plan.

## What Belongs In Requirements

A functional requirement belongs in its application-area file when it identifies:

- a real actor and concrete goal;
- observable business or analytical value;
- observed current or legacy behavior to preserve, or an explicitly requested new behavior;
- a named external system, dataset, document, or workflow when integration is involved;
- realistic inputs and outputs, including representative examples;
- success, empty, degraded, and failure behavior visible to the user;
- acceptance criteria that can be demonstrated end to end;
- provenance showing where the requirement came from.

Examples of appropriate requirement subjects:

- retrieve a record through a named external operation and return a usable result;
- acquire a selected dataset and display its provenance and freshness;
- preserve an optional integration failure as a visible warning while retaining other usable results;
- import a concrete legacy artifact without duplicating records.

Non-functional behavior belongs here only as an acceptance constraint necessary
to deliver functional value. Do not disguise a framework or tooling concern as
a standalone product story such as “As a developer, I want a reproducible
build.”

## Discovery Workflow

1. Inspect the actual workflow and record what the user does, sees, saves, and exports.
2. Trace supporting implementation and configuration when existing behavior is evidence.
3. Identify every external source and exact operation, layer, document, request input, and response form.
4. Capture success, no-data, optional failure, hard failure, stale data, and privacy behavior.
5. Decide with the owner which behavior is intentional, accidental, obsolete, or missing.
6. Group accepted behavior by cohesive application area.
7. Write concrete functional stories only from accepted evidence.
8. Review stories one application area at a time, following the interactive
   decision gates in `project-lifecycle.md`. Present a compact area index, then
   each requirement's outcome, contract, acceptance, and unresolved decisions.
   Never infer acceptance, deferral, rejection, split/merge, priority, or
   delivery-stage decisions.

## Requirement Template

```markdown
## <AREA-ID> — <Short verb-object capability>

- Status: <requirement status>
- Priority: MUST | SHOULD | COULD
- Delivery stage: <repository-defined stage>
- Source evidence: <files, observed behavior, provider documentation, authorized decision>

### Outcome

<Actor, concrete result, and value in one short paragraph.>

### Contract

- Input: <realistic input>
- Sources: <exact system, dataset, operation, layer, or none>
- Output: <observable result>
- Degraded/failure behavior: <what the user sees and what is preserved>

### Acceptance Criteria

- Given <specific state>, when <specific action>, then <observable result>.
- <empty/degraded/failure behavior>

### Open Decisions

- <decision required from the authorized decision-maker or research>
```

Keep each record short and unambiguous. Use a verb-object title, state each fact
once, prefer compact bullets over narrative flow, and link to research instead
of copying its full evidence. A requirement is still incomplete if brevity
removes its user value, concrete contract, degraded/failure behavior, acceptance
criteria, or provenance.

## Quality Gate

A requirement is not ready for owner acceptance when:

- it could apply unchanged to almost any backend;
- its value is primarily a framework/tooling concern;
- it does not name the concrete workflow or integration;
- inputs, outputs, and failure behavior are unknown;
- acceptance can be satisfied by scaffolding or a unit test without demonstrating user value;
- it was written before the discovery evidence existed.
