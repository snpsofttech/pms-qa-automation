import { test, expect } from '../../../fixtures/auth.fixture';
import { openQuickCreate } from '../../../helpers/quickCreate';
import { firstAccountId } from '../../../helpers/jobsData';

/** Create Chat — P1 happy (via "+ → Chat"): account + subject → Create Chat. */
const RUN = Date.now().toString(36);

test.describe('Create Chat @chat @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  // FIXME (needs investigation): with a valid account + subject filled, the
  // Create Chat drawer does not close / no success toast appears — creation
  // doesn't complete. Possibly the documented NewChatDrawer loading bug
  // (setLoading(true) before validation) or an unstated required field
  // (contact-with-email / Description). Revisit; may become an app bug report.
  test.fixme('Create Chat via + menu @happy', async ({ adminPage, adminSession, request }) => {
    const acct = await firstAccountId(request, adminSession);
    await openQuickCreate(adminPage, 'Chat');
    await adminPage.getByRole('button', { name: 'Create Chat' }).waitFor({ state: 'visible', timeout: 15_000 });

    // Account is the 2nd combobox (1st is the global header search).
    await adminPage.locator('[role=combobox]').nth(1).click();
    await adminPage.waitForTimeout(400);
    await adminPage.keyboard.type(acct.name);
    await adminPage.waitForTimeout(700);
    await adminPage.getByRole('option').first().click({ timeout: 8_000 });
    await adminPage.waitForTimeout(200);
    const overlay = adminPage.locator('div.fixed.inset-0.z-40');
    if (await overlay.first().isVisible().catch(() => false)) await overlay.first().click({ position: { x: 5, y: 5 } }).catch(() => {});

    // Subject (labeled "Subject *", but not associated) — the input right after
    // the "Subject *" label.
    await adminPage
      .getByText('Subject', { exact: false })
      .first()
      .locator('xpath=following::input[1]')
      .fill(`QA Documents needed ${RUN}`);

    // Blur the subject field, then submit.
    await adminPage.getByRole('heading', { name: 'New Chat' }).click().catch(() => {});
    await adminPage.getByRole('button', { name: 'Create Chat' }).click();
    // Success = drawer closes (Create Chat gone). Toast text varies, so don't rely on it.
    await expect(adminPage.getByRole('button', { name: 'Create Chat' })).toBeHidden({ timeout: 20_000 });
  });
});
