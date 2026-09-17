# PMS Multitenant — architecture notes for QA automation

Captured 2026-09-08 via read-only inspection of the three source repos, then
**corrected 2026-09-10 against a live staging run**. This is the ground truth
the test code is written against — if the apps change, update this file and
the affected tests together.

## Verified-by-running facts (these corrected earlier assumptions)

Everything below was wrong or unknown until the suite actually ran. They are
the highest-value part of this document, because each one silently broke a
test before it was understood.

| Fact | Consequence for tests |
|---|---|
| The frontends are served at **`/admin/` and `/client/` (trailing slash required)**. Bare `/admin`, `/client` and `/` all serve nginx's stock welcome page with HTTP 200. | Never `page.goto('/login')` — Playwright resolves a leading-slash path against the baseURL's *origin* and discards the base path, landing on the nginx page. Always navigate via the page objects, which build absolute URLs. See `bug-reports/P3-bare-admin-and-client-paths-serve-nginx-default-page.md`. |
| API routers mounted at `/` (`/api/clientaccounts`, `/api/contacts`, `/account/notes`, `/clientsidebar`, `/api/newsidebar`) **301 to the trailing-slash form**. | `ApiClient` sets `maxRedirects: 0` so this surfaces loudly. A followed 301 on a POST is replayed as a GET with the body dropped — a "create" would appear to succeed having written nothing. |
| **List endpoints have inconsistent envelopes**: `/api/clientaccounts/` and `/api/contacts/` return bare arrays; `/workflow/jobs/jobs` returns `{jobList:[…]}`; `/temp/pipeline/pipelines` returns `{message, pipeline:[…]}`. None use `{data:[…]}`. | Always parse with `extractList()` (`helpers/assertions.ts`). Assuming `.data` made tenancy specs read `undefined` and **skip past a confirmed P0**. |
| `GET /api/contacts/contact/:id` wraps the record as **`{success, data:{…}}`**, unlike the bare-array list endpoint. | Field-exposure assertions must search recursively (`hasKeyDeep()`); a top-level key check gave a false negative on an exposed password hash. |
| The **admin login form has four required inputs**, not two: email, password, a "Stay signed in for" duration (Radix `Select`), and an "Agree to Terms & Conditions" checkbox. Both extra fields are enforced client-side (`Login.js:481`, `:489`). | `AdminLoginPage.loginAs()` selects a duration and ticks the checkbox. Filling only email+password leaves you on `/login` with a toast and no redirect. |
| `GET /workflow/jobs/jobs/count` and `/jobs/list` **always 500** (shadowed by `/jobs/:id`). | Smoke probe uses `GET /workflow/jobs/jobs` instead. See `bug-reports/P2-jobs-count-and-list-routes-shadowed-by-id-route.md`. |

## Frontends

Both are CRA (`react-scripts`) apps using `react-router-dom` v7 with a single
`<Routes>` tree in `src/App.js`, and a `<BrowserRouter basename={REACT_APP_BASE_PATH}>`.
Neither has a single `data-testid`, `id`, or `aria-label` on any interactive
element anywhere in the codebase — all Playwright locators in this repo fall
back to `name` attributes, placeholder text, or ARIA role/text.

Neither app sends a tenant header on requests. Tenancy is resolved entirely
server-side from the JWT the app already holds — there's nothing tenant-shaped
in the URL or headers for tests to manipulate.

In *code*, neither app has a shared API gateway: each defines ~12–13 axios
instances, one per `REACT_APP_*` base URL, in `src/services/api.js`.

**In deployment, they all collapse onto one origin.** Verified on staging
2026-09-10: `pms-frontend-multitenant/.env.local` points every single
`REACT_APP_*` service variable at `https://staging-admin.snptaxes.com`, and
both frontends are served from that same host (`/admin` and `/client`, both
`200`). A reverse proxy routes to each service by path prefix — which is
why every service has a distinct, non-overlapping base path (`/api/auth`,
`/workflow/jobs`, `/temp/*`, `/accounts/docs`, `/clientsidebar`, …).

Two consequences for testing: the per-service ports listed below are
**internal only** and not reachable from a test runner in a deployed
environment; and in `.env.staging` every `*_API` variable is correctly set
to the same host, with the path prefixes in `helpers/apiClient.ts` calls
doing the service selection.

### Admin (`pms-frontend-multitenant`, served at `/admin`)

| | |
|---|---|
| Login route | `/login` (`src/login-signup/Login.js`) |
| Login fields | `input[name="email"]`, `input[name="password"]` |
| Login submit | `<button onClick={loginuser}>Login</button>` — **not** `type="submit"`, **not** inside a `<form>`. Enter does nothing; must click. |
| Login call | `POST {REACT_APP_AUTH_USER}/api/auth/login` |
| Token storage | Access token: in-memory JS variable only (`src/services/tokenService.js`), lost on refresh. Refresh token: httpOnly cookie, `Secure`, `SameSite=None` — **only sent over HTTPS**, silently dropped on `http://localhost`. |
| Session restore | `AuthContext` calls `/api/auth/refresh-token` on mount and every 5 minutes. |
| Post-login redirect | `/insights` |
| Logout | `POST /api/auth/logout`, hardcodes redirect to `/admin/login` |

### Client (`pms-client-multitenant`, served at `/client`)

| | |
|---|---|
| Login route | `/login` (`src/login-signup/Signin.js`) |
| Login fields | `input[type="email"]`, `input[type="password"]` |
| Login submit | Real `<form>` + `button[type="submit"]` text "Sign In" — Enter works, but tests click explicitly |
| Login call | `POST {REACT_APP_ACCOUNT_CONTACT}/api/contactauth/login` |
| Token storage | `sessionStorage`: `token`, `user` (JSON, includes `tenantId`), `accountId`, `role`, `accounts`, `email`. **Not covered by Playwright's `storageState`** (cookies + localStorage only) — see `fixtures/auth.fixture.ts`'s `clientPageFast`. |
| Auth condition | `isAuthenticated = !!token && !!accountId` — both required, not just a valid token |
| Post-login redirect | `/home` |
| Known bug | Logout navigates to `/client/login`, which matches no route in `App.js` |

## Backend services

All 15 services: Express 5 + Mongoose, `dotenv`/`cors`/`cookie-parser`
(cookie-parser is mounted everywhere but never actually read — auth is
exclusively `Authorization: Bearer <token>`). Every service has its own copy
of an identical `middleware/authMiddleware.js`: verifies the bearer token
with `process.env.JWT_ACCESS_SECRET`, decodes `{ id, role, tenantId }`, and
for `admin`/`team_member` roles loads the local `User` model, for `client`
loads the local `Contact` model. **No service exposes `/health` or `GET /`.**

| Service | Default port | Base path(s) | Tenant-scoped? |
|---|---|---|---|
| signup-login-backend | 8080 | `/api/auth`, `/api/teammember`, `/api/notifications`, `/api/groups`, `/api/googleauth`, `/api/emailsync` | Yes |
| account-contact-backend | 8080 ⚠️ | `/api/clientaccounts`, `/api/contacts`, `/api/contactauth`, `/api/customfields` | Yes |
| account-note-backend | 8014 | `/account/notes` | Yes |
| account-task-backend | 8013 | `/accounts-tasks` | Yes |
| jobs-backend | 8008 | `/workflow/jobs` | Yes (`getTenantFilter(req)` helper) |
| invoice-backend | 8003 | `/account/invoicelist`, `/account/offline-payments` | Yes |
| proposal-backend | 8023 | `/api/proposals`, `/account/proposals` | Yes |
| esignature-backend | 8016 | flat, no prefix (`/api/*`, `/signautrelist/*`) | **Partial** — only `generate-token` stamps `tenantId`; lookups by id are not filtered |
| folder-mangement | 8020 | `/accounts/docs`, `/tempfolder/foldertemp`, `/tempfolder/docManagement` (⚠️ no auth), `/approvals`, `/audittrail` | Yes (except the unauthenticated sub-route) |
| internal-communication | 8017 | `/api/internalchat` | Yes |
| organizer-backend | 8007 | `/api/organizertemp`, `/api/orgaccwise` | Yes |
| templates-backend | 8002 | `/temp/*` (11 sub-routers) | Yes |
| chat-backend | 8010 | `/chats`, `/chatsend` | Yes |
| sidebar-backend | 8024 | `/api/sidebar` (one route protected), `/api/newsidebar` (⚠️ no auth) | **No** — no `tenantId` field on its models at all |
| client-sidebar-backend | 8012 | `/clientsidebar` | **No** — no auth middleware anywhere in the service |

⚠️ `account-contact-backend` and `signup-login-backend` share the same
default port fallback (8080) — real deployments must set distinct `PORT`
values or they collide.

### Confirmed request/response contracts

**`POST {SIGNUP_LOGIN_API}/api/auth/login`** — `signup-login-backend/controllers/authController.js:632-816`
```jsonc
// success (200)
{
  "message": "Login successful",
  "accessToken": "<jwt>",
  "user": { "id": "...", "email": "...", "role": "admin|team_member", "username": "...", "tenantId": "...", "group": {}, "permissions": [] },
  "roleData": {}
}
```
Also sets an httpOnly `refreshToken` cookie (`Secure`, `SameSite=None`, so
HTTPS-only). JWT payload: `{ id, email, role, tenantId, permissions }`.

**`POST {ACCOUNT_CONTACT_API}/api/contactauth/login`** — `account-contact-backend/controllers/authController.js:113-230`
```jsonc
// success (200)
{
  "message": "Login successful",
  "token": "<jwt>",
  "user": { "id": "...", "email": "...", "role": "client", "tenantId": "..." },
  "accounts": [{ "_id": "...", "accountName": "...", "clientType": "...", "companyName": "..." }]
}
```
No cookie is set. The account identifier is the plain Mongoose `_id` (no
`accountId`/`id` alias). JWT payload: `{ id, email, role: "client", tenantId }`.

**`POST {JOBS_API}/workflow/jobs/jobs`** (create job) — `jobs-backend/Controller/jobController.js:169`
Minimum viable body: `{ accounts: [<accountId>], pipeline: <pipelineId> }`.
`tenantId` and a default `stageid` (from the pipeline's first stage) are
injected server-side. The exact success response shape was **not** confirmed
against the controller source — `tests/integration/flow1-admin-job.spec.ts`
handles a couple of likely shapes defensively; tighten it once observed.

## Known blockers for E2E flows

- **Invoice creation** (`POST /account/invoicelist/invoice`) and
  **account-proposal creation** (`POST /account/proposals`) both hard-fail
  with `400 "Please connect Gmail first"` unless the authenticated admin
  user has `gmailConnected && gmailRefreshToken && gmailEmail` set (both
  build a live Gmail OAuth2 transporter and call `.verify()`). This blocks
  Critical Flows 3 and 4 until the QA admin account has Gmail pre-connected,
  or the invoice/proposal services get a way to seed those fields directly.
- Neither frontend's document-upload UI or invoice/proposal creation UI has
  been rendered and inspected yet (recon was static code reading only), so
  their selectors are unconfirmed — see the `test.fixme()` blocker comments
  in `tests/integration/flow2-*` through `flow4-*`.

## Real security gaps found (not hypothetical)

These are exactly what `tests/api/tenancy/known-gaps.spec.ts` targets, and
those tests are expected to fail until fixed:

1. `client-sidebar-backend` has no authentication on any route.
   **Confirmed live on staging 2026-09-10** — `GET /clientsidebar/` returns
   `200` + 740 bytes of JSON with no `Authorization` header. Bug report:
   `bug-reports/client-sidebar-backend-no-authentication-on-any-route.md`.
2. `sidebar-backend`'s CRUD routes are unauthenticated except one `GET`.
   **Confirmed live on staging 2026-09-10** — `GET /api/newsidebar/`
   returns `200` + 798 bytes of JSON with no `Authorization` header. Bug
   report: `bug-reports/sidebar-backend-newsidebar-routes-unauthenticated.md`.

   Control for both: `GET /workflow/jobs/jobs/count` and `GET /account/notes/`
   both correctly returned `401` on the same host in the same session, so
   the auth boundary works everywhere except these two services.
3. `esignature-backend` mostly doesn't filter lookups by `tenantId` (only
   creation does).
4. `folder-mangement`'s `/tempfolder/docManagement/*` sub-route skips the
   `protect` middleware entirely.
