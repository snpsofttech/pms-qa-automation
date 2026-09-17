import { test, expect } from '../../../fixtures/auth.fixture';
import { config } from '../../../helpers/config';
import { qaName } from '../../../fixtures/testData.fixture';
import { blockTest } from '../../../helpers/triage';

/**
 * Regression + specification tests for the "email decouple" change in
 * invoice-backend and proposal-backend: creating an invoice or a proposal
 * must succeed even when the tenant admin has no Gmail connected (email is
 * best-effort and must never turn a successful creation into an error).
 *
 * Two cases, per the requirement:
 *   - Gmail UNAVAILABLE  -> creation still returns 201 with the record.
 *     Directly testable: the QA admin has no Gmail connected.
 *   - Gmail AVAILABLE    -> creation returns 201 AND email is attempted.
 *     Requires a Gmail-connected admin, which cannot be provisioned on
 *     staging (its OAuth redirect points at production); left as a BLOCKED
 *     placeholder with instructions.
 *
 * GATING: these create real billing records, and against the CURRENT
 * (unpatched) staging they would 400 ("Please connect Gmail first"). So the
 * spec is gated behind RUN_EMAIL_DECOUPLE_TESTS — run it only against a
 * target that has the decouple change deployed:
 *   RUN_EMAIL_DECOUPLE_TESTS=1 TEST_ENV=staging npx playwright test tests/api/billing
 * Each created record is deleted in a finally block.
 */
test.describe('Billing — invoice/proposal creation is decoupled from Gmail', () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.RUN_EMAIL_DECOUPLE_TESTS,
      'BLOCKED: gated. Deploy the invoice/proposal email-decouple change, then run with RUN_EMAIL_DECOUPLE_TESTS=1.',
    );
  });

  test('Gmail UNAVAILABLE: creating an invoice still succeeds (no "connect Gmail" 400)', async ({
    apis,
    adminSession,
  }) => {
    const accountId = config.qa.clientAccountId; // an existing account in Tenant A
    blockTest(test, !accountId, 'QA_CLIENT_ACCOUNT_ID not set');

    let invoiceId: string | undefined;
    try {
      const res = await apis.invoice.as(adminSession).post('/account/invoicelist/invoice', {
        account: accountId,
        invoiceLabel: qaName('Invoice'),
        invoicedate: new Date().toISOString(),
        lineItems: [],
        summary: {},
        active: true,
      });
      const body = await res.json().catch(() => ({}));

      expect(
        res.status(),
        `invoice creation must not be blocked by Gmail; got ${res.status()} ${JSON.stringify(body)}`,
      ).toBe(201);
      const created = body.newInvoice ?? body.data ?? body;
      expect(created?._id, 'a created invoice must be returned').toBeTruthy();
      invoiceId = created._id;
    } finally {
      if (invoiceId) {
        await apis.invoice.as(adminSession).delete(`/account/invoicelist/invoice/${invoiceId}`).catch(() => {});
      }
    }
  });

  test('Gmail UNAVAILABLE: creating a proposal still succeeds (no "connect Gmail" 400)', async ({
    apis,
    adminSession,
  }) => {
    const accountId = config.qa.clientAccountId;
    blockTest(test, !accountId, 'QA_CLIENT_ACCOUNT_ID not set');

    let proposalId: string | undefined;
    try {
      const res = await apis.proposal.as(adminSession).post('/account/proposals/', {
        general: { account: accountId, proposalName: qaName('Proposal') },
        status: 'Pending',
      });
      const body = await res.json().catch(() => ({}));

      expect(
        res.status(),
        `proposal creation must not be blocked by Gmail; got ${res.status()} ${JSON.stringify(body)}`,
      ).toBe(201);
      const created = body.proposal ?? body.data ?? body;
      expect(created?._id, 'a created proposal must be returned').toBeTruthy();
      proposalId = created._id;
    } finally {
      if (proposalId) {
        await apis.proposal.as(adminSession).delete(`/account/proposals/${proposalId}`).catch(() => {});
      }
    }
  });

  // Gmail AVAILABLE case — cannot be provisioned on staging (its OAuth
  // redirect points at production, so a QA admin's Gmail can't be connected
  // there). When a Gmail-connected admin IS available (e.g. a fixed-config
  // environment), this should assert creation returns 201 AND the response /
  // logs show an email was attempted. Implement against such an environment.
  test.fixme('Gmail AVAILABLE: creation succeeds and email is attempted', async () => {
    // Requires QA_ADMIN with gmailConnected/gmailRefreshToken/gmailEmail set.
  });
});
