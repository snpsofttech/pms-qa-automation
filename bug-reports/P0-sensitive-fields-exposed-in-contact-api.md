# P0: Contact API returns password hashes and activation tokens in responses

- **Priority**: P0 — credential exposure; enables account takeover when chained
- **Classification**: APPLICATION_BUG
- **Status**: Confirmed (observed live on staging)
- **Environment**: staging (`https://staging-admin.snptaxes.com`)
- **Repository**: `c:\services\account-contact-backend`
- **File**: `controllers/contactController.js` (`getContactById`, line 393-397); `models/ContactModel.js` (no `select: false` on `password`/`activationToken`, no `toJSON` transform)
- **Function/Component**: `getContactById` — `Contact.findById(...)` with no `.select()` projection, returning the raw document
- **Endpoint/UI location**: `GET /api/contacts/contact/:id`
- **Test case**: to be added — `tests/api/contacts/field-exposure.spec.ts` (not yet written; discovered during QA tenant provisioning)

## Steps to reproduce
1. Authenticate as any admin.
2. `GET /api/contacts/contact/<any contact id>`.
3. Inspect the JSON body.

## Expected behavior
Credential material must never be serialized to an API response. `password` and `activationToken` should be `select: false` on the schema, or explicitly projected out.

## Actual behavior
The response contains:
- `"password"` — the bcrypt hash of the contact's password (confirmed present on every contact read, own-tenant and cross-tenant).
- `"activationToken"` — the raw activation token, whenever the contact has not yet been activated (confirmed directly: a freshly created contact returned `activationToken` with `isActivated: false`; the field disappears after activation because `activateAccount()` clears it).

## Root cause
`getContactById` returns the Mongoose document unprojected. `models/ContactModel.js` declares `password` and `activationToken` as ordinary fields with no `select: false` and no `toJSON` transform to strip them, so both serialize straight into the response.

## The takeover chain (why this is P0, not P2)
Three individually-modest issues compose into full account takeover of **another tenant's** client:

1. `GET /api/contacts/contact/:id` is **not tenant-scoped** — see `P0-cross-tenant-read-access-via-findById-object-arg.md`. Any admin can read any tenant's contact.
2. That response **includes `activationToken`** for any not-yet-activated contact (this report).
3. `POST /api/contacts/activate/set-password/:token` is **public — no authentication** (`routes/contactRoutes.js`: `router.post('/activate/set-password/:token', ...)` with no `protect`), and sets the password for whichever contact holds that token.

So an admin of Tenant A can enumerate Tenant B's un-activated contacts, read their activation tokens, set passwords on them, and log in to Tenant B's client portal as those users. No email access required.

I verified steps 1 and 2 directly and read step 3 in source; I did **not** execute the takeover across tenants, since that would mean seizing an account rather than observing a defect.

### Update — the "un-activated only" limitation does not hold

This report originally scoped the chain to contacts that had never been
activated, on the basis that `activateAccount()` clears `activationToken`.
That mitigation is illusory: `toggleContactLogin`
(`controllers/accountController.js:245-281`) is also unscoped by tenant and
**regenerates a fresh activation token** whenever the existing one is absent
or expired — which is exactly the state of an already-activated contact.

So **every** client contact is reachable, not just pending ones. See
`P0-cross-tenant-WRITE-access-in-account-contact-backend.md` for the full
four-step chain and the other cross-tenant write handlers. Fixing the field
exposure in this report still breaks the chain at step 2, so it remains a
valid independent fix — but it should no longer be reasoned about as
"only affects contacts nobody has activated yet".

## Evidence
- Live staging, 2026-09-10: `GET /api/contacts/contact/<id>` returned a body containing `"password":"<bcrypt hash>"` on all four probes (own-tenant and cross-tenant, both directions).
- Same endpoint on a pre-activation contact returned `"activationToken":"<64-hex>"` alongside `"isActivated":false`. (Token values deliberately not recorded in this report or in QA logs.)
- This is not hypothetical for QA either: reading the token this way is exactly how the two QA client accounts had to be activated, because the activation emails silently failed — see `P1-tenant-scoped-emails-fail-silently.md`.

## Recommended fix direction
Set `select: false` on `password` and `activationToken` in `ContactModel`, and add a `toJSON` transform that deletes them — belt and braces, since `select: false` is easy to defeat with an explicit `+password`. Fix the tenant scoping separately; do not rely on it alone.

---
Reported by pms-qa-automation. No application code was modified. See CHARTER.md.
