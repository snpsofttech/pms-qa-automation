import { test as base, Page } from '@playwright/test';
import { config } from '../helpers/config';
import { apiClients, loginAsAdmin, loginAsClient, AuthSession } from '../helpers/apiClient';
import { AdminLoginPage } from '../pages/admin/LoginPage';
import { ClientLoginPage } from '../pages/client/LoginPage';

type AuthFixtures = {
  /** Browser page logged in via the real UI as the tenant-A QA admin. */
  adminPage: Page;
  /** Browser page logged in via the real UI as the tenant-A QA client. */
  clientPage: Page;
  /**
   * Browser page authenticated as the tenant-A QA client WITHOUT going
   * through the login UI — logs in over the API, then seeds sessionStorage
   * directly (the client app stores its session there, see ARCHITECTURE.md)
   * before navigating to /home. Use this in tests that exercise a feature
   * downstream of login and don't need to verify the login screen itself;
   * it's meaningfully faster and avoids re-testing login in every spec.
   * There is no equivalent "fast" path for the admin app: its token lives
   * only in an in-memory JS variable that isn't reachable before the app
   * hydrates, so admin tests must go through AdminLoginPage.
   */
  clientPageFast: Page;

  adminSession: AuthSession;
  adminBSession: AuthSession;
  clientSession: AuthSession;
  clientBSession: AuthSession;

  apis: ReturnType<typeof apiClients>;
};

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ page }, use) => {
    const loginPage = new AdminLoginPage(page);
    await loginPage.goto();
    await loginPage.loginAs(config.qa.adminEmail, config.qa.adminPassword);
    await loginPage.expectLoggedIn();
    await use(page);
  },

  clientPage: async ({ page }, use) => {
    const loginPage = new ClientLoginPage(page);
    await loginPage.goto();
    await loginPage.loginAs(config.qa.clientEmail, config.qa.clientPassword);
    await loginPage.expectLoggedIn();
    await use(page);
  },

  clientPageFast: async ({ page, request }, use) => {
    const session = await loginAsClient(request, config.qa.clientEmail, config.qa.clientPassword, config.qa.clientAccountId);
    // sessionStorage must be set on the target origin, so navigate first
    // (even to a route that will redirect to /login) before seeding it.
    await page.goto(config.client.baseURL);
    await page.evaluate((s) => {
      sessionStorage.setItem('token', s.token);
      sessionStorage.setItem('role', s.role);
      sessionStorage.setItem('accountId', s.accountId ?? '');
      sessionStorage.setItem(
        'user',
        JSON.stringify({ id: s.userId, role: s.role, tenantId: s.tenantId }),
      );
    }, session);
    await page.goto(`${config.client.baseURL}/home`);
    await use(page);
  },

  adminSession: async ({ request }, use) => {
    await use(await loginAsAdmin(request, config.qa.adminEmail, config.qa.adminPassword));
  },
  adminBSession: async ({ request }, use) => {
    await use(await loginAsAdmin(request, config.qa.adminBEmail, config.qa.adminBPassword));
  },
  clientSession: async ({ request }, use) => {
    await use(
      await loginAsClient(request, config.qa.clientEmail, config.qa.clientPassword, config.qa.clientAccountId),
    );
  },
  clientBSession: async ({ request }, use) => {
    await use(
      await loginAsClient(request, config.qa.clientBEmail, config.qa.clientBPassword, config.qa.clientBAccountId),
    );
  },

  apis: async ({ request }, use) => {
    await use(apiClients(request));
  },
});

export { expect } from '@playwright/test';
