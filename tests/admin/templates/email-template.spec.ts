import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';

/** Email Template — P1 happy. Firm Templates → Emails → create → name + sender + subject → Save & Exit. */
const RUN = Date.now().toString(36);

test.describe('Email Template @templates @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create email template @happy', async ({ adminPage }) => {
    await navSidebar(adminPage, 'Templates', 'Firm Templates', /firmtemp\/templates/);
    await adminPage.locator('a[href$="/templates/emails"]').first().click();
    await adminPage.waitForURL(/templates\/emails/, { timeout: 10_000 });
    await adminPage.getByRole('button', { name: 'Create New Email', exact: true }).click();

    await adminPage.getByPlaceholder('Enter template name').waitFor({ state: 'visible', timeout: 15_000 });
    await adminPage.getByPlaceholder('Enter template name').fill(`QA_AUTO_EmailTemp_${RUN}`);

    // From (required): "Select sender" combobox → first option.
    await adminPage.getByText('Select sender', { exact: true }).click();
    await adminPage.waitForTimeout(500);
    await adminPage.getByRole('option').first().click({ timeout: 8_000 }).catch(() => {});

    await adminPage.getByPlaceholder('Enter email subject').fill('QA Automation Subject');

    await adminPage.getByRole('button', { name: 'Save & Exit', exact: true }).click();
    await expect(adminPage.getByText(/email template created|created successfully|success/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
