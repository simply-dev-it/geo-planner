# Code And Test Quality Tooling

## Status And Decision Trace

- Status: ACTIVE — evidence collected; tooling adoption remains an owner decision.
- Evidence checked: 2026-10-06, repository baseline `3addf6b4` and primary
  documentation linked below.
- Provenance: owner-requested research into reliable agent-authored tests and
  deterministic quality checks; repository configuration and representative tests.
- Question: which existing tools can detect code defects, weak tests, and
  architectural violations in this Angular/Kotlin repository with reproducible
  results and proportionate maintenance?
- Informs: verification practices in the
  [Engineering Guide](../guidelines/engineering-guide.md#testing-and-verification),
  [Angular Engineering Guide](../guidelines/angular-engineering-guide.md#testing-and-quality-gates),
  [Kotlin Backend Engineering Guide](../guidelines/kotlin-backend-engineering-guide.md#testing),
  and [target architecture](../architecture/target-product.md).
- Completed outputs: repository audit and candidate comparison in this document;
  no tooling selection has been accepted or implemented.
- Open decisions: initial adoption scope, mutation pilot boundary, runtime budget,
  numeric thresholds after measurement, and any preview or licensed backend tools.
- Return before: creating the quality-gate implementation proposal; recheck exact
  dependency compatibility and licence terms before installation.

## Findings

### Current Repository Evidence

The working tree was clean and `docs/projects/` contained no active plan when
research began. This document records findings and recommendations; it does not
authorize changes to verification or backend production code.

| Area | Existing checks | Observed gap |
| --- | --- | --- |
| Aggregate | `mise run verify`: task validation, workflow helper tests, local Markdown links, requirements index, all components, offline legacy checks | Workflow helper tests do not provide a general GitHub Actions semantic linter. |
| Angular | Prettier, angular-eslint, TypeScript strict mode and strict templates, Vitest, production builds and bundle budgets, Storybook build, Playwright Chromium | No configured coverage gate, mutation analysis, property library, or test-specific lint plugins. |
| Frontend lint routing | `ng lint` targets `src/**` and library trees | `e2e/**`, `.storybook/**`, and frontend scripts are outside the current target globs. ESLint uses `recommended`, not type-aware rules. |
| Unit routing | `test:unit` runs application and `ui` | `geo-planner-api` has a test target but is not invoked by this script; it currently has no specs. Future tests could be omitted silently. |
| E2E | `forbidOnly` on CI, browser isolation, role-based assertions, failure traces | CI retries twice and does not set `failOnFlakyTests`; passing on retry can produce a successful gate. Local runs can reuse an existing server. |
| Accessibility | Angular template rules and Storybook a11y addon with `test: 'error'` | The gate builds Storybook but has no story execution task; configuration alone does not prove accessibility checks ran. E2E checks landmarks, not an axe scan or keyboard flow. |
| Simulator | Prettier, strict TypeScript including `noUncheckedIndexedAccess`, build, Node test runner | No static lint, architecture checks, coverage gate, or mutation analysis. |
| Kotlin | Compilation, Kotest on JUnit Platform, `ktlintCheck` attached to Gradle `check` | No detekt, coverage, mutation, or architecture gate; the observed test checks Spring context health. |

Evidence owners: `mise.toml`, `.github/workflows/build.yml`,
`frontend/package.json`, `frontend/angular.json`, `frontend/eslint.config.js`,
`frontend/tsconfig.json`, `frontend/playwright.config.ts`, `frontend/.storybook/`,
`backend-simulator/package.json`, `backend/build.gradle.kts`, and
`gradle/libs.versions.toml`.

The installed frontend baseline is Angular core 22.0.8 / build 22.0.9,
TypeScript 6.0.3, ESLint 10.8.0, Vitest 4.1.10, and Playwright 1.62.0.
The repository pins Kotlin 2.3.21, Kotest 6.2.3, JDK 25, Node 24.18.1, and
Gradle Wrapper 9.6.0. New tooling must match these versions, not an older
Angular/Jest or Kotlin/JUnit tutorial. Package ranges and installed versions are
distinct; the committed lockfile is the reproducible npm installation boundary.

### What Each Kind Of Check Proves

| Mechanism | Useful evidence | Limit |
| --- | --- | --- |
| Compiler and static analysis | Invalid types, unsafe async usage, forbidden imports, unreachable or unused code | Cannot establish that the expected product behavior is correct. |
| Coverage | Which code and branches tests executed | Executing a branch does not prove an assertion checked its result. |
| Mutation testing | Whether tests detect selected artificial defects in production code | Missing requirements and equivalent mutants remain; results depend on operators and scope. |
| Property testing | Invariants across generated inputs, with reduced counterexamples | A weak property or narrow generator can miss defects. |
| Contract and browser tests | Observable behavior across real boundaries | Doubles can reproduce the same mistake as production; browser timing adds variability. |

Inference: agent-authored code and tests can share the same misunderstanding.
Independent accepted examples, explicit invariants, and observable outcomes must
anchor assertions. More tests generated from the implementation cannot resolve
an incorrect oracle. Mutation testing is especially useful for exposing weak
assertions, but no tool guarantees complete correctness.

### Candidate Comparison

All priorities below are proposals. Relative cost is inferred from analysis
scope; no repository-specific timings or mutation scores were measured.

| Candidate | Defects addressed | Fit and execution cost | Recommendation |
| --- | --- | --- | --- |
| Type-aware typescript-eslint | Forgotten `await`, misused promises, unsafe `any`, incomplete variant handling | Existing dependency; fast to moderate; requires TS project coverage for test/config files | First adoption batch. Start with recommended type-checked rules and deliberate exhaustive-switch rules. |
| `@vitest/eslint-plugin` | Empty tests, malformed expectations, unreturned promise assertions, conditional assertions, focused/disabled tests | Flat-config plugin scoped to unit specs; fast | First batch. Explicitly enable disabled-test restrictions; do not assume a preset includes every desired rule. |
| `eslint-plugin-playwright` | Missing awaits, focused/skipped tests, arbitrary waits, fragile assertions | Scope to E2E and include it in actual lint commands; fast | First batch, alongside existing Playwright runtime options. |
| Knip | Unused files, exports, dependencies and unresolved dependency usage | Angular plugin and explicit workspace/entry configuration; fast to moderate | First batch after validating entries and published library exports. It measures code hygiene, not test strength. |
| dependency-cruiser | Cycles and forbidden module dependencies | Resolves TypeScript imports and applies configured graph rules; moderate | First batch for a few accepted architecture boundaries. |
| Vitest coverage | Unexecuted branches/functions and omitted source files | Add a matching coverage provider; moderate | Establish coverage scope before thresholds; include untouched source files explicitly. |
| StrykerJS | Assertions that fail to detect changed conditions, values, or removed behavior | Vitest runner exists; repeated tests make it relatively expensive; Angular integration needs a pilot | Begin with hand-written deterministic validation/mapping rules. |
| fast-check | Boundary and combination defects outside example fixtures | Works with JS/TS test runners; reproducible seeds; cost controlled by run count | Add meaningful properties alongside the first logic-heavy slice. |
| Kotest property module | Kotlin invariant and input-space defects | Existing Kotest ecosystem, additional property module required | Preferred backend property tool when domain rules exist. |
| PIT + Kotest extension | Weak backend tests | Documented Kotest adapter; Kotlin bytecode and exact JDK compatibility need a pilot | Backend mutation candidate; separate from the frontend pilot. |
| detekt | Kotlin code smells, complexity, semantic rules | Compiler-coupled tooling; current published compatibility table includes preview 2.x versions | Evaluate backend compatibility explicitly; keep ktlint for formatting. |
| Kover | Kotlin coverage and verification thresholds | JVM coverage plugin; instrumentation compatibility must be checked | Backend candidate after meaningful tests exist. |
| ArchUnit | JVM dependency direction and forbidden framework dependencies | Bytecode-based architecture tests; small focused rule set | Add when real application/domain/adapter boundaries exist. |
| axe through Playwright | Automatically detectable rendered accessibility defects | Runs against actual browser states; adds browser work | Extend representative E2E states; retain keyboard/manual evidence. |
| actionlint / ShellCheck | Broken Actions expressions/types and unsafe shell quoting/control flow | Established static analyzers; fast | First or adjacent batch. ShellCheck must actually receive standalone and relevant embedded shell bodies. |
| Gitleaks | Secret-like content in tracked changes/history | Local scan with pinned rules; false-positive review required | Adjacent repository gate; restrict scope to tracked/explicitly selected content and redact output. |
| Redocly CLI | Invalid or inconsistent OpenAPI descriptions | Local contract lint, including references; requires a contract artifact | Adopt with the first accepted published product contract. |

Primary capability evidence:
[typescript-eslint](https://typescript-eslint.io/rules/no-floating-promises/),
[Vitest ESLint plugin](https://github.com/vitest-dev/eslint-plugin-vitest),
[Playwright ESLint plugin](https://github.com/playwright-community/eslint-plugin-playwright),
[Knip Angular plugin](https://knip.dev/reference/plugins/angular),
[dependency-cruiser](https://github.com/sverweij/dependency-cruiser),
[Vitest coverage](https://vitest.dev/config/coverage),
[Stryker Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/),
[fast-check](https://fast-check.dev/docs/introduction/),
[Kotest properties](https://kotest.io/docs/proptest/property-based-testing.html),
[Kotest PIT adapter](https://kotest.io/docs/extensions/pitest.html),
[detekt compatibility](https://github.com/detekt/detekt),
[Kover](https://kotlin.github.io/kotlinx-kover/gradle-plugin/),
[ArchUnit](https://www.archunit.org/userguide/html/000_Index.html),
[Playwright accessibility](https://playwright.dev/docs/accessibility-testing),
[actionlint](https://github.com/rhysd/actionlint),
[ShellCheck](https://github.com/koalaman/shellcheck),
[Gitleaks](https://github.com/gitleaks/gitleaks), and
[Redocly lint](https://redocly.com/docs/cli/commands/lint).

### Integration Constraints Worth Testing First

**Knip:** configure the frontend and simulator as independent analysis roots or
explicit workspaces; there is no root npm workspace manifest. Validate Angular
entry points, lazy routes, library `public-api.ts`, stories, specs, scripts,
path aliases, and generated-client boundaries. Published exports are intentional
entries even when the application has no consumer yet. Do not silence entire
libraries to eliminate findings. Normal mode must cover test/tool dependencies;
production mode is an additional view, not a replacement.
[Configuration](https://knip.dev/reference/configuration),
[entry files](https://knip.dev/explanations/entry-files),
[production mode](https://knip.dev/features/production-mode).

**Stryker and Angular:** the documented Vitest runner consumes a Vitest config,
while this workspace uses `@angular/build:unit-test`. Angular exposes
`runnerConfig` but overrides some configuration and does not support arbitrary
third-party plugins. The Angular-specific Stryker guide documents Karma and
experimental Jest paths, so it is not evidence for this workspace's builder.
Local Angular runner source also shows a build step and runner-specific options.
A plain `vitest run` cannot be assumed to reproduce Angular TestBed compilation.
First prove identical test discovery and behavior for a narrow pilot. A separate
runner for framework-free code is viable if tests exercise the same implementation;
if direct integration fails, evaluate a command runner invoking `ng test` and
measure its rebuild cost before choosing it.
[Angular testing](https://angular.dev/guide/testing),
[Stryker Angular guide](https://stryker-mutator.io/docs/stryker-js/guides/angular/).

**PIT and Kotlin:** Kotest documents `io.kotest:kotest-extensions-pitest` on PIT's
tool classpath. JUnit Platform support alone is not proof of Kotest discovery.
Verify the Kotlin 2.3.21 / Kotest 6.2.3 / JDK 25 / Gradle 9.6.0 combination on a
small framework-free class. Compiler-generated Kotlin constructs can produce
confusing or equivalent mutants. Arcmutate supplies Kotlin-aware filters but
requires a licence; evaluating it is a separate owner cost decision. Do not
remove null-validation mutations broadly just to improve the score.
[Kotest integration](https://kotest.io/docs/extensions/pitest.html),
[Arcmutate Kotlin](https://docs.arcmutate.com/docs/kotlin.html).

**detekt:** its published table lists 1.23.8 with Kotlin 2.0.21 and JDK maximum
21, and preview 2.0.0-alpha.3 with Kotlin 2.3.21 / JDK maximum 25. These are
compatibility signals, not proof for our whole build. A supported version or an
explicit preview decision and isolated pilot is required; do not silently upgrade
the application compiler to satisfy a checker. Spring dependency alignment must
not replace detekt's required compiler dependencies.
[Compatibility table](https://github.com/detekt/detekt),
[Gradle integration](https://detekt.dev/docs/gettingstarted/gradle/).

## Recommendation

### Reproducible Gate Design

Use one aggregate entry point with underlying tool-owned checks and small
repository configuration. Custom scripts should handle repository-specific
semantics such as requirements totals or command routing, rather than duplicate
compiler, graph-analysis, mutation, or lint engines.

1. **Fast static gate on every change:** formatting, typed lint including tests
   and config, compilation, Knip, a small dependency-cruiser rule set, actionlint,
   and appropriate ShellCheck scope. Example graph rules: UI must not import
   application features/HTTP/router; components must not import generated DTOs;
   features must consume the documented API boundary; prevent cycles.
2. **Behavior gate on every change:** all actual unit suites, fixed example
   fixtures, targeted property tests with fixed seeds, coverage including
   unimported hand-written logic, production build, representative E2E and axe.
   Preserve existing aggregate checks, including legacy snapshots.
3. **Mutation gate after a pilot:** run a stable bounded set of important logic
   on every relevant PR if measured cost permits; use full runs at milestones
   and an explicit heavier command. Changed-file selection is an optimization,
   not complete evidence: test changes also require mutation re-evaluation and
   periodic full analysis. Do not make expensive full mutation runs part of
   every hot-reload loop.

Deterministic input requires pinned tools, lockfiles, local fixtures and schemas,
fixed locale/timezone/clock where relevant, isolated state, controlled concurrency,
and no calls to live providers. Dependency installation remains explicit setup;
vulnerability feeds and live-source refreshes remain separate mutable checks.

Property testing can be reproducible: commit a small seed set and fixed run
counts, record failure seeds and replay paths, and preserve minimized failures
as ordinary regression examples. Pins matter because generator changes can alter
the corpus for the same seed. Additional rotating seeds can expand exploration
in a separate run. Use clocks and schedulers under test control; a fixed seed
does not make operating-system thread scheduling deterministic. Kotest's default
failed-seed files under the user's home directory must not decide CI input;
configure explicit seeds and disable implicit seed persistence where appropriate.
[fast-check configuration](https://fast-check.dev/docs/configuration/),
[Kotest seeds](https://kotest.io/docs/proptest/property-test-seeds.html).

Browser tests remain less deterministic than static checks. Use a gate-owned
server, accepted local scenarios, isolated contexts, explicit time/locale,
stable locators and web-first assertions. Retries may retain diagnostics, but
flaky outcomes should fail CI using Playwright's `failOnFlakyTests`, available
since 1.52 and compatible with the installed 1.62.0. Unit runners must fail on
unexpected errors and focused tests; required suites must not silently pass with
zero discovered tests. Do not blanket-ban skips needed by a supported platform
matrix; require narrow documented exceptions.
[Playwright flaky-test option](https://playwright.dev/docs/api/class-testconfig#test-config-fail-on-flaky-tests).

### Measuring Test Strength Without Gaming The Metric

Start Stryker with a validation/mapping boundary, excluding generated code and
third-party output. `parseRuntimeConfig` is a useful existing pilot, but its
Angular imports require the runner proof described above. Exercise both acceptance
and rejection and verify returned data, not only that a method was called.

Report killed, survived, no-coverage, timeout, compile/runtime-error, and ignored
mutants separately, with selected file/operator scope and elapsed time. Stryker's
score counts timeouts as detected and excludes invalid mutants, so an impressive
percentage can mask execution problems. An unexplained zero-mutant run must not
pass a required mutation boundary. Every surviving meaningful mutant needs a
missing behavior assertion, a production correction, or a reviewed equivalence
explanation. Explicit reasoned exclusions are preferable to broad ignore globs.
[Stryker metrics](https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/).

Choose thresholds after a pilot baseline, not a universal 80%/100% target.
Small critical validators can justify detecting every meaningful selected mutant;
a repository-wide average can conceal an untested critical file. Coverage and
mutation scope/threshold reductions, growing baselines, and new suppression
comments need visible review. CI should run from the reviewed checkout with
protected merge requirements; an agent able to change both code and gate policy
can otherwise weaken a gate to obtain a pass.

Use acceptance examples as independent oracles. Useful property shapes include
normalization idempotence, preservation of valid required fields, rejection of
unsafe URL origins, and explicit lossless round trips where the contract promises
them. A round trip alone is insufficient if both directions share a defect.
Keep explicit negative fixtures and compare against a genuinely independent
reference where available. Avoid broad generator filters that discard the
interesting invalid cases. Future spatial properties require accepted CRS,
axis-order, precision, and uncertainty rules before assertion thresholds exist.

Prove the tooling itself on intentional temporary defects in an isolated checkout:
an unawaited assertion, empty/focused test, unused dependency, forbidden import,
known branch flip, and missing test discovery should produce nonzero failures.
Restore each defect; preserve the observed outcomes as acceptance evidence rather
than retaining broken product code. For a regression, demonstrate failure against
the old behavior and success with the fix when feasible.

## Alternatives Considered

- **Deferred: SonarQube, hosted analysis, and broad Semgrep rule packs.** Revisit
  when security/domain rules or centralized multi-repository reporting justify
  another service or rule engine. Current priorities are local reproducible
  checks; generic findings would overlap existing tools. These were not evaluated
  for adoption or benchmarked in this research.
- **Rejected for now: another JS test framework or Nx migration solely for checks.**
  Preserve Angular CLI and Vitest; revisit only if a required integration cannot
  be contained or repository scale makes existing orchestration inadequate.
- **Deferred: visual snapshots.** Add for stable rendering-sensitive capabilities
  with a controlled browser/OS/font baseline. They do not prove domain behavior.
- **Deferred: broad API fuzzing or consumer-driven contract infrastructure.**
  Revisit when accepted contracts and independent consumers exist. Begin with
  local description lint and real boundary tests; matching simulator fixtures
  alone do not prove backend conformance.
- **Rejected: coverage percentage or another agent review as the sole quality gate.**
  Neither supplies independent deterministic evidence of defect detection.
- **Rejected: replacing domain-specific legacy/index/link checks indiscriminately.**
  Established analyzers complement custom checks whose semantics belong here.

## Open Decisions

The owner's 2026-10-24 follow-up requests engineering requirements and sequential
increments grouped by safeguard, each with a coherent implementation outcome.
The recommended first scope is trustworthy test execution: suite routing,
test-specific lint, and runtime failure/isolation behavior. Static code and
dependency integrity and a bounded test-strength pilot are separate subsequent
outcomes. Automation safety and real contract/accessibility checks have distinct
acceptance boundaries. On 2026-10-24 the owner directed that unselected items stay
in the [inbox](../../INBOX.md#code-and-test-quality-safeguards), one item selected
at a time; a temporary project is created only for current work. No tooling
adoption or implementation authorization is inferred here.
Backend quality work remains an independently named owner-authorized scope.

Before implementation, decide the acceptable PR runtime increase, mutation scope,
and backend preview/licence tolerance. Numeric coverage/mutation thresholds depend
on measured results. No package installation, benchmark, mutation execution, or
backend change was performed for this research. Documentation establishes
capabilities; exact peer dependencies, Angular runner equivalence, Kotlin plugin
compatibility, false-positive rates, and runtime cost remain unverified.

Research artifact verification: `mise run verify` passed on 2026-10-06 after
granting access to the local Gradle cache blocked by the filesystem sandbox.
This includes valid local links, frontend 11 unit tests and one browser test,
simulator two tests, requirements and legacy gates, and Gradle `check` using
up-to-date task results. Storybook emitted non-failing documentation/size warnings.
These results validate the existing baseline, not any proposed tool integration.
