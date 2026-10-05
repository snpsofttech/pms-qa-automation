import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';

/** Pipeline Template — P1 happy. Pipeline Templates → Create Pipeline → name + Available To + 2 stages → Save & Exit. */
const RUN = Date.now().toString(36);

test.describe('Pipeline Template @templates @pipelines @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create pipeline @happy', async ({ adminPage }) => {
    await navSidebar(adminPage, 'Templates', 'Pipeline Templates', /firmtemp\/pipelines/);
    await adminPage.waitForTimeout(700);
    for (const n of ['Create Pipeline', 'Create New Pipeline', 'New Pipeline', '+ Create Pipeline', 'Add Pipeline']) {
      const b = adminPage.getByRole('button', { name: n }).first();
      if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); break; }
    }
    await adminPage.waitForURL(/pipelineform/, { timeout: 10_000 });

    await adminPage.getByPlaceholder('Pipeline Name').fill(`QA_AUTO_PipelineTmpl_${RUN}`);

    // Available To (required): pick the current user from the combobox.
    await adminPage.locator('[role=combobox]').nth(1).click();
    await adminPage.waitForTimeout(500);
    await adminPage.getByRole('option').first().click({ timeout: 8_000 }).catch(() => {});
    await adminPage.keyboard.press('Escape').catch(() => {});

    // Add two stages and name them.
    const addStage = adminPage.getByRole('button', { name: 'Add stage', exact: true });
    await addStage.click();
    await adminPage.waitForTimeout(300);
    await addStage.click();
    await adminPage.waitForTimeout(500);
    const stageInputs = adminPage.getByPlaceholder(/stage/i);
    const n = await stageInputs.count();
    if (n >= 2) {
      await stageInputs.nth(n - 2).fill('To Do');
      await stageInputs.nth(n - 1).fill('Done');
    }

    await adminPage.getByRole('button', { name: 'Save & Exit', exact: true }).click();
    await expect(adminPage.getByText(/pipeline created successfully/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
