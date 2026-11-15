---
name: implement-change
description: Implement an approved or explicitly requested repository change with controlled scope and proportionate verification. Use when modifying application behavior, configuration, integrations, tests, scripts, or other implemented behavior.
---

# Implementation

## Scope

Apply repository-specific architecture, safety, testing, and lifecycle contracts
when present. This workflow must remain usable without a named repository guide.

## Inputs

Read every document routed for the touched area and the active project file when one exists.

## Workflow

1. Confirm implementation is authorized for the requested scope and inspect existing
   user changes before editing. Pause only work dependent on a new material owner
   decision outside that scope.
2. Implement in small vertical slices and respect the component, configuration, and ownership boundaries declared by the repository.
3. Validate external input at boundaries. Preserve user data and external evidence;
   never overwrite either as an incidental fallback. Use atomic or transactional
   durable writes where supported, and preserve compatibility unless the approved
   scope defines a migration or break.
4. Add regression coverage for parsing, configuration, persistence, and public-interface changes.

## Verification And Handoff

Run the repository verification command when declared; otherwise choose
proportionate checks. Include plan-specific checks. Keep verification
deterministic; do not refresh dependencies or external data, or invoke live
integrations unless explicitly requested.

When an active project file exists, update it with deviations and results. Report
changed behavior, verification, manual checks, limitations, and follow-ups.
