import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';
import { firstAccountId } from '../../../helpers/jobsData';

/** Trash — P1 happy ("Trash page loads"): open the account's Documents → Trash and verify it renders. */
test.describe('Documents — Trash @documents @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Trash page loads @happy', async ({ adminPage, adminSession, request }) => {
    const acct = await firstAccountId(request, adminSession);
    await navSidebar(adminPage, 'Clients', 'Accounts', /activeaccounts/);
    await adminPage.waitForTimeout(1000);
    await adminPage.getByText(acct.name, { exact: false }).first().click();
    await adminPage.waitForURL(/accountsdash/, { timeout: 15_000 });
    await adminPage.locator('a[href*="accountsdash/docs"]').first().click();
    await adminPage.waitForTimeout(1000);

    // Trash sub-tab.
    await adminPage.locator('a[href*="/trash"]').first().click().catch(async () => {
      await adminPage.getByRole('link', { name: 'Trash', exact: true }).first().click();
    });
    await adminPage.waitForTimeout(1200);

    await expect(
      adminPage.getByText(/folder explorer|browse and manage trashed|trashed folders and files/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
