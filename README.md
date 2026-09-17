# pms-qa-automation

Independent Playwright QA automation suite for the PMS Multitenant platform.
Completely separate from the three application repositories — nothing here
is imported by or affects `pms-frontend-multitenant`, `pms-client-multitenant`,
or the services under `c:\services`. See [ARCHITECTURE.md](./ARCHITECTURE.md)
for the full recon this suite is built against.

**Read [CHARTER.md](./CHARTER.md) first.** This suite tests the application
and reports bugs — it never fixes them, and it never modifies any of the
three application repositories. Every test failure gets classified
(Application bug / QA bug / Environment issue / Expected behavior) and
turned into a precise report under `bug-reports/`, not a patch.

## 1. Repository structure

```
pms-qa-automation/
├── tests/
│   ├── smoke/              admin.smoke, client.smoke, api.smoke
│   ├── admin/auth/         admin login mechanics
│   ├── client/auth/        client login mechanics
│   ├── api/
│   │   ├── auth/           login contract, rejection tests, service-auth-boundary sweep
│   │   └── tenancy/        cross-tenant isolation suite (Phase 7), incl. known-gaps.spec.ts
│   └── integration/        critical business flows (Phase 8)
├── pages/
│   ├── admin/               LoginPage, DashboardPage, JobsPage, InvoicePage, DocumentsPage
│   └── client/               LoginPage, DashboardPage
├── fixtures/
│   ├── auth.fixture.ts      adminPage / clientPage / clientPageFast / *Session / apis
│   ├── tenant.fixture.ts    tenantA / tenantB paired identities
│   └── testData.fixture.ts  qaName() + per-domain payload builders
├── helpers/
│   ├── config.ts             env loading + assertNotProduction()
│   ├── apiClient.ts           ApiClient class, loginAsAdmin/loginAsClient
│   ├── assertions.ts          expectSuccess/expectUnauthorized/expectAuthorizationFailure/expectNoLeakedIds
│   ├── cleanup.ts             QA_PREFIX, trackCreatedResource, cleanupTrackedResources
│   ├── bugReport.ts           BugReport type, writeBugReport(), attachBugReport() — see CHARTER.md
│   ├── serviceCatalog.ts      all 15 services + verified probe endpoints (single source of truth)
│   └── triage.ts              blockTest() — marks a test BLOCKED rather than SKIPPED
├── reporters/
│   └── bugReportReporter.ts   auto-generates a report skeleton for any un-classified failure
├── scripts/
│   ├── globalSetup.ts         fail-fast credential check, creates .auth/ and qa-data/
│   └── globalTeardown.ts      deletes everything tracked via trackCreatedResource
├── bug-reports/                findings — one markdown file per bug, committed as an audit trail
│   └── auto/                   reporter-generated skeletons awaiting manual triage
├── playwright.config.ts       8 projects: admin, client, api, integration, smoke-admin/client/api
├── .env.example
├── CHARTER.md
└── ARCHITECTURE.md
```

## 2. Architecture explanation

See [ARCHITECTURE.md](./ARCHITECTURE.md) in full. Short version: two CRA
frontends (admin at `/admin`, client at `/client`), each calling ~13
microservices directly with no gateway; every service authenticates via a
JWT `Authorization: Bearer` header carrying `{ id, role, tenantId }`, issued
by `signup-login-backend` (admin/team_member) or `account-contact-backend`
(client contacts).

## 3. Installed dependencies

`@playwright/test`, `typescript`, `dotenv`, `cross-env`, `@types/node` — all
devDependencies. Installed and verified: `npm install` and `npx tsc --noEmit`
pass clean, and the suite runs green-except-for-real-bugs against staging
(**68 tests across 7 projects**). Chromium is installed; on a fresh checkout
run `npm run install:browsers` before anything that opens a real page (the
`admin`/`client`/`integration`/`smoke-admin`/`smoke-client` projects;
`api`/`smoke-api` need no browser).

## 4. How authentication fixtures work

Neither app's session fits Playwright's native `storageState` cleanly (see
ARCHITECTURE.md for why: admin's token is in-memory + an HTTPS-only cookie,
client's is in `sessionStorage` which `storageState` doesn't capture at
all). So `fixtures/auth.fixture.ts` takes three different approaches:

- **`adminPage`** — real UI login through `AdminLoginPage` every time. The
  only reliable option given the in-memory token.
- **`clientPage`** — real UI login through `ClientLoginPage`.
- **`clientPageFast`** — logs in over the API (`loginAsClient`), then seeds
  `sessionStorage` directly via `page.evaluate` before navigating to
  `/home`. Use this when a test needs an authenticated client session but
  isn't testing login itself.
- **`adminSession` / `adminBSession` / `clientSession` / `clientBSession`**
  — pure API-level sessions (no browser at all) for `tests/api/**`, one per
  QA identity (tenant A admin, tenant B admin, tenant A client, tenant B
  client).

## 5. How the API client works

`helpers/apiClient.ts` exports `apiClients(request)`, which returns one
`ApiClient` per backend service, each already pointed at that service's
`config.services.*` base URL. `client.as(session)` returns a new client
bound to a given `AuthSession`'s bearer token — so the same call can be run
as Tenant A vs Tenant B by swapping `.as(...)`. `loginAsAdmin` /
`loginAsClient` hit the real login endpoints and return a typed
`AuthSession`; contracts are documented and cited in ARCHITECTURE.md, not
guessed.

## 6. How tenant isolation tests work

`fixtures/tenant.fixture.ts` pairs up `tenantA`/`tenantB` identities.
`tests/api/tenancy/*.spec.ts` follows the pattern from Phase 7: read an
existing resource that belongs to Tenant B (never fabricate an id), then
attempt to read/delete it as Tenant A, and assert an authorization failure
(`helpers/assertions.ts`'s `expectAuthorizationFailure` accepts 401/403/404
— several services here return 404 instead of 403 to avoid confirming a
resource exists, and both count as "isolated"). Tests mark themselves
**BLOCKED** (`blockTest()`) rather than failing when the target tenant has
no data in a given environment — that's an environment-data gap, not a
product bug.

One caution learned the hard way: list responses must be parsed with
`extractList()`. An earlier version assumed a `{data:[…]}` envelope, got
`undefined` from endpoints that return bare arrays, and reported BLOCKED —
silently stepping over a confirmed P0. A tenancy test that can't find its
data should be loud, never quietly green.

`tests/api/tenancy/known-gaps.spec.ts` is different on purpose: it tracks
three **confirmed, live-verified** holes — `sidebar-backend` (writes
unauthenticated), `client-sidebar-backend` (no auth anywhere), and
`folder-mangement` (one router mounted without `protect` while the other
four have it). Those tests assert the correct, secure behavior and are
expected to **fail** until the services are fixed; leave them in as a live
regression tracker. Per CHARTER.md, finding a hole means writing the bug
report, never adding the missing `protect` call yourself.

`tests/api/auth/service-auth-boundary.spec.ts` complements this: it sweeps
every service in `helpers/serviceCatalog.ts` that is supposed to require
auth and asserts it rejects both anonymous and malformed-token reads. That
catalog is the single source of truth — adding a service there enrolls it in
both the smoke suite and the auth sweep automatically.

## Bug reporting (see CHARTER.md for the full policy)

Two mechanisms, working together:

- **Manual, precise**: a test that already knows what it's looking at calls
  `attachBugReport(testInfo, {...})` (`helpers/bugReport.ts`) *before* its
  failing assertion, so the report — priority, classification, exact
  file/endpoint, steps to reproduce, real captured evidence — is written
  even though the test itself still fails afterward. `known-gaps.spec.ts` is
  the worked example: it captures the real HTTP status/body it observed,
  cites the exact route file missing `protect`, and writes a P1 report to
  `bug-reports/` before asserting.
- **Automatic, generic**: `reporters/bugReportReporter.ts` runs after every
  test. If a FAIL didn't already get a manually-attached report, it writes a
  skeleton to `bug-reports/auto/` — title, error, stack, evidence — with
  classification left as `UNCLASSIFIED — Needs Investigation`. This is the
  safety net: every failure gets *some* report, even in specs nobody
  hand-instrumented, but the reporter never guesses at classification or
  root cause. A hand-authored report always supersedes the auto one for the
  same failure.

`bug-reports/` is committed (not git-ignored) — it's meant to accumulate as
the durable record of what QA has found, reviewed by developers who then fix
the application separately, at which point the corresponding test is re-run
to confirm PASS.

## 7. How to run — Local

1. `npm install` (already done in this checkout)
2. `npm run install:browsers`
3. Copy `.env.example` to `.env.local` and fill in real values — a starter
   `.env.local` is already checked out locally (git-ignored) with the
   default local ports from each service's `server.js`; replace the
   `QA_*` placeholder credentials with real ones.
4. Start whichever services/frontends you're testing locally.
5. `npm test` (all projects) or a scoped run: `npm run test:smoke`,
   `npm run test:admin`, `npm run test:api`, `npm run test:tenancy`, etc.

## 8. How to run — Staging

Copy `.env.example` to `.env.staging`, fill in the staging URLs/creds, then:
```
npm run test:staging          # TEST_ENV=staging, full suite
cross-env TEST_ENV=staging npm run test:smoke
```
Staging is HTTPS, so this is also the first environment where the admin
app's refresh-token cookie actually persists across page loads if you
choose to experiment with browser-level session reuse beyond what the
fixtures already do.

## 9. How Production smoke mode is protected

Multiple independent layers, not just one flag:

- `npm run test:production` only ever invokes `--project=smoke-admin
  --project=smoke-client --project=smoke-api` — the `admin`, `client`,
  `api`, `integration`, and tenancy suites are structurally excluded from
  ever running against production, regardless of what's in `.env.production`.
- `helpers/config.ts` exposes `config.isProduction`; `assertNotProduction()`
  throws immediately if any destructive helper (`trackCreatedResource`,
  `cleanupTrackedResources`) is ever called while `TEST_ENV=production`.
- The smoke tests themselves only perform GETs and a login, per Phase 11 —
  no creates, deletes, or emails anywhere in `tests/smoke/`.

## 10. Example HTML report

`npx playwright show-report` after any run opens the HTML report configured
in `playwright.config.ts` (`reporter: [['html', {open:'never'}], ['list']]`),
with screenshots, traces, and video attached to every failure
(`trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`,
`video: 'retain-on-failure'`). A conceptual view of what it groups into:

```
Smoke Tests
  Admin        (application loads, login renders, dashboard renders)
  Client       (portal loads, login renders, home renders)
  API          (sidebar/client-sidebar public routes, 4 central services)

Critical Flows
  Flow 1 — Job creation           (implemented)
  Flow 2 — Document visibility    (fixme — blocked, see ARCHITECTURE.md)
  Flow 3 — Invoice to client      (fixme — blocked, see ARCHITECTURE.md)
  Flow 4 — Proposal to client     (fixme — blocked, see ARCHITECTURE.md)

Tenant Isolation
  Jobs                (2 tests)
  Accounts/Contacts   (2 tests)
  Known gaps          (2 tests, expected to fail until fixed)
```

## 11. Implemented smoke tests

Last full run against staging, 2026-09-10: **56 passed / 6 failed / 6 skipped**
(68 tests). Every failure is a confirmed application defect with a bug
report; every skip is legitimately BLOCKED, not a hidden failure.

- **Admin UI** (3): login screen renders (JS+CSS up, not blank), no failed
  asset requests, dashboard renders after a real UI login.
- **Client UI** (3): the same three against the client portal.
- **Backend** (15): one test per service, each hitting the cheapest
  side-effect-free read, catalogued in `helpers/serviceCatalog.ts`. One test
  per service rather than a loop, so the report names the failing service
  and one outage can't mask the rest.
- **Auth boundary** (24): every service expected to require auth is asserted
  to reject both an anonymous read and a malformed bearer token. This is the
  suite that would have caught the sidebar gaps without anyone thinking to
  look for them — adding a service to the catalog enrolls it automatically.

## 12. Implemented critical flows

- **Flow 1 (Admin → Dashboard → Create Job → Verify)** — implemented, but
  currently **BLOCKED**: the QA tenant has no pipeline, and `createJob`
  requires one. Unblocking needs a pipeline + job seeded in Tenant A.
- **Flows 2, 3, 4** — `test.fixme()`, blocked upstream. Flow 2 needs the
  document-upload UI observed once to capture selectors; Flows 3 and 4 are
  blocked by the Gmail-connected-admin gate on invoice and account-proposal
  creation (see `bug-reports/CLOSED-expected-tenant-scoped-emails-not-sent.md`
  — that gate is intended behavior, so these stay blocked by design until a
  QA admin has a connected mailbox).

## 13. Services currently covered

**All 15** have smoke coverage and are enrolled in the auth-boundary sweep.
Deeper coverage beyond that:

| Service | Beyond smoke |
|---|---|
| signup-login-backend | login contract, wrong-password rejection, token rejection |
| account-contact-backend | tenant isolation (list + by-id), field-exposure assertions |
| jobs-backend | tenant isolation (read + delete) — currently BLOCKED, no jobs in Tenant B |
| sidebar-backend / client-sidebar-backend / folder-mangement | dedicated known-gap tests |

## 14. Services not yet covered beyond smoke

account-note-backend, account-task-backend, proposal-backend,
esignature-backend, internal-communication, organizer-backend,
templates-backend, chat-backend. Each has a verified probe endpoint in
`helpers/serviceCatalog.ts`, so adding functional or tenancy tests starts
from a known-good call rather than from scratch.

## 15. Recommended next 10 QA tests, in priority order

1. **esignature-backend tenant isolation** — the one service confirmed to
   only partially filter by `tenantId` (only `generate-token` stamps it;
   lookups by id/externalId don't). Highest-value untested suspicion.
2. **Seed a pipeline + job in Tenant A**, unblocking Flow 1 and the two
   jobs-tenancy tests. Small additive writes; needs sign-off.
3. **Cross-tenant write attempts** — isolation is currently only proven for
   reads. PATCH/DELETE across tenants on accounts and contacts, given
   `toggleContactLogin` and `addContactsToAccount` use the same defective
   `findById({_id, tenantId})` idiom.
4. **Client-role tenant isolation** — all current isolation tests use admin
   tokens; a client contact's token is a different code path.
5. account-task-backend and account-note-backend tenancy (both use a clean
   `req.user.tenantId` filter, so these should pass — worth locking in).
6. Resolve Flow 2's blocker and implement document upload/visibility.
7. proposal-backend tenancy via `/api/proposals` (not Gmail-gated, unlike
   the account-proposal route).
8. Field-exposure sweep across all services — the contact API leaks password
   hashes; nothing has checked whether others do too.
9. organizer-backend `POST /organizersendemail` — root-mounted and
   unauthenticated per recon, never verified live.
10. **Cross-service token acceptance** — confirm a JWT from
    signup-login-backend is interpreted identically by all 14 others. It's
    the shared-secret assumption the whole platform rests on and has never
    been directly tested.

## Production safety rules (enforced structurally, see §9)

- Do not modify `pms-frontend-multitenant`, `pms-client-multitenant`, or
  anything under `c:\services` from this repo.
- Do not run anything beyond `npm run test:production` against
  `TEST_ENV=production`.
- Never commit a filled-in `.env.*` file — only `.env.example`.
- Every QA-created record must be named via `qaName()`
  (`fixtures/testData.fixture.ts`) and registered via `trackCreatedResource`
  (`helpers/cleanup.ts`) so `globalTeardown.ts` can remove it — never rely on
  manual cleanup.
