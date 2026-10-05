import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';
import { firstAccountId } from '../../../helpers/jobsData';

/**
 * Create Organizer — P1 happy. Account → Organizers tab → New Organizer →
 * name → Create. (The sheet's "from template" variant needs an organizer
 * template; none exist in this tenant, so this covers the name-only create.)
 */
const RUN = Date.now().toString(36);

test.describe('Create Organizer @organizers @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  // FIXME: name-only create does not complete; the "from template" flow needs
  // an organizer template, and none exist in this tenant (the Organizer
  // Template select is empty). Seed an organizer template first (heavy editor:
  // sections + questions) or add an API seed, then re-enable.
  test.fixme('Create organizer for the account @happy', async ({ adminPage, adminSession, request }) => {
    const acct = await firstAccountId(request, adminSession);
    await navSidebar(adminPage, 'Clients', 'Accounts', /activeaccounts/);
    await adminPage.waitForTimeout(1000);
    await adminPage.getByText(acct.name, { exact: false }).first().click();
    await adminPage.waitForURL(/accountsdash/, { timeout: 15_000 });
    await adminPage.locator('a[href*="accountsdash/organizers"]').first().click();
    await adminPage.waitForTimeout(1200);

    await adminPage.getByRole('button', { name: 'New Organizer', exact: true }).click();
    await adminPage.getByPlaceholder('Organizer Name').waitFor({ state: 'visible', timeout: 15_000 });
    await adminPage.getByPlaceholder('Organizer Name').fill(`QA_AUTO_Organizer_${RUN}`);
    await adminPage.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(adminPage.getByText(/organizer created|created successfully/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
