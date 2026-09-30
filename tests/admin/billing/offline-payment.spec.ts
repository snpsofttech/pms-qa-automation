import { test, expect } from '../../../fixtures/auth.fixture';
import { openQuickCreate } from '../../../helpers/quickCreate';
import { firstAccountId } from '../../../helpers/jobsData';

/**
 * Offline Payment — P1 happy (via "+ → Offline Payment"): select an account
 * with a pending invoice, tick it, pay its amount, Save → success toast.
 * Requires >= 1 pending invoice on the account (the Create Invoice happy leaves
 * one; skips clean if none are present).
 */
test.describe('Offline Payment @payments @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Offline payment for one invoice @happy', async ({ adminPage, adminSession, request }) => {
    const acct = await firstAccountId(request, adminSession);
    await openQuickCreate(adminPage, 'Offline Payment');
    await adminPage.getByRole('button', { name: 'Save' }).waitFor({ state: 'visible', timeout: 15_000 });

    // Select the account.
    await adminPage.getByText('Select an account', { exact: true }).first().click();
    await adminPage.waitForTimeout(400);
    await adminPage.keyboard.type(acct.name);
    await adminPage.waitForTimeout(700);
    await adminPage.getByRole('option').first().click({ timeout: 8_000 });
    await adminPage.waitForTimeout(1200);

    // Need a pending invoice row (amount cell). Skip cleanly if none.
    const invoiceRow = adminPage.getByRole('row').filter({ hasText: /\$\d/ }).first();
    if (!(await invoiceRow.isVisible().catch(() => false))) {
      test.skip(true, 'No pending invoice on the account to settle');
    }
    const rowText = await invoiceRow.innerText();
    const amount = (rowText.match(/\$([\d,]+\.\d{2})/)?.[1] ?? '500').replace(/,/g, '');

    // Tick the invoice (shadcn checkbox has pointer-events:none → force/row click).
    const cb = invoiceRow.getByRole('checkbox');
    await cb.click({ force: true }).catch(async () => { await invoiceRow.click(); });
    await adminPage.waitForTimeout(400);

    // Fill the amount if it didn't auto-populate.
    const amountField = adminPage.getByPlaceholder('$ 0.00');
    const current = await amountField.inputValue();
    if (!current || /^\D*0\.00\D*$/.test(current)) await amountField.fill(amount);

    await adminPage.keyboard.press('Escape').catch(() => {});
    await adminPage.getByRole('button', { name: 'Save' }).click();
    await expect(adminPage.getByText(/offline payment added successfully/i)).toBeVisible({ timeout: 20_000 });
  });
});
