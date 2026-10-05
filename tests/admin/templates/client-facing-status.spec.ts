import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';

/**
 * Client-Facing Status template — P1 happy. Firm Templates → Client Facing tab
 * → Create New Status → color + name + description → Create.
 */
const RUN = Date.now().toString(36);

test.describe('Client-Facing Status @templates @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create status @happy', async ({ adminPage }) => {
    await navSidebar(adminPage, 'Templates', 'Firm Templates', /firmtemp\/templates/);
    await adminPage.locator('a[href$="/templates/clientfacing"]').first().click();
    await adminPage.waitForURL(/templates\/clientfacing/, { timeout: 10_000 });
    await adminPage.getByRole('button', { name: 'Create New Status', exact: true }).click();

    await adminPage.getByPlaceholder('Enter a name').waitFor({ state: 'visible', timeout: 15_000 });
    await adminPage.getByPlaceholder('Enter a name').fill(`QA_AUTO_Status_${RUN}`);
    await adminPage.getByPlaceholder('Status description for client').fill('QA automation status');

    // Color: click the "Select a color" trigger (by text), then pick a swatch.
    await adminPage.getByText('Select a color', { exact: true }).click();
    await adminPage.waitForTimeout(700);
    await adminPage
      .locator('[role=option], [data-radix-popper-content-wrapper] button, button[style*="background"], button[class*="rounded-full"]')
      .first()
      .click()
      .catch(() => {});
    await adminPage.waitForTimeout(300);

    await adminPage.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(adminPage.getByText(/status created|created successfully|success/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
