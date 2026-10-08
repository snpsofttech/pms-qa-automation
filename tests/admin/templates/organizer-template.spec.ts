import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';

/**
 * Organizer Template — P1 happy. Firm Templates → Organizers → Create Template
 * → template name + organizer name (+ a section) → Save & exit.
 */
const RUN = Date.now().toString(36);

test.describe('Organizer Template @templates @organizers @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create organizer template @happy', async ({ adminPage }) => {
    await navSidebar(adminPage, 'Templates', 'Firm Templates', /firmtemp\/templates/);
    await adminPage.locator('a[href$="/templates/organizers"]').first().click();
    await adminPage.waitForURL(/templates\/organizers/, { timeout: 10_000 });
    await adminPage.getByRole('button', { name: 'Create Template', exact: true }).click();

    await adminPage.getByPlaceholder('Template name').waitFor({ state: 'visible', timeout: 15_000 });
    await adminPage.getByPlaceholder('Template name').fill(`QA_AUTO_OrgTmpl_${RUN}`);
    await adminPage.getByPlaceholder('Organizer name').fill('QA Tax Organizer');

    // Add a section (a section/question is expected by the editor).
    await adminPage.getByRole('button', { name: 'New section', exact: true }).click();
    await adminPage.waitForTimeout(800);
    // Fill the section-name input that appears (first empty text input besides the two above).
    const sectionInput = adminPage
      .locator('input[type="text"]:visible')
      .filter({ hasNot: adminPage.getByPlaceholder('Template name') })
      .filter({ hasNot: adminPage.getByPlaceholder('Organizer name') })
      .last();
    await sectionInput.fill('Personal Info').catch(() => {});

    await adminPage.getByRole('button', { name: 'Save & exit', exact: true }).click();
    await expect(adminPage.getByText(/organizer template created|created successfully|success/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
