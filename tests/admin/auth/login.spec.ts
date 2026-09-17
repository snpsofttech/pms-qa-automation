import { test, expect } from '@playwright/test';
import { config } from '../../../helpers/config';
import { AdminLoginPage } from '../../../pages/admin/LoginPage';

test.describe('Admin — login', () => {
  test('valid QA admin credentials redirect to /insights', async ({ page }) => {
    const loginPage = new AdminLoginPage(page);
    await loginPage.goto();
    await loginPage.loginAs(config.qa.adminEmail, config.qa.adminPassword);
    await loginPage.expectLoggedIn();
  });

  test('invalid credentials are rejected and the user stays on /login', async ({ page }) => {
    const loginPage = new AdminLoginPage(page);
    await loginPage.goto();
    await loginPage.loginAs(config.qa.adminEmail, 'definitely-not-the-real-password');

    // No stable error-message selector exists in the current markup (no
    // data-testid) — assert on the one thing we can rely on: the app did
    // NOT navigate away from /login.
    await page.waitForTimeout(2_000);
    await expect(page).toHaveURL(/\/login/);
  });
});
