import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';

/** Chat Template — P1 happy. Firm Templates → Chats → create → name + sender + subject → Save & Exit. */
const RUN = Date.now().toString(36);

test.describe('Chat Template @templates @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create chat template @happy', async ({ adminPage }) => {
    await navSidebar(adminPage, 'Templates', 'Firm Templates', /firmtemp\/templates/);
    await adminPage.locator('a[href$="/templates/chats"]').first().click();
    await adminPage.waitForURL(/templates\/chats/, { timeout: 10_000 });
    await adminPage.getByRole('button', { name: 'Create New Chat', exact: true }).click();

    await adminPage.getByPlaceholder('Template Name').waitFor({ state: 'visible', timeout: 15_000 });
    await adminPage.getByPlaceholder('Template Name').fill(`QA_AUTO_ChatTemp_${RUN}`);

    // From (required) — "Select Sender"/"Select sender" trigger or a native select.
    const senderText = adminPage.getByText(/select sender/i).first();
    if (await senderText.isVisible().catch(() => false)) {
      await senderText.click();
      await adminPage.waitForTimeout(500);
      await adminPage.getByRole('option').first().click({ timeout: 8_000 }).catch(() => {});
    } else {
      await adminPage.locator('select').first().selectOption({ index: 1 }).catch(() => {});
    }

    await adminPage.getByPlaceholder('Enter chat subject...').fill('QA Automation Subject');

    await adminPage.getByRole('button', { name: 'Save & Exit', exact: true }).click();
    await expect(adminPage.getByText(/template created|created successfully|success/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
