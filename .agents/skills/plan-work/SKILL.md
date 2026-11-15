---
name: plan-work
description: Plan repository changes that need a material owner decision or staged acceptance, add a product capability, or materially change contracts, architecture, integrations, or safety behavior.
---

# Planning

## Scope

Prepare a reviewable change proposal and maintain its accepted scope through delivery.

## Inputs

Read [references/planning.md](references/planning.md) for proposal content, design
review, and a portable template. Apply repository-specific routing, status names,
plan locations, and verification commands when they exist.

Read relevant repository instructions and inspect implemented behavior and the
worktree. Separate facts, assumptions, and open decisions.

## Workflow

1. Continue the active plan when one exists. Before creating a new plan in a Git
   repository, create and switch to a dedicated branch based on its default
   branch. Check the actual base and preserve existing worktree changes;
   use a separate worktree or checkout if switching would disturb those changes.
   Do not create the plan on the default branch. Then write one cohesive proposal
   in the repository's plan location or the user-requested artifact.
2. Make materially affected design surfaces reviewable before implementation.
3. Implement only after the owner authorizes the scope, including a request to plan
   and execute together. Pause only work dependent on a newly discovered material
   owner decision outside that scope.

## Verification And Handoff

Keep progress and deviations current. After implementation, record actual
behavior and verification. Close a temporary plan only after owner acceptance
and transfer of lasting decisions to their durable owners.
