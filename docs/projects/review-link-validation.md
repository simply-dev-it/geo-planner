# Review And Local Link Validation

## Status

- Phase: IMPLEMENTED
- Authorization: owner requested a link checker and concise local-review support in PR #10.

## Problem, Scope, And Decisions

The review skill assumes a PR exists and delegates link validation to scripts
that do not provide it. Add a standard-library Python checker for repository
Markdown local paths and heading fragments, with regression tests. Discover
tracked and non-ignored new Markdown through Git; ignore external URLs and code
examples. No network access, application changes or new public mise task.
Keep review-skill changes short and repository-agnostic.

## Runtime, Safety, And Failure Behavior

Aggregate `verify` runs checker tests and the checker before component gates.
The checker only reads documentation and returns nonzero with file/line context
for broken links. Application architecture, UI and UX are unaffected.

## Implementation

1. [done] Add checker and regression tests, connect the aggregate gate.
2. [done] Clarify local review and actual validation coverage in the skill.
3. [done] Verify the corrective batch for PR #10.

## Verification And Acceptance

- Fixtures cover missing files/fragments, references, code examples and URL-encoded paths.
- Workflow tests confirm link checks are part of aggregate verification.
- Run skill validation and `mise run verify`.
- Retain this plan for owner implementation acceptance.

## Result

- Checker passed on 43 documents, including this active plan.
- Eight link regression tests and eight task workflow tests passed.
- `mise run verify` passed all component gates, including browser tests.
- The review skill remains 67 lines; only evidence scope and check coverage changed.
- The skill-creator validator was attempted but both available Python runtimes
  lack PyYAML. Existing frontmatter and interface metadata are unchanged.
- No application source, private legacy data, or external sources changed.
