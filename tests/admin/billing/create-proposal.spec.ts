import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';
import { firstAccountId } from '../../../helpers/jobsData';

/**
 * Create Proposal — P1 happy (via Billing → Proposals & Els → New). Multi-step
 * wizard: General (name/account/team) → Introduction → Terms → Services → Submit.
 * Each middle step gates "Next" on a title input + a rich-text editor.
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

  // FIXME: reaches the Introduction step; its rich-text DESCRIPTION editor does
  // not accept programmatic input (keyboard.type, .fill(), pressSequentially all
  // leave "Introduction description is required"), so "Next" stays gated. A
  // Lexical/TipTap-style controlled editor — needs editor-specific input
  // (dispatch beforeinput/InputEvent, or drive the editor API). General step +
  // title fields work; only the per-step rich editors block it.
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
    await adminPage.locator('[role=combobox]').last().click();
    await adminPage.waitForTimeout(400);
    await adminPage.getByRole('option').first().click({ timeout: 8_000 }).catch(() => {});
    await adminPage.keyboard.press('Escape').catch(() => {});
    await adminPage.getByRole('button', { name: 'Next', exact: true }).click();
    await adminPage.waitForTimeout(1000);

    // Middle steps (Introduction, Terms): fill the step's title placeholder +
    // its aria-labeled rich-text editor, then advance, until Submit appears.
    const titlePlaceholders = [/enter introduction title/i, /enter terms title/i, /title/i];
    for (let i = 0; i < 4; i++) {
      if (await adminPage.getByRole('button', { name: /submit proposal/i }).first().isVisible().catch(() => false)) break;
      for (const ph of titlePlaceholders) {
        const title = adminPage.getByPlaceholder(ph).first();
        if (await title.isVisible().catch(() => false)) { await title.fill(`QA Section ${i}`).catch(() => {}); break; }
      }
      const editor = adminPage.getByRole('textbox', { name: /rich text editor/i }).first();
      if (await editor.isVisible().catch(() => false)) {
        await editor.click().catch(() => {});
        // Controlled editor: .fill() dispatches proper input events; fall back
        // to pressSequentially if needed.
        await editor.fill('QA automation content.').catch(async () => {
          await editor.pressSequentially('QA automation content.').catch(() => {});
        });
        await adminPage.waitForTimeout(400);
      }
      const next = adminPage.getByRole('button', { name: 'Next', exact: true }).first();
      if (await next.isVisible().catch(() => false)) { await next.click().catch(() => {}); await adminPage.waitForTimeout(1200); }
      else break;
    }

    // Services step: add a line item, then Submit.
    const addItem = adminPage.getByRole('button', { name: /line item|add item|add service/i }).first();
    if (await addItem.isVisible().catch(() => false)) {
      await addItem.click().catch(() => {});
      await adminPage.getByPlaceholder(/product or service/i).first().fill('QA Service').catch(() => {});
      await adminPage.getByPlaceholder('0.00').first().fill('500').catch(() => {});
    }
    await adminPage.keyboard.press('Escape').catch(() => {});
    await adminPage.getByRole('button', { name: /submit proposal/i }).first().click();
    await expect(adminPage.getByText(/proposal submitted successfully/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
