import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';
import { firstAccountId } from '../../../helpers/jobsData';

/** Documents — P1 happy: create a folder in an account's Documents tab. */
const RUN = Date.now().toString(36);

test.describe('Documents — create folder @documents @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create folder @happy', async ({ adminPage, adminSession, request }) => {
    const acct = await firstAccountId(request, adminSession);
    await navSidebar(adminPage, 'Clients', 'Accounts', /activeaccounts/);
    await adminPage.waitForTimeout(1000);
    await adminPage.getByText(acct.name, { exact: false }).first().click();
    await adminPage.waitForURL(/accountsdash/, { timeout: 15_000 });
    await adminPage.locator('a[href*="accountsdash/docs"]').first().click();
    await adminPage.waitForTimeout(1200);

    // Toolbar "Create Folder" opens the drawer.
    await adminPage.getByRole('button', { name: 'Create Folder', exact: true }).first().click();
    const name = `QA_AUTO_Folder_${RUN}`;
    await adminPage.getByPlaceholder('Enter new folder name').waitFor({ state: 'visible', timeout: 15_000 });
    await adminPage.getByPlaceholder('Enter new folder name').fill(name);
    // Drawer submit (the last "Create Folder" button).
    await adminPage.getByRole('button', { name: 'Create Folder', exact: true }).last().click();

    // Folder appears in the Document Explorer.
    await expect(adminPage.getByText(name).first()).toBeVisible({ timeout: 20_000 });
  });
});
