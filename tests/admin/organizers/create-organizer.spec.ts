import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';
import { firstAccountId } from '../../../helpers/jobsData';

/**
 * Create Organizer — P1 happy. Account → Organizers → New Organizer → select an
 * organizer template → name → Create. Requires >= 1 organizer template to exist
 * (organizer-template.spec creates one; templates are tenant-wide).
 */
const RUN = Date.now().toString(36);

test.describe('Create Organizer @organizers @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create organizer from template @happy', async ({ adminPage, adminSession, request }) => {
    const acct = await firstAccountId(request, adminSession);
    await navSidebar(adminPage, 'Clients', 'Accounts', /activeaccounts/);
    await adminPage.waitForTimeout(1000);
    await adminPage.getByText(acct.name, { exact: false }).first().click();
    await adminPage.waitForURL(/accountsdash/, { timeout: 15_000 });
    await adminPage.locator('a[href*="accountsdash/organizers"]').first().click();
    await adminPage.waitForTimeout(1200);

    await adminPage.getByRole('button', { name: 'New Organizer', exact: true }).click();
    await adminPage.getByPlaceholder('Organizer Name').waitFor({ state: 'visible', timeout: 15_000 });

    // Select an organizer template. Comboboxes: [0] global search, [1] Accounts
    // (pre-filled), [2] Organizer Template (shows "None" by default).
    await adminPage.locator('[role=combobox]').nth(2).click();
    await adminPage.waitForTimeout(600);
    await adminPage.getByRole('option').filter({ hasText: /QA_AUTO_OrgTmpl|organizer|tax/i }).first()
      .click({ timeout: 8_000 })
      .catch(async () => {
        // Fall back to the first non-"None" option.
        await adminPage.getByRole('option').nth(1).click({ timeout: 6_000 }).catch(() => {});
      });
    await adminPage.keyboard.press('Escape').catch(() => {});

    await adminPage.getByPlaceholder('Organizer Name').fill(`QA_AUTO_Organizer_${RUN}`);
    await adminPage.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(adminPage.getByText(/organizer created|created successfully/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
