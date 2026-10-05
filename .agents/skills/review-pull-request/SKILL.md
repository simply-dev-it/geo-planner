---
name: review-pull-request
description: Assess a pull-request diff and current review comments on owner request, recommend a bounded corrective batch, and preserve non-blocking follow-ups.
---

# Pull Request Review

## Trigger And Boundary

Use this procedure only when the owner asks to review a pull request, its comments,
or the agent's completed changes. Do not wait automatically for CI, automated
reviewers, or human reviewers. Inspect the comments and check states available at the
time of the owner request.

Review one cohesive pull-request outcome. Do not require it to contain only one
product or architecture area, and do not add unrelated work merely to make the pull
request larger.

## Evidence Collection

1. Identify the PR's base and head, or the baseline and scope for local review.
2. Inspect the full merge-base diff for a PR; for local review include relevant
   commits, staged, unstaged, and untracked files. Separate unrelated owner changes.
3. For material rewrites of durable documents, inspect a word-level diff to identify
   lost decisions, provenance, evidence, or constraints.
4. For a PR, read current review comments separately from summaries or discussion.
5. Use existing deterministic checks as evidence. Do not manually repeat a passing
   structure, formatting, index, or local-reference check unless diagnosing it.

## Triage

Present actionable comments in this table before recommending changes:

| Finding | Evidence or risk | Counterargument or limitation | Cost | Recommendation |
| --- | --- | --- | --- | --- |
| [Comment or observed issue] | [Concrete affected behavior or contract] | [Why it may not matter or be in scope] | low / medium / high | fix now / defer / reject / owner decision required |

Use these dispositions:

- **Fix now**: confirmed correctness, safety, data-loss, broken-reference, or
  acceptance-criteria defect.
- **Defer**: potentially useful but non-blocking work that needs a later, bounded
  change. Record it in the repository inbox when one exists, or report it to the
  owner after the corrective batch is accepted.
- **Reject**: stylistic preference, speculative future case, duplicate work, or
  disproportionate scope expansion. State the counterargument.
- **Owner decision required**: material product, architecture, data, or scope choice
  not already authorized.

Do not apply changes, post review replies, or start a corrective batch until the owner
accepts the recommendation.

## Corrective Batch And Exit

After owner approval, implement one coherent batch and run proportionate verification.
Reply to review comments only when the owner authorizes that response. Do not continue
the pull request indefinitely: after the accepted batch, send non-blocking new ideas
to the repository inbox when one exists, or report them to the owner. Continue only
for confirmed correctness, safety, data-loss, or owner-approved scope issues.

## Structural Requirement Changes

For a requirement added, removed, renamed, reidentified, or moved between files,
check that domain and architecture ownership, capability routing, source evidence,
and dependency ordering still match it. Apply any repository-specific requirement
contract. Use repository checks for index freshness, stage allocation and local
references; verify affected references separately when those checks lack coverage.
