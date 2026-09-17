# P2: folder-mangement returns 500 on document upload (with accountId) and on updateStatus

- **Priority**: P2 — core document actions error; the record/meta still lands, so impact is degraded UX + misleading errors rather than data loss
- **Classification**: APPLICATION_BUG
- **Status**: Confirmed (reproduced live on staging)
- **Environment**: staging (`https://staging-admin.snptaxes.com`)
- **Repository**: `c:\services\folder-mangement`
- **File**: `controllers/accountFolderManagement.js`

Two distinct 500s found while building the document upload + approval QA flow. Both were routed around in QA (not fixed).

## Bug A — `POST /accounts/docs/file/upload` returns 500 when the `accountId` form field is present
- **Endpoint**: `POST /accounts/docs/file/upload?folderPath=<...>` (multipart, field `files`)
- **Observed**: uploading a file with the multipart body field **`accountId`** set returns `HTTP 500 {"error":"Internal Server Error"}`. Uploading the **same file without `accountId`** returns `201` and the file lands in the account folder correctly.
- **Likely cause**: the post-upload notify/audit path that runs when `accountId` is present throws (e.g. the tenant email/notify logic), and the error isn't handled — so the whole request 500s even though the file was written.
- **Impact**: the admin UI's upload passes `accountId` (to tag the file "New" and optionally notify the client), so real uploads with notify enabled would hit this 500.
- **Evidence** (staging, 2026‑09‑17): same file, same folder — `with accountId → 500`, `without accountId → 201`.

## Bug B — `POST /accounts/docs/updateStatus` returns 500 ("Failed to update status") though the metadata write lands
- **Endpoint**: `POST /accounts/docs/updateStatus` — body `{ targetPath, status: {...}, accountId, accountName }`
- **Handler**: `updateStatus` (accountFolderManagement.js:1365)
- **Observed**: setting a file's meta (e.g. `status: { authStatus: "pendingApproval", approvalId }`) returns `HTTP 500 {"error":"Failed to update status"}`, **but** the meta is actually updated — verified immediately after via `GET /accounts/docs/files/list/clientView`, which shows the file's `authStatus:"pendingApproval"` and the `approvalId`.
- **Likely cause**: the metadata `Object.assign` + save (line ~1385) succeeds, then post-write logic (audit event write / notify) throws and is caught into the generic 500.
- **Impact**: callers see an error for an operation that in fact succeeded — unreliable for any client that trusts the HTTP status. The client portal's own approve/disapprove path calls this same endpoint.
- **Evidence** (staging, 2026‑09‑17): `updateStatus → 500`, immediately followed by a clientView listing showing the meta correctly stamped.

## How QA worked around these (documented, not fixes)
`helpers/documentApproval.ts` uploads **without** `accountId` (the file still lands in the account folder), and treats the `updateStatus` 500 as tolerable — then **verifies** the file meta actually materialized via `clientView` before proceeding. The document-approval flow (`tests/integration/document-approval.spec.ts`) passes reliably on top of these workarounds.

## Recommended direction (for the app team — QA does not fix)
Wrap the post-upload notify/audit and post-updateStatus audit code in try/catch so a
notification/audit failure logs a warning instead of failing the whole request
(mirrors the invoice/proposal email-decouple pattern). Confirm the `accountId`
upload path's notify logic against a tenant without Gmail connected.

---
Reported by pms-qa-automation. No application code was modified. See CHARTER.md.
