# P3: /admin and /client without a trailing slash serve the nginx default page

- **Priority**: P3 — cosmetic/confusing, no data or security impact; trivially avoided by using the trailing slash
- **Classification**: ENVIRONMENT_ISSUE (nginx configuration, not application code)
- **Status**: Confirmed
- **Environment**: staging (`https://staging-admin.snptaxes.com`)
- **Repository**: n/a — nginx site configuration on the staging host
- **Endpoint/UI location**: `GET /admin`, `GET /client`, and `GET /`
- **Test case**: none directly; surfaced while diagnosing a QA-side navigation defect in `tests/smoke/*.smoke.spec.ts`

## Steps to reproduce
1. Open `https://staging-admin.snptaxes.com/admin` (no trailing slash).
2. Open `https://staging-admin.snptaxes.com/client` (no trailing slash).

## Expected behavior
A 301 redirect to `/admin/` and `/client/` respectively, which is nginx's normal behavior for a directory-style location. A user typing the URL by hand should land in the app.

## Actual behavior
Both return `HTTP 200` serving nginx's stock **"Welcome to nginx!"** page. So does `/`. The apps are only reachable with the trailing slash (`/admin/`, `/client/`) or on a deeper path (`/admin/login` works).

| Path | Result |
|---|---|
| `/` | nginx default page |
| `/admin` | nginx default page |
| `/admin/` | admin SPA |
| `/admin/login` | admin SPA |
| `/client` | nginx default page |
| `/client/` | client SPA |

## Root cause
Not fully determined — requires access to the nginx site config, which I don't have. The symptom is consistent with the SPA locations being defined with a trailing slash while a catch-all `location /` serves `/var/www/html`, so the bare paths fall through to the default root instead of redirecting.

## Impact
Low but real: anyone typing or sharing the bare URL sees a stock nginx page and reasonably concludes the site is broken or misconfigured. It also silently misleads automated tooling — this is exactly what produced a confusing "element not found" failure in the QA suite before the cause was understood.

## Note on QA suite impact
This interacted with a genuine QA-side defect worth recording: Playwright resolves `page.goto('/login')` against the baseURL's **origin**, discarding the `/admin` base path, so the suite was silently requesting the site root and asserting against nginx's welcome page. Fixed QA-side — all navigation now goes through the page objects, which build absolute URLs. The nginx behavior above is what made the failure mode so opaque.

---
Reported by pms-qa-automation. No application or server configuration was
modified. See CHARTER.md.
