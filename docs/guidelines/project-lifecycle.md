# Project Lifecycle

## Purpose

Files under `docs/projects/**` are temporary records for bounded, non-trivial
changes. A project makes its outcome, decisions, implementation state, risks,
and acceptance evidence reviewable while work is active. It is not a permanent
roadmap, reusable procedure, or durable architecture owner.

The execution procedures for planning, implementation, documentation, inbox
triage, and specialized review live in their repository skills. This guide owns
the lifecycle, acceptance and publication gates, and required shape of a
project record. These delivery gates also apply to changes without a plan,
including documentation-only work. The
[documentation guide](documentation-guide.md) owns shared content categories;
the [specification guide](specification-guide.md) owns functional document shape
and draft representation.

## Workflow Routing

Use the applicable procedure while preserving repository policy and the
accepted scope. Skills do not grant authority to advance owner-controlled gates.
Skill structure and portable procedures follow the
[skill guide](../../.agents/skill-guide.md).

| Work | Procedure |
| --- | --- |
| Proposal and planning | [plan-work](../../.agents/skills/plan-work/SKILL.md) |
| Implementation | [implement-change](../../.agents/skills/implement-change/SKILL.md) |
| Durable documentation, including documentation-only work | [maintain-docs](../../.agents/skills/maintain-docs/SKILL.md) |
| Documentation audit | [audit-docs](../../.agents/skills/audit-docs/SKILL.md) |
| Loose input classification | [triage-inbox](../../.agents/skills/triage-inbox/SKILL.md) |
| Local or PR review within its authorized scope | [review-change](../../.agents/skills/review-change/SKILL.md) |
| PR preparation after accepted closeout | [create-pr](../../.agents/skills/create-pr/SKILL.md) |

## Single Active Project

Only one project may be in progress. Complete and close it before creating
another unless the owner explicitly suspends or abandons the active project.

A question discovered during delivery may produce bounded research or a
durable decision referenced by the project. It does not authorize another
project or replace the next unresolved gate. After recording the supporting
material, return to the active project.

Each project represents one bounded outcome. A later substantial feature gets
a new project written from scratch even when it follows the same delivery
cadence or builds on the same foundation.

## Project Link Boundary

A project may link outward to durable specification, requirements, domain,
architecture, research, and guideline documents. README, AGENTS, skills, durable
documentation, and other projects must not link to a specific project file.
This one-way dependency keeps completed project records removable.

## Interactive Decision Gates

Whenever work reaches a choice reserved for the owner:

1. present one coherent decision cluster rather than unrelated choices;
2. state the evidence, exact decision, viable alternatives, material tradeoffs,
   and recommendation when justified;
3. ask the smallest question that resolves the gate and wait for the answer;
4. record the accepted decision in the project and its durable owner before
   implementing dependent work;
5. continue to the next cluster only after the current one is resolved.

This applies to scope, requirements, architecture, data contracts, source
selection, risk acceptance, migration and cutover behavior, and other
owner-controlled choices. Ordinary reversible implementation details inside an
already authorized scope do not become additional approval gates.

## Pre-implementation Review

Before implementation begins, a non-trivial project must make the applicable
decision surfaces reviewable:

1. **Scope and assumptions** — intended outcome, in-scope behavior, boundaries,
   and unresolved product assumptions. Read the current functional specification
   and prepare the affected functional draft on the change branch according to
   the specification guide; state when the change has no functional impact.
2. **Architecture** — component responsibilities, dependencies, state ownership,
   and data/runtime flow. Include a proportionate composition diagram when
   relationships between three or more components materially affect the design.
   Keep project diagrams small and decision-focused; use a table, tree, or fenced
   plain-text diagram according to the relationship being explained. Project plans
   favor these quick, directly readable views; durable architecture documentation
   uses the repository's durable architecture convention.
3. **UI** — for user-facing changes, low-fidelity mockups of primary screens,
   components, and relevant responsive breakpoints. Include PNG previews for
   material UI changes. Present mobile screens in portrait and desktop screens in
   landscape at representative viewport dimensions so each layout can be assessed
   in its intended form factor.
4. **UX** — navigation and interaction flows plus applicable content, empty,
   loading, offline, unavailable, validation, and failure states.
5. **Delivery** — implementation stages, migration and safety behavior,
   verification, and acceptance evidence.

Small copy, styling, or isolated maintenance changes may combine or omit
surfaces that are not materially affected. State why they do not apply instead
of producing decorative diagrams or irrelevant mockups.

The owner approves the plan as a whole by moving it to `APPROVED FOR
IMPLEMENTATION`; individual surfaces do not require separate fields or repeated
confirmation. Discussion, review, project edits, and documentation requests do
not change the phase.

An explicit request to plan and execute a named scope lets the project move
directly to `APPROVED FOR IMPLEMENTATION`. Ordinary reversible decisions within
it belong to the implementer. If planning or delivery exposes a new material
decision reserved for the owner, pause only the dependent work until that
decision is accepted; unrelated approved work may continue safely.

## Functional Draft Reconciliation

During planning, read the current specification and prepare a separated draft
for the changed functional views using the specification guide. A change with
no functional impact records that fact in its project instead.

During implementation, update current sections only for behavior that exists;
keep unfinished draft scope separate. Before closeout:

1. Match every draft item to the delivered result and describe actual outcomes,
   defaults, persistence, failures, and limitations.
2. Route still-desired omitted, deferred, or newly discovered behavior to an
   existing relevant requirement, or an evidence-backed candidate under the
   requirements discovery rules. Do not infer acceptance, priority, or stage.
3. Put insufficiently understood or unclassified follow-ups in `INBOX.md` with
   origin, context, and the next decision. Reuse existing records. Record
   intentionally discarded scope while the project is active; preserve its
   rationale durably only when it remains useful.
4. Remove draft sections, draft-only views/index entries, and planned behavior
   from the specification. Current limitations can link to requirements or inbox
   entries without promising implementation.

Preparation and reconciliation may be performed within an authorized
implementation or documentation change. They do not accept the result or
permit early removal of its active project record.

## Owner Acceptance And Closure

The agent may record implementation progress and set `IMPLEMENTED` after the
work and planned verification exist. Only the owner accepts the completed
result. A request to plan, implement, update documentation, create a PR, commit,
push, or merge does not by itself accept the finished change. Passing checks,
agent review, elapsed time, a missing plan, or PR creation/merge are not evidence
of owner acceptance.

Present the concrete completed result, affected diff, verification, limitations,
and follow-up routing to the owner. Record the owner's explicit acceptance in
the active project with its scope and a quotation or reference to the actual
owner message. Do not manufacture acceptance, mark an acceptance step complete,
advance to `APPROVED FOR DOCUMENTATION` or `DONE`, or delete the project to make
a publication gate pass.

When the owner accepts a final diff that already includes the completed
documentation, that single acceptance can cover implementation and documentation
closeout. Additional material changes require acceptance of the changed result.
After that acceptance, the agent may perform the mechanical closure steps under
`DONE`. Until then, retain the project at `IMPLEMENTED` and report the pending
owner gate. If no project is needed, require the same acceptance evidence before
publication rather than creating a plan solely to record a checkbox.

## Pull Request Readiness

Create a PR, including a draft PR, only after all of these hold:

- the owner has explicitly accepted the completed result and final documentation;
- durable owners describe the accepted behavior and decisions, all specification
  drafts are reconciled, and unfinished scope has its requirement/inbox owner;
- verification and limitations are reported accurately, with any remaining
  failed, skipped, or external acceptance gate resolved by the owner;
- the accepted project has reached `DONE` and its temporary file is removed
  from the final diff; absence of a file alone does not prove completion;
- publication is authorized for the intended scope, repository, base, and head.

Use `create-pr` to inspect the complete diff, perform the local review, and apply
the repository PR template. Commit and push only the intended authorized change.
If a required gate is missing, report it and retain the active plan; do not
self-approve or publish first and defer closeout. This repository defines no
standing early-PR exception. A generic request to open a PR does not waive a gate.

After publication, return the PR link and available verification, then stop.
Do not wait for CI/reviewers, collect new review comments, or begin review-driven
corrections unless the owner requests that follow-up. A local review during PR
preparation authorizes no subsequent monitoring or corrective batch.

## Lifecycle States

### `PROPOSED`

The project defines the problem, outcome, scope, non-goals, decisions,
assumptions, open questions, affected flow, failure and migration behavior,
implementation stages, tests, manual checks, and acceptance criteria.
Dependent implementation has not started.

Keep non-goals short. Include only adjacent capabilities that a reader could
reasonably mistake as part of the outcome and whose exclusion affects the
design. Do not inventory unrelated future work.

### `APPROVED FOR IMPLEMENTATION`

The owner has approved the plan and explicitly authorized its named scope. Keep
progress markers, material deviations, new risks, and newly accepted decisions
current while implementing. Reconcile the specification draft with observed
behavior as slices are completed, keeping unfinished work separate. Preserve
user data and external evidence, and keep destructive or network operations
explicit.

### `IMPLEMENTED`

The requested behavior exists. Record actual verification results, manual
checks, known limitations, migration or operational impact, and follow-ups.
Keep the project until explicit owner acceptance under Owner Acceptance And
Closure. Preparing requested documentation is allowed; deleting the plan or
claiming closeout before that acceptance is not.

### `APPROVED FOR DOCUMENTATION`

The owner has explicitly accepted the implementation result; record the
acceptance evidence and its scope. Transfer lasting behavior,
decisions, rejected-alternative rationale, configuration, and safety boundaries
to their durable owners, including the current functional specification.
Complete Functional Draft Reconciliation and remove all specification drafts.
Remove temporary delivery narration that has no continuing value.

### `DONE`

Owner acceptance of the completed result and final documentation is recorded.
Delete the project file only after confirming that:

- explicit owner acceptance covers the final result and documentation;
- lasting behavior, decisions, limitations, and safety boundaries are recorded
  in their durable specification, domain, architecture, requirements, research,
  or guideline owners;
- repository verification passes, or remaining failures are recorded accurately;
- no durable document links to the temporary project;
- temporary narration has been removed or replaced by durable facts;
- every unimplemented specification draft item has been routed or explicitly
  discarded, and specification drafts and draft-only views have been removed.

Keep active delivery and acceptance work on its change branch. The main branch
must contain neither specification drafts/planned changes nor temporary change
plans under `docs/projects/`. Do not merge an unfinished project and defer its
cleanup to another change. Accepted technical target architecture and future
requirements keep their existing durable owners; neither is a temporary plan.

## Project Template

```markdown
# <Change Name>

## Status

- Phase: PROPOSED | APPROVED FOR IMPLEMENTATION | IMPLEMENTED | APPROVED FOR DOCUMENTATION | DONE

## Problem And Outcome

## Scope And Non-goals

## Decisions, Assumptions, And Open Questions

## Functional Specification Impact

<Affected current views and branch-only draft, or why no functional impact.>

## Architecture And Component Composition

## UI And UX Proposal

## Data Or Runtime Flow

## Failure Behavior, Safety, And Migration

## Implementation Plan

1. [pending] <step>

## Verification And Acceptance

- `<command>`
- <required manual check>

## Owner Acceptance

- Status: PENDING
- Evidence: <actual owner message/reference and accepted scope; never agent inference>

## Result

- <temporary implementation summary>
```

Use `[pending]`, `[in-progress]`, and `[done]` so interrupted work can resume
safely. Omit or briefly mark sections that are genuinely unaffected instead of
creating decorative content.
