import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';
import { firstAccountId } from '../../../helpers/jobsData';

/**
 * Account Info page — P1 happy ("Account details shown"). Open an account from
 * the list, go to the Info tab, and verify the account's details render.
 */
test.describe('Account Info @accounts @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Account details shown @happy', async ({ adminPage, adminSession, request }) => {
    const acct = await firstAccountId(request, adminSession);
    await navSidebar(adminPage, 'Clients', 'Accounts', /activeaccounts/);
    await adminPage.waitForTimeout(1000);

    // Open the account's dashboard.
    await adminPage.getByText(acct.name, { exact: false }).first().click();
    await adminPage.waitForURL(/accountsdash/, { timeout: 15_000 });

    // Info tab.
    await adminPage.locator('a[href*="accountsdash/info"]').first().click().catch(async () => {
      await adminPage.getByRole('link', { name: 'Info', exact: true }).first().click();
    });
    await adminPage.waitForTimeout(1200);

    // Account name + client type render.
    await expect(adminPage.getByText(acct.name).first()).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText(/individual|company/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
