# Inbox

Loose, unverified owner input. Entries are not requirements or implementation
approval.

## Untriaged

### Code And Test Quality Safeguards

Proposed order; select one item at a time and create its project when work starts.
See [research](docs/research/code-and-test-quality-tooling.md) for evidence and tradeoffs.

- [ ] **Q1 — Trustworthy test execution:** run all intended suites; reject empty,
  focused, incorrectly awaited, and flaky tests. Use test lint and runner checks.
- [ ] **Q2 — Static code and dependency integrity:** catch unsafe typed operations,
  unused code, cycles, and forbidden imports with ESLint, Knip, and dependency-cruiser.
- [ ] **Q3 — Test effectiveness:** pilot coverage, StrykerJS, and fast-check on
  important logic; prove defect detection and reproducible counterexamples.
- [ ] **Q4 — Automation safety:** check CI, shell scripts, and committed secrets
  with actionlint, ShellCheck, and Gitleaks. Move earlier when automation changes.
- [ ] **Q5 — Contracts and accessibility:** validate real API boundaries and rendered
  interactions with contract checks and Playwright/axe when a feature needs them.
