import { test, expect } from '@playwright/test';
import { test as authTest } from '../../fixtures/auth.fixture';
import { AdminLoginPage } from '../../pages/admin/LoginPage';

/**
 * Navigation goes through AdminLoginPage.goto(), never `page.goto('/login')`.
 * The app is served under a base path (`/admin/`), and Playwright resolves a
 * leading-slash path against the baseURL's ORIGIN, discarding the base path —
 * `page.goto('/login')` silently lands on the site root, which serves nginx's
 * default welcome page and produces a confusing "element not found" failure
 * rather than an obvious wrong-URL one. The page objects build absolute URLs.
 */
test.describe('Admin — smoke', () => {
  test('application loads and the login screen renders (JS + CSS up, no blank page)', async ({ page }) => {
    const loginPage = new AdminLoginPage(page);
    await loginPage.goto();

    // Presence + visibility of these three proves the JS bundle mounted
    // React, CSS loaded (visibility depends on layout styles), and the page
    // isn't blank.
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
  });

  test('page is not blank and has no failed critical asset requests', async ({ page }) => {
    const failedRequests: string[] = [];
    page.on('requestfailed', (req) => failedRequests.push(`${req.method()} ${req.url()}`));

    await new AdminLoginPage(page).goto();
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length, 'body rendered no visible text — likely a blank/broken page').toBeGreaterThan(0);
    expect(failedRequests, `some requests failed to load:\n${failedRequests.join('\n')}`).toHaveLength(0);
  });
});

authTest.describe('Admin — smoke (authenticated)', () => {
  authTest('dashboard route renders after login', async ({ adminPage }) => {
    const bodyText = await adminPage.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);
    await expect(adminPage).toHaveURL(/\/insights/);
  });
});
