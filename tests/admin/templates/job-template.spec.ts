import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';

/**
 * Job Template — P1 happy. Nav: Templates → Firm Templates → Jobs tab →
 * create → Template Name + Job Name → Save & Exit → success toast.
 */
const RUN = Date.now().toString(36);

test.describe('Job Template @templates @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create job template @happy', async ({ adminPage }) => {
    await navSidebar(adminPage, 'Templates', 'Firm Templates', /firmtemp\/templates/);
    await adminPage.waitForTimeout(1000);

    // Jobs tab is an href link (SPA nav).
    await adminPage.locator('a[href$="/templates/jobs"]').first().click();
    await adminPage.waitForURL(/templates\/jobs/, { timeout: 10_000 });
    await adminPage.waitForTimeout(800);

    // Open the create form ("Job Template" or "Create New Job").
    const createBtn = adminPage.getByRole('button', { name: /job template|create new job/i }).first();
    await createBtn.click();
    await adminPage.waitForTimeout(1000);

    // Fill Template Name + Job Name (placeholder or label).
    const tmplName = adminPage.getByPlaceholder(/template name/i).first()
      .or(adminPage.getByLabel(/template name/i).first());
    await tmplName.fill(`QA_AUTO_JobTemp_${RUN}`);
    const jobName = adminPage.getByPlaceholder(/job name/i).first()
      .or(adminPage.getByLabel(/^job name/i).first());
    await jobName.fill('QA 2026 Tax Return');

    await adminPage.getByRole('button', { name: /save & exit/i }).click();
    await expect(adminPage.getByText(/job template created|created successfully|success/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
