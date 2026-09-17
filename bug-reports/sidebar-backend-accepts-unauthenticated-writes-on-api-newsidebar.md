# sidebar-backend accepts unauthenticated writes on /api/newsidebar

- **Priority**: P1
- **Classification**: APPLICATION_BUG
- **Status**: Confirmed
- **Environment**: staging
- **Repository**: c:\services\sidebar-backend
- **File**: routes/newSidebarDataRoutes.js
- **Function/Component**: All routes in newSidebarDataRoutes.js. The service has middleware/authMiddleware.js and applies `protect` to GET /api/sidebar/ only; nothing in this router is protected.
- **Endpoint/UI location**: POST /api/newsidebar/ (and GET/PATCH/DELETE on the same router)
- **Test case**: Known gaps — sidebar services have no auth boundary > sidebar-backend: writes to /api/newsidebar are not authenticated

## Steps to reproduce
1. Send POST https://staging-admin.snptaxes.com/api/newsidebar/ with a JSON body and NO Authorization header
2. Observe the response comes from schema validation or succeeds — never 401

## Expected behavior
401 Unauthorized before any handler logic, matching the `protect` pattern used across the other services.

## Actual behavior
HTTP 400 from Mongoose schema validation — the unauthenticated request passed the routing/auth layer and reached the model. No auth check exists to reject it.

## Error message
```
{"error":"newsidebardata validation failed: label: Path `label` is required., path: Path `path` is required., icon: Path `icon` is required."}
```

## Root cause
routes/newSidebarDataRoutes.js never applies the `protect` middleware exported by middleware/authMiddleware.js — confirmed by source inspection. The models also lack a tenantId field, so there is no tenant scoping here either.

## Evidence
- Unauthenticated POST /api/newsidebar/ -> HTTP 400
- Response was a schema-validation error listing required fields, proving the request reached the model layer without credentials.
- No record was created — this probe deliberately sends an invalid payload so the gap can be demonstrated without writing to the environment.

---
Generated 2026-09-16T20:34:30.562Z by pms-qa-automation. This report
documents a finding — the QA suite does not and will not fix it. See
CHARTER.md.
