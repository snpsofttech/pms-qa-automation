# folder-mangement docManagement router accepts unauthenticated requests

- **Priority**: P1
- **Classification**: APPLICATION_BUG
- **Status**: Confirmed
- **Environment**: staging
- **Repository**: c:\services\folder-mangement
- **File**: routes/docManagementRoutes.js (mounted in server.js)
- **Function/Component**: The /tempfolder/docManagement router. The service's other four routers (/tempfolder/foldertemp, /accounts/docs, /approvals, /audittrail) all apply the `protect` middleware; this one does not.
- **Endpoint/UI location**: GET /tempfolder/docManagement/list — and every other route on that router, including POST /folder, POST /file/upload, POST /delete, POST /move, POST /rename
- **Test case**: Known gaps — folder-mangement has one unprotected router > folder-mangement: /tempfolder/docManagement is not authenticated

## Steps to reproduce
1. Send GET https://staging-admin.snptaxes.com/tempfolder/docManagement/list with NO Authorization header
2. Observe 200 instead of 401

## Expected behavior
401 Unauthorized, consistent with the other four routers in this same service.

## Actual behavior
HTTP 200 with a 2455-byte body returned to an unauthenticated caller.

## Root cause
server.js mounts docManagementRoutes without the `protect` middleware that the service applies to its other routers — confirmed by source inspection. Appears to be an omission rather than intent, since the middleware is already imported and used elsewhere in the same file.

## Evidence
- Unauthenticated GET /tempfolder/docManagement/list -> HTTP 200, 2455 bytes
- Control: GET /accounts/docs/list on the SAME service returns 401 unauthenticated, so the service is reachable and its auth works — this one router is the exception.
- Write routes on this router (file/folder upload, delete, move, rename) share the same omission. Not exercised, to avoid mutating the environment.

---
Generated 2026-09-16T20:34:29.751Z by pms-qa-automation. This report
documents a finding — the QA suite does not and will not fix it. See
CHARTER.md.
