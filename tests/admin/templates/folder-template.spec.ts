import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';

/** Folder Template — P1 happy. Firm Templates → Folders tab → Create Template → name → Create. */
const RUN = Date.now().toString(36);

test.describe('Folder Template @templates @documents @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create folder template @happy', async ({ adminPage }) => {
    await navSidebar(adminPage, 'Templates', 'Firm Templates', /firmtemp\/templates/);
    await adminPage.locator('a[href$="/templates/folders"]').first().click();
    await adminPage.waitForURL(/templates\/folders/, { timeout: 10_000 });
    await adminPage.getByRole('button', { name: 'Create Template', exact: true }).click();

    await adminPage.getByPlaceholder('Enter template name').waitFor({ state: 'visible', timeout: 15_000 });
    await adminPage.getByPlaceholder('Enter template name').fill(`QA_AUTO_FolderTemp_${RUN}`);
    await adminPage.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(adminPage.getByText(/folder template created|created successfully|success/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
