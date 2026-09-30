import { test, expect } from '../../../fixtures/auth.fixture';
import { openQuickCreate } from '../../../helpers/quickCreate';
import { firstAccountId } from '../../../helpers/jobsData';

/** Create Task — P1 happy (via "+ → Task"): select account + task name → Create. */
const RUN = Date.now().toString(36);

async function selectAccountCombo(page: any, name: string) {
  await page.getByText('Select an account', { exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.keyboard.type(name);
  await page.waitForTimeout(700);
  await page.getByRole('option').first().click({ timeout: 8_000 });
  await page.waitForTimeout(200);
  const overlay = page.locator('div.fixed.inset-0.z-40');
  if (await overlay.first().isVisible().catch(() => false)) await overlay.first().click({ position: { x: 5, y: 5 } }).catch(() => {});
}

test.describe('Create Task @tasks @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create Task (required fields) @happy', async ({ adminPage, adminSession, request }) => {
    const acct = await firstAccountId(request, adminSession);
    await openQuickCreate(adminPage, 'Task');
    await adminPage.getByPlaceholder('Task Name').waitFor({ state: 'visible', timeout: 15_000 });

    await selectAccountCombo(adminPage, acct.name);
    await adminPage.getByPlaceholder('Task Name').fill(`QA_AUTO_Task_${RUN}`);
    await adminPage.getByRole('button', { name: 'Create Task' }).click();

    await expect(adminPage.getByText(/task created successfully/i)).toBeVisible({ timeout: 20_000 });
  });
});
