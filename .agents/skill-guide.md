# Skill Guide

## Purpose

Keep local skills recognizable, focused and portable. This guide describes how to
author and maintain skills; repository workflow routing and mandatory delivery
policy are owned by the [project lifecycle](../docs/guidelines/project-lifecycle.md).
A skill remains usable without this guide or other repository-specific files.

## Common Structure

Keep YAML frontmatter with a descriptive `name` and `description`, followed by the
skill title and these four top-level sections, in order:

| Section | Content |
| --- | --- |
| `Scope` | When to use the skill, intended outcome, boundaries and guardrails. |
| `Inputs` | Instructions, source state, evidence, authorization and references needed for the task. |
| `Workflow` | The procedure, with task-specific subsections where useful. |
| `Verification And Handoff` | Checks, result reporting, limitations, unresolved decisions and stopping conditions. |

Use the description to make discovery clear. Keep detailed trigger boundaries in
`Scope`. Group existing instructions by responsibility before adding new content.
Preserve meaningful rules, evidence and authorization boundaries during a restructure.
Avoid empty subsections, repeated instructions and invented requirements merely to
fill the structure. A short paragraph can be sufficient for a section.

## Supporting Material And Composition

Keep substantial templates or specialized procedures in linked references when that
improves readability. Put executable checks in scripts only when they provide useful,
repeatable verification. Keep entry points and supporting references consistent.

Skills may invoke other skills for a relevant part of the requested task. State the
purpose and preserve the caller's scope and authorization; provide a direct fallback
when the dependency is optional. Repository-specific phases, paths and delivery
policy remain in their repository owners rather than becoming portable requirements.

## Maintenance And Verification

When renaming a skill, update its directory, frontmatter, UI metadata, prompts and
callers together. Keep interface metadata consistent with the actual procedure.

Review the diff for lost decisions or widened authority, validate changed skill
metadata with the available skill validator, and run applicable documentation and
reference checks. Check that invocation boundaries, inputs, verification and exit
behavior remain clear; report unavailable checks rather than claiming they passed.
