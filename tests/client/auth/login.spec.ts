import { test, expect } from '@playwright/test';
import { config } from '../../../helpers/config';
import { ClientLoginPage } from '../../../pages/client/LoginPage';

test.describe('Client — login', () => {
  test('valid QA client credentials redirect to /home', async ({ page }) => {
    const loginPage = new ClientLoginPage(page);
    await loginPage.goto();
    await loginPage.loginAs(config.qa.clientEmail, config.qa.clientPassword);
    await loginPage.expectLoggedIn();
  });

  test('invalid credentials are rejected and the user stays on /login', async ({ page }) => {
    const loginPage = new ClientLoginPage(page);
    await loginPage.goto();
    await loginPage.loginAs(config.qa.clientEmail, 'definitely-not-the-real-password');

    await page.waitForTimeout(2_000);
    await expect(page).toHaveURL(/\/login/);
  });
});
