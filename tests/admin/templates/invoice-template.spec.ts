import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';

/** Invoice Template — P1 happy. Firm Templates → Invoices → create → name + payment method + line item → Save & Exit. */
const RUN = Date.now().toString(36);

test.describe('Invoice Template @templates @invoices @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create invoice template @happy', async ({ adminPage }) => {
    await navSidebar(adminPage, 'Templates', 'Firm Templates', /firmtemp\/templates/);
    await adminPage.locator('a[href$="/templates/invoices"]').first().click();
    await adminPage.waitForURL(/templates\/invoices/, { timeout: 10_000 });
    await adminPage.getByRole('button', { name: 'Create Invoice Template', exact: true }).click();

    await adminPage.getByPlaceholder('Template Name').waitFor({ state: 'visible', timeout: 15_000 });
    await adminPage.getByPlaceholder('Template Name').fill(`QA_AUTO_InvoiceTmpl_${RUN}`);

    // Payment method.
    await adminPage.getByText('Select Payment Mode', { exact: true }).click();
    await adminPage.waitForTimeout(500);
    await adminPage.getByRole('option').first().click({ timeout: 8_000 }).catch(() => {});

    // Line item.
    await adminPage.getByRole('button', { name: 'Line item', exact: true }).click();
    await adminPage.getByPlaceholder('Product or Service').first().fill('QA Service');
    await adminPage.getByPlaceholder('0.00').first().fill('500');

    // Dismiss any open dropdown backdrop, then save.
    const overlay = adminPage.locator('div.fixed.inset-0.z-40');
    if (await overlay.first().isVisible().catch(() => false)) await overlay.first().click({ position: { x: 5, y: 5 } }).catch(() => {});
    await adminPage.keyboard.press('Escape').catch(() => {});

    await adminPage.getByRole('button', { name: 'Save & Exit', exact: true }).click();
    await expect(adminPage.getByText(/invoice template created|created successfully|success/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
