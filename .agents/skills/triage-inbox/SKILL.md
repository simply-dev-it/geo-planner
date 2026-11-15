---
name: triage-inbox
description: Interactively turn loose repository notes from an inbox or pasted material into requirements, backlog items, research questions, decisions, risks, or discarded duplicates. Use when the owner provides unstructured ideas, observations, links, feature requests, workflow notes, or uncertain facts that must be classified without prematurely implementing them.
---

# Inbox Triage

## Scope

Classify loose input interactively without prematurely implementing it. Never
implement backlog items without separate authorization.

## Inputs

Read the supplied notes or repository inbox, relevant durable documents, and any
active project. Do not treat an inbox statement as verified fact or implementation
approval.

## Workflow

1. Process one coherent cluster at a time. Restate it briefly and ask only the decision needed to classify it when intent is ambiguous.
2. Assign each item to exactly one primary destination:
   - requirement: user-visible need with acceptance evidence;
   - backlog: actionable work not yet selected; keep it marked in an inbox when one exists;
   - research: question requiring evidence or comparison;
   - decision: accepted constraint or choice with rationale;
   - risk: uncertainty with impact and mitigation; keep it in an inbox when one exists
     until an active project or durable owner adopts it;
   - discard: duplicate, obsolete, or intentionally rejected input; remove it without
     creating a durable destination.
3. Preserve provenance when moving material into a durable owner: original wording,
   date, links/files, confidence, and owner decision. A discarded inbox item does not
   require a durable record.
4. Move accepted requirements, research, and decisions to their repository-defined
   owners when present. Use stable IDs where the destination contract requires them.
5. Remove accepted material only after its destination is written. Discarded input may
   be removed directly. Keep unresolved backlog and risks in the repository inbox
   when one exists; otherwise report them with the next question.

An unselected implementation approach for an accepted change is not discarded inbox
input. Preserve the alternative and its rationale in the relevant research or project
when it materially informs the decision.

## Verification And Handoff

End each session with counts by category, unresolved questions, and the next smallest useful triage batch.
