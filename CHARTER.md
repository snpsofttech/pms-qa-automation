# QA Automation Charter

`pms-qa-automation` exists to **test the PMS application and report bugs**.
It has exactly one job, done six ways:

1. Run automated tests.
2. Detect failures.
3. Classify each failure: **Application bug** / **QA bug** / **Environment
   issue** / **Expected behavior**.
4. Collect evidence (trace, screenshot, response body, error message).
5. Produce a precise bug report (see template below).
6. Mark the test **PASS / FAIL / BLOCKED / SKIPPED**.
7. Suggest a likely root cause when the evidence supports it.

## What this repository must never do

This repo may **only** modify itself — test files and framework code inside
`pms-qa-automation`. It must **never**:

- Modify any file in `pms-frontend-multitenant`, `pms-client-multitenant`,
  or anything under `c:\services\*`.
- Fix source code, controllers, routes, frontend components, or database
  schemas in any of those repositories.
- Change production configuration or application environment variables.
- Commit a fix to an application repository, or open a PR containing one.
- "Auto-retry by changing application behavior" — a flaky/failing test gets
  investigated and reported, never patched around.
- Add authentication, tenant filtering, or any other fix to an endpoint it
  finds insecure. If `known-gaps.spec.ts` finds an unauthenticated
  endpoint, the correct output is a P1/P0 bug report, never a `protect`
  middleware added to that service's route file.

**Deleting QA-created test data via the API** (`helpers/cleanup.ts`,
`trackCreatedResource`/`cleanupTrackedResources`) is not covered by the
rule above — that's routine test hygiene against data this suite itself
created (always named via `qaName()`), not a modification to any
repository's code, schema, or configuration. It never touches anything not
explicitly tracked by a test.

## Workflow

```
Application
    ↓
QA Automation
    ↓
Test
    ↓
FAIL
    ↓
Investigate (classify + collect evidence)
    ↓
Bug Report
    ↓
Developer fixes application   ← NOT this repo's job
    ↓
QA runs again
    ↓
PASS
```

## Test result states

- **PASS** — the assertion held.
- **FAIL** — the assertion did not hold; a bug report must exist for it
  (see below — this is enforced automatically by `reporters/
  bugReportReporter.ts` even if a test author forgets to attach one).
- **BLOCKED** — the test could not run to a real verdict because a
  prerequisite was missing (no test data in this environment, a dependent
  service unreachable, a known upstream blocker like the Gmail-connected-
  admin gate on invoice/proposal creation). Implemented via `test.skip(
  condition, 'BLOCKED: <reason>')` — see `helpers/triage.ts`'s
  `blockTest()` wrapper. Distinct from SKIPPED: a blocked test *would* have
  something meaningful to say if the blocker were removed.
- **SKIPPED** — deliberately not implemented yet or deliberately excluded
  (`test.fixme()` for the not-yet-implemented critical flows, e.g.).

## Bug report template

Every FAIL should carry a report shaped like this — see
`helpers/bugReport.ts`'s `BugReport` type and `attachBugReport()`, and
`tests/api/tenancy/known-gaps.spec.ts` for a worked example.

```
Priority: P0 | P1 | P2 | P3
Title: <one line>
Environment: local | staging | production
Repository: <exact repo path>
File: <exact file, if identified>
Function/Component: <exact function or component, if identified>
Endpoint/UI location: <route or page>
Steps to reproduce: <numbered>
Expected behavior: <...>
Actual behavior: <...>
Error message: <exact text>
Root cause: <if confirmed, else omit>
Evidence: <trace/screenshot paths, response bodies, logs>
Test case: <spec file + test title>
Status: Confirmed | Suspected | Blocked | Needs Investigation
```

Reports land as markdown files under `bug-reports/` — one per finding,
committed to this repo as the durable audit trail of what QA has found.
`bug-reports/auto/` holds reporter-generated skeletons for failures nobody
manually classified yet (title, error, evidence — classification left as
"Needs Investigation" until a human or a follow-up investigation pass fills
it in). A hand-authored report in `bug-reports/` always supersedes an
auto-generated one for the same failure.

## Priority definitions

| | |
|---|---|
| **P0** | Security vulnerability, cross-tenant data leak, data loss, or a complete block on a critical business flow. |
| **P1** | Major feature broken with no workaround; confirmed bug affecting a whole module. |
| **P2** | Feature partially broken; a workaround exists. |
| **P3** | Cosmetic or edge-case issue. |
