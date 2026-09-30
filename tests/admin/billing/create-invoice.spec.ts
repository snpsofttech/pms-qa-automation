import { test, expect } from '../../../fixtures/auth.fixture';
import { openQuickCreate } from '../../../helpers/quickCreate';
import { firstAccountId } from '../../../helpers/jobsData';

/**
 * Create Invoice — P1 happy (via "+ → Invoice"). Select an account, add a line
 * item, Save Invoice → success toast. (Line-item math, templates, negatives are
 * a later pass.)
 */
const RUN = Date.now().toString(36);

test.describe('Create Invoice @invoices @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create Invoice via + menu @happy', async ({ adminPage, adminSession, request }) => {
    const acct = await firstAccountId(request, adminSession);

    await openQuickCreate(adminPage, 'Invoice');
    await adminPage.getByRole('button', { name: 'Save Invoice' }).waitFor({ state: 'visible', timeout: 15_000 });

    // Select the account: open the combobox, type to filter, pick first match.
    await adminPage.getByText('Select an account', { exact: true }).first().click();
    await adminPage.waitForTimeout(400);
    await adminPage.keyboard.type(acct.name);
    await adminPage.waitForTimeout(700);
    await adminPage.getByRole('option').first().click({ timeout: 8_000 });
    await adminPage.waitForTimeout(300);

    // Add a line item and fill it.
    await adminPage.getByRole('button', { name: 'Line item' }).click();
    await adminPage.getByPlaceholder('Product or Service').first().fill(`QA Service ${RUN}`);
    await adminPage.getByPlaceholder('0.00').first().fill('500');

    // A dropdown backdrop (div.fixed.inset-0.z-40) can stay open and intercept
    // the Save click — dismiss it by clicking the backdrop, then Save.
    const overlay = adminPage.locator('div.fixed.inset-0.z-40');
    if (await overlay.first().isVisible().catch(() => false)) {
      await overlay.first().click({ position: { x: 5, y: 5 } }).catch(() => {});
      await adminPage.waitForTimeout(300);
    }
    await adminPage.keyboard.press('Escape').catch(() => {});
    await adminPage.getByRole('button', { name: 'Save Invoice' }).click();
    await expect(adminPage.getByText(/invoice created successfully/i)).toBeVisible({ timeout: 20_000 });
  });
});
