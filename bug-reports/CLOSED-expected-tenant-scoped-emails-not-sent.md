# CLOSED — Expected behavior: tenant-scoped emails do not send for QA tenants

- **Priority**: n/a — closed, not a defect
- **Classification**: EXPECTED_BEHAVIOR (reclassified 2026-09-10 on confirmation from the product owner)
- **Status**: Closed
- **Environment**: staging (`https://staging-admin.snptaxes.com`)
- **Repository**: `c:\services\account-contact-backend`
- **Endpoint**: `POST /api/contacts/` with `login: true`

## Original observation
Two contacts were created with `login: true` under two freshly registered QA tenants. Both returned `HTTP 201`, but no activation email was delivered, and both contacts remained `isActivated: false`.

## Why this is not a bug
Email notifications are **intentionally disabled platform-wide except for selected accounts**. Tenant-scoped mail is sent using the tenant admin's own connected Google account — `utils/emailService.js:104-118` throws `"Admin Gmail not connected"` unless the admin has `gmailConnected`, `gmailRefreshToken`, and `gmailEmail`. Our QA admins were created minutes earlier and deliberately have no mailbox connected, so no mail is sent. That is the configured, desired behavior and must be preserved.

Note that signup **OTP** emails do still send, because those use system-level SMTP (`EMAIL`/`EMAIL_PASSWORD`) rather than per-tenant Gmail. That asymmetry is what initially made this look like a failure.

## Consequences QA must design around (not defects — constraints)

1. **QA client contacts cannot be activated by email.** They were activated instead via the supported API path: read the contact as the authenticated admin (`GET /api/contacts/contact/:id`), then `POST /api/contacts/activate/set-password/:token`. Any future QA contact must be provisioned the same way. This is now the documented procedure, not a workaround to be "fixed".

2. **Critical Flows 3 and 4 cannot run against a QA tenant as things stand.** `invoice-backend` `createInvoice` (`controller/invoiceController.js:372`) and `proposal-backend` account-proposal creation (`controllers/accountProposalController.js:845`) both **hard-fail with `400 "Please connect Gmail first"`** — they build a live Gmail OAuth2 transporter and call `.verify()` before allowing the record to be created. Unlike contact activation, these fail loudly and block the write entirely.

   So invoice and proposal creation are unavailable to any tenant without a connected mailbox. Automating those flows requires either connecting Gmail on a QA admin, or the services being changed to decouple record creation from mail delivery. Until one of those happens, Flows 3 and 4 stay `test.fixme()`.

3. **The residual observation, downgraded and left open only as a note:** `createContact` catches the send failure and still returns `201` with a success message, logging only to the server console. Under a deliberate "email mostly off" policy this is arguably fine. It is recorded here only because an operator inviting a client through the UI is told the invitation succeeded when no invitation was sent — a possible source of confusion for whoever runs support. Raise it as a UX item if that ever bites; it is **not** being tracked as a bug.

## Explicitly unaffected by this reclassification
The two P0 findings from the same session stand and are **not** explained by the email policy:
- `P0-cross-tenant-read-access-via-findById-object-arg.md`
- `P0-sensitive-fields-exposed-in-contact-api.md`

---
Reported and closed by pms-qa-automation. No application code, configuration,
or data was modified. See CHARTER.md.
