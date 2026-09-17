# client-sidebar-backend has no authentication on any route

- **Priority**: P1
- **Classification**: APPLICATION_BUG
- **Status**: Confirmed
- **Environment**: staging
- **Repository**: c:\services\client-sidebar-backend
- **File**: server.js, routes/sidebarDataRoutes.js
- **Function/Component**: Every route. The service has no middleware/ directory and performs no JWT verification anywhere.
- **Endpoint/UI location**: GET /clientsidebar/ (and every other route in the service)
- **Test case**: Known gaps — sidebar services have no auth boundary > client-sidebar-backend: reads require no token

## Steps to reproduce
1. Send GET https://staging-admin.snptaxes.com/clientsidebar/ with NO Authorization header
2. Observe 200 with a JSON payload instead of 401

## Expected behavior
401 Unauthorized, matching every other service in the platform.

## Actual behavior
HTTP 200 with a 740-byte JSON body returned to a caller with no credentials.

## Root cause
No authentication middleware exists anywhere in this service — confirmed by source inspection (no middleware/ directory present).

## Evidence
- Unauthenticated GET /clientsidebar/ -> HTTP 200, 740 bytes
- Control: GET /workflow/jobs/jobs and GET /account/notes/ both return 401 unauthenticated on the same host, so the proxy is not stripping auth and staging does not have auth globally disabled.
- Response body deliberately not captured into QA logs in case it contains tenant data.

---
Generated 2026-09-16T20:34:30.694Z by pms-qa-automation. This report
documents a finding — the QA suite does not and will not fix it. See
CHARTER.md.
