# Angular Engineering Guide

## Purpose

Use these rules for Angular applications and libraries. Repository architecture
decides the product boundary, directory names, API ownership, rendering
libraries, and deployment topology.

## Version And Preview Policy

- Start new work on the newest stable Angular major compatible with the
  repository's supported Node.js and TypeScript versions; pin exact versions in
  the workspace and lockfile.
- Upgrade one concern at a time and run the full repository quality gate.
- Use preview or experimental APIs only after recording the concrete benefit,
  stability label, containment boundary, fallback, and removal or upgrade trigger.
- Keep preview APIs behind a feature-local adapter so they do not become an
  accidental repository-wide convention.
- Prefer stable framework APIs when preview functionality does not materially
  improve the accepted use case.

## Application Shape

- Prefer one Angular CLI workspace with the application in the standard `src/`
  location and independently reusable or enforceable libraries in `projects/`.
  A typical shape is:

```text
<workspace>/
  .storybook/           shared component-workshop configuration, when used
  e2e/                  application-level browser journeys
  projects/
    ui/                  reusable presentation primitives
    application-api/
      src/lib/
        generated/      generated transport code; never hand-edit
        mappers/        transport DTO <-> frontend model mappings
        facade/         application-facing API boundary
  src/
    app/
      core/              bootstrap, error reporting, runtime configuration
      features/          product features owned by the application
      layout/            application shell composition
    locale/              translation sources, when localization is used
```

- Use Angular CLI conventions unless a documented constraint requires a
  different layout.
- Start features inside the application. Extract a library only when reuse,
  ownership, packaging, or dependency enforcement justifies the boundary.
- Keep reusable presentation libraries independent of application features,
  routing, HTTP, and domain-specific imperative libraries.
- Use standalone components and functional providers. Do not introduce
  NgModules for new application features without a compatibility reason.
- Lazy-load route-level features and keep route configuration close to the
  owning feature.
- Enforce dependency direction: application features may use platform and
  shared libraries, while shared libraries must not depend on features.
- Avoid generic `utils`, `common`, or `services` dumping grounds. Name modules
  after capabilities, keep files focused, and colocate a component's TypeScript,
  template, styles, and tests.

## Component Composition

- Route or page components orchestrate use cases and map feature state to
  explicit child inputs.
- Presentation components receive data through typed signal `input()` values
  and report intent through `output()` values named after domain actions.
- Use `model()` only for a natural two-way control value, not to hide workflows
  or mutate parent-owned state.
- Prefer composition, content projection, directives, and small typed
  configuration objects over component inheritance.
- Reusable UI must not inject feature stores, HTTP clients, or the router.
- Keep lifecycle hooks small and delegate to behavior-named methods.
- Preserve accessibility: native elements first, visible focus, keyboard
  access, labelled controls, announced asynchronous state, and no color-only meaning.

## State And Reactivity

- Use signals for synchronous local and feature state, `computed()` for derived
  values, and `effect()` only for real external side effects.
- Keep writable signals private; expose readonly state and intention-revealing
  commands.
- Use RxJS where time is part of the model: cancellation, debouncing, event
  streams, WebSocket/SSE, and multi-source orchestration.
- Convert between signals and observables at deliberate, narrow boundaries.
- Do not introduce a global store until several features need coordination,
  history, effects, or debugging that feature-scoped state cannot provide.
- Model loading, empty, ready, partial, stale, and failure states explicitly.
- For zoneless applications, notify Angular through signals, template
  listeners, `AsyncPipe`, or explicit framework APIs.

## API Boundary

- Treat the repository's published API description as the transport contract.
- Generate transport clients when the contract format supports it; never
  hand-edit generated output or import generated DTOs directly into components.
- Map transport DTOs to frontend domain or view models at the API boundary.
- Keep queries and commands distinct. Commands express the smallest explicit
  intent rather than serializing a screen or mutable application state.
- Define null-versus-absent semantics and use stable identifiers and standard
  timestamp formats.
- Treat server output as untrusted. Validate status, content type, invariants,
  and closed variants where static typing cannot prove runtime validity.
- Keep HTTP calls out of components. Centralize base URL, correlation headers,
  timeouts, cancellation, and error translation.
- Do not retry mutations automatically. Retry safe reads only under a bounded,
  visible policy.
- Preserve problem details, field errors, warnings, provenance, and correlation
  IDs in typed results; localize them only at the presentation boundary.
- Keep secrets, arbitrary upstream URLs, and authoritative persistence logic
  out of browser code.

## Contract Discovery And Test Doubles

For a feature that depends on an evolving API:

1. map user actions and visible loading, success, empty, partial, stale,
   authorization, validation, and failure states;
2. list the exact fields and invariants each state needs;
3. define frontend models and representative transport examples;
4. propose task-oriented requests, responses, and problems;
5. obtain contract acceptance before implementing speculative production calls;
6. regenerate the client after the authoritative contract changes.

A contract simulator or mock server may provide deterministic accepted examples
before an implementation is available. It is a test adapter, never the contract
authority or a second production backend. Keep scenario selection explicit and
impossible in production builds.

## Forms

- Follow the project-selected form system. For signal-first Angular 22 work,
  use stable typed Signal Forms when selected; existing Reactive Forms remain
  valid until an authorized migration replaces them.
- Keep form models separate from API commands; normalize and validate before
  mapping a submission.
- Surface server field errors without replacing client validation.
- Adopt newer form APIs only through the preview policy and keep domain and API
  models independent of the chosen form implementation.

## Imperative Library Boundaries

- Hide stateful browser, visualization, editor, or rendering libraries behind
  focused Angular adapters or facades.
- Components express intent and observe typed events; they do not retain
  third-party mutable instances.
- Keep domain-ID to library-object mappings inside the adapter.
- Clean up DOM targets, listeners, object URLs, workers, and subscriptions
  deterministically.
- Test pure domain-to-library descriptors without a browser, then cover actual
  rendering and interaction with focused real-browser tests.

## Testing And Quality Gates

- Use the test runner selected by the current Angular CLI workspace.
- Test through public inputs, outputs, DOM, and feature facades rather than
  private implementation details.
- Use Angular HTTP testing utilities and fixtures derived from accepted API examples.
- Prefer stable asynchronous completion and visible assertions over arbitrary
  sleeps or indiscriminate change-detection calls.
- When the project adopts Storybook, accompany reusable interactive components
  with stories for relevant loading, empty, error, ready and disabled states.
  Stories complement rather than replace application journeys.
- Add real-browser tests for interactions that depend on layout, browser APIs,
  accessibility, downloads, or third-party rendering.
- Gate on formatting, lint or static analysis, type checking, unit tests,
  production build, bundle budgets, and selected browser tests as configured by
  the repository.
- Include accessibility, reduced motion, narrow viewport, slow request,
  cancellation, partial failure, and stale-result cases where relevant.

## Review Checklist

- Are responsibilities aligned with the repository architecture?
- Are generated DTOs isolated and mapped?
- Is state valid by construction and narrowly owned?
- Are components composed through typed inputs and outputs?
- Are imperative third-party objects behind an adapter boundary?
- Are preview APIs documented, isolated, and replaceable?
- Are accessibility, cleanup, failures, and proportionate tests covered?

## Primary References

- [Angular releases](https://angular.dev/reference/releases)
- [Angular style guide](https://angular.dev/style-guide)
- [Angular components](https://angular.dev/guide/components)
- [Angular HTTP](https://angular.dev/guide/http)
- [Angular signals](https://angular.dev/guide/signals)
- [Angular zoneless](https://angular.dev/guide/zoneless)
- [Angular testing](https://angular.dev/guide/testing)
