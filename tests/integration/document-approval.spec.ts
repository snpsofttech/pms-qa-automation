import { test, expect } from '@playwright/test';
import { config } from '../../helpers/config';
import { loginAsAdmin } from '../../helpers/apiClient';
import { ClientLoginPage } from '../../pages/client/LoginPage';
import {
  setupPendingApproval,
  cleanupPendingApproval,
  getApprovalStatus,
  PendingApproval,
} from '../../helpers/documentApproval';

/**
 * Document Upload + Approval QA flow (staging only).
 *
 *   Setup (API): create the firm folder + a QA-prefixed document, request
 *   approval, and stamp the file meta so it appears as a pending approval.
 *   Action (Client Portal UI): the client approves the document on /home.
 *   Verify: the Approval status flips to "approved" (API), and the pending
 *   item disappears from the portal (UI).
 *
 * Test data is QA-prefixed, repeatable (unique run id), and cleaned up in a
 * finally block. No application code is modified.
 */
test.describe('Document upload + approval', () => {
  test.setTimeout(120_000);

  test('client approves a document sent for approval, and the status flips to approved', async ({
    page,
    request,
  }) => {
    const runId = Date.now().toString(36);
    const admin = await loginAsAdmin(request, config.qa.adminEmail, config.qa.adminPassword);
    const accountId = config.qa.clientAccountId;
    test.skip(!accountId, 'QA_CLIENT_ACCOUNT_ID not set');
    test.skip(!config.qa.clientEmail || !config.qa.clientPassword, 'QA client credentials not set');

    let pa: PendingApproval | undefined;
    try {
      await test.step('Setup: create firm folder + document + approval request (API)', async () => {
        pa = await setupPendingApproval(request, admin.token, accountId, config.qa.clientEmail, runId);
        // Precondition sanity: it starts pending.
        expect(await getApprovalStatus(request, admin.token, pa.approvalId)).toBe('pending');
      });

      await test.step('Client logs into the portal', async () => {
        const login = new ClientLoginPage(page);
        await login.goto();
        await login.loginAs(config.qa.clientEmail, config.qa.clientPassword);
        await login.expectLoggedIn(); // /home
      });

      await test.step('Client approves the document (UI)', async () => {
        // Approval success is signalled via native window.alert — auto-accept.
        page.on('dialog', (d) => d.accept().catch(() => {}));

        await page.goto(`${config.client.baseURL}/home`);
        // Open the pending-approval item for our QA document.
        const item = page
          .locator('div', { hasText: pa!.filename })
          .filter({ has: page.getByText(/Pending Approval/i) })
          .last();
        await expect(item).toBeVisible({ timeout: 20_000 });
        await item.click();

        await page.getByRole('button', { name: 'Approve Document' }).click();
        // The viewer closes after approval; give the alerts + refetch a moment.
        await page.waitForTimeout(3_000);
      });

      await test.step('Verify: approval status is "approved" (API)', async () => {
        await expect
          .poll(() => getApprovalStatus(request, admin.token, pa!.approvalId), { timeout: 15_000 })
          .toBe('approved');
      });

      await test.step('Verify: the pending item is gone from the portal (UI)', async () => {
        await page.goto(`${config.client.baseURL}/home`);
        await expect(
          page.locator('div', { hasText: pa!.filename }).filter({ has: page.getByText(/Pending Approval/i) }),
        ).toHaveCount(0, { timeout: 15_000 });
      });
    } finally {
      if (pa) await cleanupPendingApproval(request, admin.token, pa);
    }
  });
});
