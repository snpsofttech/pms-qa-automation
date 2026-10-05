import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';
import { firstAccountId } from '../../../helpers/jobsData';

/**
 * Create Proposal — P1 happy (via Billing → Proposals & Els → New). Multi-step
 * wizard: General (name/account/team) → Introduction → Terms → Services → Submit.
 */
const RUN = Date.now().toString(36);

async function pickCombo(page: any, triggerText: string, type?: string) {
  await page.getByText(triggerText, { exact: false }).first().click();
  await page.waitForTimeout(400);
  if (type) await page.keyboard.type(type);
  await page.waitForTimeout(600);
  await page.getByRole('option').first().click({ timeout: 8_000 }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
}

test.describe('Create Proposal @proposals @admin-ui', () => {
  test.describe.configure({ timeout: 180_000 });

  // FIXME: multi-step wizard with per-step rich-text editors (Introduction/
  // Terms titles + editors gate "Next") and step-enable toggles that aren't
  // reliably targetable yet. Reaches the General step; needs dedicated
  // step-by-step handling (or robust toggle-off of optional steps). Heavy
  // editor — grouped with the Invoice/Organizer template editors for a
  // focused pass.
  test.fixme('Create proposal via Billing @happy', async ({ adminPage, adminSession, request }) => {
    const acct = await firstAccountId(request, adminSession);
    await navSidebar(adminPage, 'Billing', 'Proposals&Els', /proposalsandels/);
    await adminPage.waitForTimeout(1000);
    await adminPage.getByRole('button', { name: 'New Proposals & Els' }).first()
      .or(adminPage.getByRole('link', { name: 'New Proposals & Els' }).first()).click();
    await adminPage.waitForURL(/proposalsandels\/new/, { timeout: 15_000 });

    // General
    await adminPage.getByPlaceholder('Proposal name (visible to clients)').fill(`QA_AUTO_Proposal_${RUN}`);
    await pickCombo(adminPage, 'Select an account...', acct.name);
    // Team Members (the remaining empty combobox) — pick first option.
    await adminPage.locator('[role=combobox]').last().click();
    await adminPage.waitForTimeout(400);
    await adminPage.getByRole('option').first().click({ timeout: 8_000 }).catch(() => {});
    await adminPage.keyboard.press('Escape').catch(() => {});

    // Disable the optional steps (Introduction, Terms, Payment) so the wizard
    // collapses to General → Services → Submit. Keep "Services & Invoices" on.
    for (const label of ['Introduction Step', 'Terms Step', 'Payment Step']) {
      const sw = adminPage.getByText(label, { exact: true }).locator('xpath=following::button[@role="switch"][1]').first();
      if (await sw.isChecked().catch(() => false)) await sw.click().catch(() => {});
    }
    await adminPage.getByRole('button', { name: 'Next', exact: true }).click();
    await adminPage.waitForTimeout(1200);

    // Services step: add a line item if possible, then Submit.
    const addItem = adminPage.getByRole('button', { name: /line item|add item|add service/i }).first();
    if (await addItem.isVisible().catch(() => false)) {
      await addItem.click().catch(() => {});
      await adminPage.getByPlaceholder(/product or service/i).first().fill('QA Service').catch(() => {});
      await adminPage.getByPlaceholder('0.00').first().fill('500').catch(() => {});
    }
    await adminPage.getByRole('button', { name: /submit proposal/i }).first().click();
    await expect(adminPage.getByText(/proposal submitted successfully/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
