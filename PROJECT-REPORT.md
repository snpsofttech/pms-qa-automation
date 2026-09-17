# PMS QA Automation — Project Report

_Generated 2026-09-12. Covers the work from initial architecture inspection
through the QA framework build, live security testing on staging, and the
cross-tenant vulnerability fix._

This is a generalized summary. Per-bug detail with reproduction steps and
evidence lives in `bug-reports/`. Architecture ground truth is in
`ARCHITECTURE.md`; the "what QA may and may not do" rules are in `CHARTER.md`.

---

## 1. Scope and approach

The PMS platform is three parts: an **admin frontend**
(`pms-frontend-multitenant`, served at `/admin`), a **client frontend**
(`pms-client-multitenant`, `/client`), and **15 Node/Express microservices**
(`c:\services\*`). All were inspected read-only first, then a dedicated,
independent QA project (`pms-qa-automation`, Playwright + TypeScript) was
built alongside them.

A firm boundary was set and kept throughout (see `CHARTER.md`): QA **tests and
reports**, it does not fix application code — except where the user later
explicitly directed one fix (the cross-tenant tenancy vulnerability, §6).
Nothing was ever committed, and no change was deployed to staging or
production.

---

## 2. What was built — the QA framework

A single-tool suite (Playwright drives both UI and API, no Jest/Supertest):

- **Smoke tests** — admin UI, client UI, and one liveness probe per backend
  service (all 15).
- **Auth-boundary sweep** — every service that should require a token is
  asserted to reject both anonymous and malformed-token requests.
- **Tenant-isolation suite** — cross-tenant reads and writes between two
  dedicated QA tenants (the core security tests).
- **Critical business flows** — job creation implemented; document, invoice,
  and proposal flows scaffolded and blocked on documented upstream reasons.
- **Supporting infrastructure** — per-service API client with typed auth
  sessions, a service catalog as single source of truth, auth fixtures for
  both apps, a machine- and human-readable bug-report system, a reporter that
  auto-generates a report skeleton for any unclassified failure, environment
  config for local/staging/production with production hard-blocked, and
  QA-data cleanup tracking.

Two QA tenants (A and B), each with an admin and an activated client contact,
were provisioned on staging **through the application's own signup/activation
APIs** so cross-tenant isolation could be tested with real, isolated data.
Credentials live only in the git-ignored `.env.staging`.

---

## 3. Application bugs found

All confirmed live on staging unless noted. Severity: P0 = critical
(security/data loss), P1 = major, P2 = feature broken with workaround,
P3 = cosmetic/config.

| # | Sev | Area | Bug | Root cause | Status |
|---|-----|------|-----|-----------|--------|
| 1 | **P0** | account-contact-backend | **Cross-tenant READ** — any admin can read any other tenant's accounts/contacts by ID | `Model.findById({_id, tenantId})` — an object passed to `findById` is cast to `_id`, silently dropping the `tenantId` filter | **Fixed locally** (undeployed) |
| 2 | **P0** | account-contact-backend | **Cross-tenant WRITE** — an admin can modify/attach/detach/archive another tenant's accounts and contacts (7 handlers) | Same object-arg defect in `findByIdAndUpdate`, plus one `updateMany` with `tenantId` in the update document instead of the filter | **Fixed locally** (undeployed) |
| 3 | **P0** | account-contact-backend | Contact API returns **password hashes and activation tokens** in responses | `getContactById` returns the raw document; `ContactModel` has no `select:false`/`toJSON` transform on those fields | **Open** |
| 4 | **P1** | client-sidebar-backend | **No authentication on any route** | Service has no auth middleware at all | **Open** |
| 5 | **P1** | sidebar-backend | `/api/newsidebar` routes (incl. writes) unauthenticated | `protect` applied to one route only, not this router | **Open** |
| 6 | **P1** | folder-mangement | `/tempfolder/docManagement` router unauthenticated | That router mounted without the `protect` the other four routers use | **Open** |
| 7 | **P2** | jobs-backend | `GET /jobs/count` and `/jobs/list` always 500 | Routes shadowed by `/jobs/:id` declared earlier; `"count"` is cast to an ObjectId | **Open** |
| 8 | **P3** | nginx (staging) | Bare `/admin`, `/client`, `/` serve the nginx default page | Reverse-proxy locations require the trailing slash | **Open** |

### Related findings, classified but not "bugs to fix"

- **Contact activation emails fail silently** (API returns 201, no email
  sent). Root cause: tenant-scoped email requires the tenant admin's
  connected Gmail, which new tenants don't have. **Reclassified as expected
  behavior** — the platform intentionally keeps notifications off except for
  selected accounts (`CLOSED-expected-tenant-scoped-emails-not-sent.md`). Its
  side effect: invoice and proposal creation hard-fail `400 "Please connect
  Gmail first"`, which is why critical flows 3 and 4 remain blocked.
- **Public `activate/set-password/:token` endpoint** (no auth) — benign
  alone, but it was the final link in an account-takeover chain (see below).
- **Client app logout** navigates to `/client/login`, a route that doesn't
  exist — noted during recon.

### The account-takeover chain (why the account-contact P0s are severe)

Bugs 1 + 3 + the public set-password endpoint composed into full takeover of
another tenant's client accounts: read a foreign tenant's contact (bug 1),
read its activation token from the response (bug 3), set a password via the
public endpoint, log in as that client. Bug 2 (`toggleContactLogin`) even
mints a fresh token on demand, so already-activated contacts were reachable
too. Each link was verified individually; the takeover itself was **not**
executed across tenants (that would seize an account, not observe a defect).

---

## 4. How the bugs were found

- **Source inspection first**, then live confirmation. The tenant-scoping
  defect was spotted by reading controllers, then proven against staging.
- **Auth boundaries** were found by a systematic sweep of every service — the
  sidebar and folder-mangement gaps would not have been found by feature
  testing.
- **One empirical write probe** confirmed the cross-tenant write: as Tenant A,
  a single benign field on Tenant B's account was changed (HTTP 200), verified
  as Tenant B, then restored to its original value — controlled, reversible,
  disposable QA data only.
- **Git history** dated the tenancy defect to at least 2026-07-30 (the oldest
  available commit already contains it); the true origin predates local
  history.

---

## 5. QA-framework bugs found and fixed during test runs

Running the suite against the real system exposed several defects in the QA
code itself. These are recorded because each silently broke a test before it
was understood — the failure modes are instructive:

| QA bug | Effect | Fix |
|--------|--------|-----|
| Assumed `{data:[…]}` list envelope | Endpoints return bare arrays / `{jobList}` / `{pipeline}`; parsing got `undefined`, so a tenancy test **skipped past a confirmed P0** | `extractList()` normalizer |
| Field-exposure check read only top-level keys | The record is wrapped in `{success, data:{…}}`; the exposed hash sat one level down → false negative | `hasKeyDeep()` recursive check |
| `page.goto('/login')` | Playwright resolves a leading slash against the origin, discarding the `/admin` base path → hit nginx's default page | Navigate via page objects (absolute URLs) |
| Admin login page object filled only email+password | The form also requires a duration select and a terms checkbox → login never submitted | Page object now sets all four inputs |
| API paths without trailing slash | nginx 301; a followed 301 on POST drops the body | `ApiClient` uses `maxRedirects:0` so it fails loudly |
| Bug-report filenames timestamped | New duplicate files every run | Stable filenames; timestamp moved into content |
| Auto-reporter slug truncated at the front | Tests in one describe collapsed to one filename | Slug from the tail + a hash of the full title |

---

## 6. The fix that was applied (cross-tenant tenancy)

At explicit user direction, the tenancy vulnerability (bugs 1 and 2) was
fixed in the **local working copy** of `account-contact-backend`
(uncommitted, undeployed — the running services are on a remote host, so no
environment was changed):

- **10** `findById({_id, tenantId})` reads → `findOne({_id, tenantId})`.
- **3** object-arg `findByIdAndUpdate({_id, tenantId})` writes →
  `findOneAndUpdate({_id, tenantId})`, with `_id`/`tenantId` stripped from the
  mass-assigned `$set` body to prevent self-reassignment.
- **1** `updateMany` with `tenantId` misplaced in the update document → moved
  into the filter.

Verified: no residual object-arg calls, both files pass `node --check`, and
the two legitimate string-argument `findById()` calls were left untouched. A
sweep confirmed the idiom exists in **no other service** — the fix is
contained to this one backend.

**Regression tests** were added: cross-tenant reads (account + contact by ID)
and one test per affected write handler. The write tests capture original
state, attempt the cross-tenant write as the attacker, and restore in a
`finally`, asserting the write is rejected and the record is unchanged — so
they are safe to run even against a still-vulnerable target. They are gated
behind `ALLOW_TENANCY_WRITE_PROBES` and meant to run **after the fix is
deployed**, because firing the `updateAccountActiveStatus` probe at unpatched
code risks an irreversible tenant reassignment.

---

## 7. Current suite status (against staging, fix not yet deployed)

**56 passed / 6 failed / 13 skipped.**

- The **6 failures** are all real, still-present-on-staging issues: the 2
  cross-tenant reads (fixed locally, will pass once deployed), the field
  exposure (bug 3), and the 3 auth-boundary gaps (bugs 4–6).
- **13 skipped** = 7 gated write probes (run post-deploy) + 2 jobs-tenancy
  (Tenant B has no jobs yet) + 4 critical flows (blocked as documented).
- The admin and client UIs both log in and render end-to-end; all smoke and
  auth-boundary tests pass for the 12 services that enforce auth correctly.

---

## 8. Open items and recommended next steps

1. **Deploy the account-contact-backend fix** to staging, then re-run with
   `ALLOW_TENANCY_WRITE_PROBES=1` — the read tests and all write probes should
   go green.
2. **Fix bug 3** (field exposure): `select:false` on `password`/
   `activationToken` plus a `toJSON` transform. Small, contained; breaks the
   takeover chain independently of the tenancy fix.
3. **Fix bugs 4–6** (auth boundaries) — add the missing `protect` middleware;
   the auth-boundary sweep will confirm each fix.
4. **Fix bug 7** (route ordering) and **bug 8** (nginx trailing slash).
5. Seed a pipeline + job in Tenant A to unblock critical flow 1 and the
   jobs-tenancy tests (small additive writes; needs sign-off).
6. Extend tenancy/functional coverage to the 8 services that currently have
   only smoke coverage.

---

## 9. Guarantees held throughout

- No production system was tested or modified.
- No application source was changed except the one user-directed tenancy fix,
  which remains local and uncommitted.
- No commits were made in any repository.
- All test data was created through supported APIs, in dedicated QA tenants,
  and credentials were never printed or committed.
