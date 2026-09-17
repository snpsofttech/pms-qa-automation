# P0: Any admin can read any other tenant's accounts and contacts by ID

> **FIX STATUS (2026-09-11): fixed in local working copy, NOT yet deployed.**
> All 10 `findById({_id, tenantId})` reads changed to `findOne({_id, tenantId})`
> in `c:\services\account-contact-backend` (uncommitted). Staging still runs
> the unpatched code, so the regression tests
> (`tests/api/tenancy/account-contact.tenancy.spec.ts`) still FAIL against
> staging until this is deployed. Deploy, then re-run to confirm they go green.


- **Priority**: P0 — cross-tenant data exposure
- **Classification**: APPLICATION_BUG
- **Status**: Confirmed (reproduced live on staging with two purpose-built QA tenants)
- **Environment**: staging (`https://staging-admin.snptaxes.com`)
- **Repository**: `c:\services\account-contact-backend`
- **File**: `controllers/contactController.js` (`getContactById`, line 393-397), `controllers/accountController.js` (`getAccountById` line 213, `addContactsToAccount` line 473, `toggleContactLogin` line 245)
- **Function/Component**: Every handler using the pattern `Model.findById({ _id: id, tenantId: req.user.tenantId })`
- **Endpoint/UI location**: `GET /api/contacts/contact/:id`, `GET /api/clientaccounts/:id` (and the same pattern in the account-mutation handlers listed above)
- **Test case**: `tests/api/tenancy/account-contact.tenancy.spec.ts` › Tenant isolation — accounts › Tenant A admin cannot fetch a Tenant B account by id directly

## Steps to reproduce
1. Create two independent tenants (each admin signup creates its own tenant).
2. In Tenant B, create an account and a contact; note their `_id`s.
3. Authenticate as the **Tenant A** admin and call `GET /api/clientaccounts/<TenantB_accountId>`.
4. Call `GET /api/contacts/contact/<TenantB_contactId>` with the same Tenant A token.

## Expected behavior
`403`/`404`. Both records belong to a different tenant. The list endpoints on the same service enforce this correctly, so the intent is clearly that by-ID reads should too.

## Actual behavior
`HTTP 200` with the other tenant's full record in both cases. Verified in both directions (A→B and B→A).

## Root cause
Confirmed. The handlers call:

```js
Contact.findById({ _id: id, tenantId: req.user.tenantId })
```

`findById(x)` is shorthand for `findOne({ _id: x })`. Passing an **object** means Mongoose casts `{_id: id, tenantId: ...}` to an ObjectId by extracting its `_id` property and **silently discarding `tenantId`**. The query executed is effectively `findOne({_id: id})` with no tenant predicate at all. It looks tenant-scoped on the page, which is likely why it survived review.

The correct form is `findOne({ _id: id, tenantId: req.user.tenantId })`.

Note the contrast that proves intent: list endpoints (`getContacts`, `getAccounts`) use `find({ tenantId: req.user.tenantId })` — a normal `find` with a real predicate — and those **passed** the isolation test cleanly in the same run.

## Evidence
Live staging, 2026-09-10, two dedicated QA tenants (`6aa2a7a6…a319` / `6aa2a7a7…a331`):

| Request | Result |
|---|---|
| A-admin → `GET /api/clientaccounts/<B's account>` | **HTTP 200, Tenant B data returned** |
| B-admin → `GET /api/clientaccounts/<A's account>` | **HTTP 200, Tenant A data returned** |
| A-admin → `GET /api/contacts/contact/<B's contact>` | **HTTP 200, Tenant B data returned** |
| B-admin → `GET /api/contacts/contact/<A's contact>` | **HTTP 200, Tenant A data returned** |
| A-admin → `GET /api/clientaccounts/` (list) | clean — no Tenant B records |
| B-admin → `GET /api/clientaccounts/` (list) | clean — no Tenant A records |

## Escalation path
This combines with `P0-sensitive-fields-exposed-in-contact-api.md` into full **cross-tenant client account takeover** — see that report. Fixing either one breaks the chain; both should be fixed.

Also audit every other service for the same `findById({_id, tenantId})` idiom — it was found in at least two controllers here and the pattern appears copy-pasted across this codebase. Any occurrence is an unscoped query wearing a tenant-scoped disguise.

---
Reported by pms-qa-automation. No application code was modified. See CHARTER.md.
