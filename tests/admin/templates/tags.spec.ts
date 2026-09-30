import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';

/**
 * Tags template — P1 happy. Nav: Templates group → Tags (firmtemp/tags).
 * Add Tag → name + color swatch → Create → success toast.
 */
const RUN = Date.now().toString(36);

test.describe('Tags @templates @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create tag @happy', async ({ adminPage }) => {
    await navSidebar(adminPage, 'Templates', 'Tags', /firmtemp\/tags/);
    await adminPage.getByRole('button', { name: 'Add Tag', exact: true }).click();
    await adminPage.getByPlaceholder('Enter tag name').waitFor({ state: 'visible', timeout: 15_000 });

    await adminPage.getByPlaceholder('Enter tag name').fill(`QA_AUTO_Tag_${RUN}`);
    // Pick the first color swatch (first button after the "Color *" label).
    await adminPage.getByText('Color', { exact: false }).first().locator('xpath=following::button[1]').click();

    await adminPage.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(adminPage.getByText(/tag created/i)).toBeVisible({ timeout: 20_000 });
  });
});
