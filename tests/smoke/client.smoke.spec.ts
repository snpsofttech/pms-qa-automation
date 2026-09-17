import { test, expect } from '@playwright/test';
import { test as authTest } from '../../fixtures/auth.fixture';
import { ClientLoginPage } from '../../pages/client/LoginPage';

/** Same base-path caveat as admin.smoke.spec.ts — always navigate via the page object. */
test.describe('Client — smoke', () => {
  test('client portal loads and the login screen renders (no blank page)', async ({ page }) => {
    const loginPage = new ClientLoginPage(page);
    await loginPage.goto();

    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('page is not blank and static assets load', async ({ page }) => {
    const failedRequests: string[] = [];
    page.on('requestfailed', (req) => failedRequests.push(`${req.method()} ${req.url()}`));

    await new ClientLoginPage(page).goto();
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length, 'body rendered no visible text — likely a blank/broken page').toBeGreaterThan(0);
    expect(failedRequests, `some requests failed to load:\n${failedRequests.join('\n')}`).toHaveLength(0);
  });
});

authTest.describe('Client — smoke (authenticated)', () => {
  authTest('home route renders after login', async ({ clientPage }) => {
    const bodyText = await clientPage.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);
    await expect(clientPage).toHaveURL(/\/home/);
  });
});
