---
name: create-pr
description: Prepare and create a pull request from a completed change, checking repository readiness and reporting observed verification. Use when asked to open a PR or finish an authorized PR delivery.
---

# Create Pull Request

## Scope

Prepare and create the requested PR within the authorized delivery scope.

## Inputs

Read applicable repository instructions and delivery policy when present. Identify
the intended repository, base and head, inspect the complete diff and worktree, and
preserve unrelated changes. Follow the repository's acceptance, documentation,
verification, commit and push requirements. Do not infer missing acceptance or
manual evidence from a merge, passing tests, or a request to open a PR.

## Workflow

### Readiness

Check that the change is one cohesive outcome, durable documentation describes the
result, and temporary plans are closed according to repository policy. If a required
gate remains, report the specific missing evidence or approval before publication.
Use an early-PR exception only when the applicable policy permits it and the owner
has explicitly approved the named remaining gates.

### Review And Preparation

1. Review the final diff before publication. When available, invoke
   [review-change](../review-change/SKILL.md) for this local assessment; otherwise
   assess correctness, regressions, contracts and verification directly. This is
   a local review, not permission to poll an existing PR for new feedback.
2. Resolve blocking findings within the authorized correction scope. Where owner
   acceptance of a corrective recommendation is required, present it before making
   changes. Recheck affected behavior and readiness after corrections.
3. Show the final diff, affected files, observed verification and limitations. Obtain
   any commit and push approvals required by repository policy; changed diffs require
   renewed approval where that policy requires it. Commit and push only the intended
   change with the authorization required for each action.
4. Use the repository's PR template when present. Describe final behavior, rationale,
   impact and actual verification. Distinguish passed, failed and skipped checks;
   name any explicitly approved remaining gates. Do not claim tests or manual checks
   that were not performed.
5. Create the requested PR against the verified base. If a PR already exists for
   the intended head and base, report it rather than creating a duplicate; update
   its metadata only within the authorized scope.

## Verification And Handoff

Return the PR link, available verification results and any approved remaining gates,
then stop. Do not wait for CI, collect new review comments, or start review-driven
corrections unless the owner requests that follow-up.
