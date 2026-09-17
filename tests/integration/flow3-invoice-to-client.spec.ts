import { test } from '../../fixtures/auth.fixture';

/**
 * Critical flow 3: Admin Create Invoice -> Approve Invoice -> Client Portal
 * -> Verify Invoice Visible.
 *
 * NOT YET IMPLEMENTED — hard-blocked, not just under-specified:
 * invoice-backend's createInvoice handler (controller/invoiceController.js:372)
 * loads the authenticated admin user and returns 400 "Please connect Gmail
 * first" unless `gmailConnected && gmailRefreshToken && gmailEmail` are set
 * on that user (it builds a live Gmail OAuth2 transporter and calls
 * `transporter.verify()` before allowing the create to proceed). The same
 * gate exists on account-proposal creation (controllers/
 * accountProposalController.js:845), which is why flow4 is blocked too.
 *
 * To unblock: either (a) provision the QA_ADMIN_EMAIL account with a real
 * connected Gmail account ahead of time (fragile — depends on a live OAuth
 * grant, hard to keep working in CI), or (b) ask the invoice-backend team
 * for a way to seed `gmailConnected/gmailRefreshToken/gmailEmail` directly
 * in the test DB for the QA admin user, bypassing the OAuth flow. Once one
 * of those is in place, also confirm the admin Invoice/Approve UI selectors
 * the same way noted in flow2's blocker comment before writing this spec.
 */
test.describe('Critical flow 3 — Admin invoice creation, approval, client visibility', () => {
  test.fixme('admin creates and approves an invoice, then the client can see it in their portal', async () => {
    // Intentionally empty — see the blocker notes above.
  });
});
