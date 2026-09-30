import { test, expect } from '../../../fixtures/auth.fixture';
import {
  openAccountDrawer,
  selectFolderTemplateIfAvailable,
  fillCompanyAddress,
  addContact,
  findAccountId,
  deleteAccountsByName,
} from '../../../helpers/accountDrawer';

/**
 * Account + Contact Drawer — automated from the QA test-case sheet
 * ("Account + Contact Drawer" group). One test per case, tagged by the
 * sheet's Type. P1 cases in this file.
 *
 * Setup/cleanup: happy cases create QA_AUTO_-prefixed accounts and delete them
 * at end of test (best-effort). Negative cases assert nothing was saved.
 */
const RUN = Date.now().toString(36);
const ADDRESS = { country: 'United States', street: '123 QA Street', city: 'QA City', state: 'California', zip: '10001' };

test.describe('Account + Contact Drawer @accounts @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create Account + Contact (Individual) @happy', async ({ adminPage, adminSession, request }) => {
    const name = `QA_AUTO_Individual_${RUN}`;
    const drawer = await openAccountDrawer(adminPage);
    await drawer.getByRole('radio', { name: 'Individual' }).check();
    await drawer.getByPlaceholder('Enter account name').fill(name);
    await selectFolderTemplateIfAvailable(drawer);
    await drawer.getByRole('button', { name: 'Continue' }).click();
    await addContact(drawer, 0, { first: 'John', last: 'Doe', email: `john.doe.${RUN}@test.com` });
    await drawer.getByRole('button', { name: 'Submit' }).click();

    await expect(adminPage.getByText('Account saved successfully!')).toBeVisible({ timeout: 20_000 });
    await expect(adminPage.getByRole('table').getByText(name)).toBeVisible({ timeout: 15_000 });
    await deleteAccountsByName(request, adminSession, [name]);
  });

  test('Create Account + Contact (Company) @happy', async ({ adminPage, adminSession, request }) => {
    const name = `QA_AUTO_Company_${RUN}`;
    const company = `QA_AUTO_Acme_${RUN}`;
    const drawer = await openAccountDrawer(adminPage);
    await drawer.getByRole('radio', { name: 'Company' }).check();
    await drawer.getByPlaceholder('Enter account name').fill(name);
    await drawer.getByPlaceholder('Enter company name').fill(company);
    await selectFolderTemplateIfAvailable(drawer);
    await fillCompanyAddress(drawer, ADDRESS);
    await drawer.getByRole('button', { name: 'Continue' }).click();
    await addContact(drawer, 0, { first: 'Jane', last: 'Roe', email: `jane.roe.${RUN}@test.com` });
    await drawer.getByRole('button', { name: 'Submit' }).click();

    await expect(adminPage.getByText('Account saved successfully!')).toBeVisible({ timeout: 20_000 });
    await expect(adminPage.getByRole('table').getByText(name)).toBeVisible({ timeout: 15_000 });
    await deleteAccountsByName(request, adminSession, [name]);
  });

  test('Create Account + link existing contact @contacts @happy', async ({ adminPage, adminSession, request }) => {
    const name = `QA_AUTO_LinkExisting_${RUN}`;
    const drawer = await openAccountDrawer(adminPage);
    await drawer.getByRole('radio', { name: 'Individual' }).check();
    await drawer.getByPlaceholder('Enter account name').fill(name);
    await selectFolderTemplateIfAvailable(drawer);
    await drawer.getByRole('button', { name: 'Continue' }).click();

    // Link an existing contact: open the picker, select the first contact, link.
    await drawer.getByRole('button', { name: 'Link Existing' }).click();
    // The shadcn checkbox has pointer-events:none — click the contact's row card.
    const firstContactCard = drawer
      .getByRole('checkbox')
      .nth(1)
      .locator('xpath=ancestor::*[contains(@class,"cursor-pointer")][1]');
    await firstContactCard.click();
    // Picker confirm button (actual label; the sheet's "Link N" differs).
    await drawer.getByRole('button', { name: /add selected contact/i }).click();
    await drawer.getByRole('button', { name: 'Submit' }).click();

    await expect(adminPage.getByText('Account saved successfully!')).toBeVisible({ timeout: 20_000 });
    await deleteAccountsByName(request, adminSession, [name]);
  });

  test('Client Type toggle @happy', async ({ adminPage }) => {
    const drawer = await openAccountDrawer(adminPage);
    await drawer.getByRole('radio', { name: 'Individual' }).check();
    // Individual: company name + business address hidden.
    await expect(drawer.getByPlaceholder('Enter company name')).toBeHidden();
    await expect(drawer.getByPlaceholder('Street address')).toBeHidden();
    // Company: both shown, Company Name marked required.
    await drawer.getByRole('radio', { name: 'Company' }).check();
    await expect(drawer.getByPlaceholder('Enter company name')).toBeVisible();
    await expect(drawer.getByPlaceholder('Street address')).toBeVisible();
    await expect(drawer.getByText('Company Name*')).toBeVisible();
  });

  test('Account Name required @negative', async ({ adminPage, adminSession, request }) => {
    const drawer = await openAccountDrawer(adminPage);
    await drawer.getByRole('radio', { name: 'Individual' }).check();
    await selectFolderTemplateIfAvailable(drawer);
    // Leave account name empty.
    await drawer.getByRole('button', { name: 'Continue' }).click();
    await adminPage.waitForTimeout(800);
    if (!(await adminPage.getByText(/account name is required/i).first().isVisible().catch(() => false))) {
      // If it advanced, add a valid contact and submit to trigger validation.
      if (await drawer.getByRole('button', { name: 'Add Contact' }).isVisible().catch(() => false)) {
        await addContact(drawer, 0, { first: 'QA', last: 'User', email: `qa.${RUN}@test.com` });
      }
      await drawer.getByRole('button', { name: 'Submit' }).click().catch(() => {});
    }
    await expect(adminPage.getByText(/account name is required/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText('Account saved successfully!')).toHaveCount(0);
  });

  test('Company Name required @negative', async ({ adminPage }) => {
    const name = `QA_AUTO_NoCompany_${RUN}`;
    const drawer = await openAccountDrawer(adminPage);
    await drawer.getByRole('radio', { name: 'Company' }).check();
    await drawer.getByPlaceholder('Enter account name').fill(name);
    await selectFolderTemplateIfAvailable(drawer);
    // Leave company name empty.
    await drawer.getByRole('button', { name: 'Continue' }).click();
    await adminPage.waitForTimeout(800);
    if (!(await adminPage.getByText(/company name is required/i).first().isVisible().catch(() => false))) {
      if (await drawer.getByRole('button', { name: 'Add Contact' }).isVisible().catch(() => false)) {
        await addContact(drawer, 0, { first: 'QA', last: 'User', email: `qa.${RUN}@test.com` });
      }
      await drawer.getByRole('button', { name: 'Submit' }).click().catch(() => {});
    }
    await expect(adminPage.getByText(/company name is required/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText('Account saved successfully!')).toHaveCount(0);
  });

  test('Duplicate account name @negative', async ({ adminPage, adminSession, request }) => {
    const name = `QA_AUTO_Dup_${RUN}`;
    // First, create the account so the name exists.
    let drawer = await openAccountDrawer(adminPage);
    await drawer.getByRole('radio', { name: 'Individual' }).check();
    await drawer.getByPlaceholder('Enter account name').fill(name);
    await selectFolderTemplateIfAvailable(drawer);
    await drawer.getByRole('button', { name: 'Continue' }).click();
    await addContact(drawer, 0, { first: 'Dup', last: 'One', email: `dup.${RUN}@test.com` });
    await drawer.getByRole('button', { name: 'Submit' }).click();
    await expect(adminPage.getByText('Account saved successfully!')).toBeVisible({ timeout: 20_000 });

    // Now attempt a second account with the same name.
    drawer = await openAccountDrawer(adminPage);
    await drawer.getByRole('radio', { name: 'Individual' }).check();
    await drawer.getByPlaceholder('Enter account name').fill(name);
    await selectFolderTemplateIfAvailable(drawer);
    await drawer.getByRole('button', { name: 'Continue' }).click().catch(() => {});
    await adminPage.waitForTimeout(800);
    if (await drawer.getByRole('button', { name: 'Add Contact' }).isVisible().catch(() => false)) {
      await addContact(drawer, 0, { first: 'Dup', last: 'Two', email: `dup2.${RUN}@test.com` });
      await drawer.getByRole('button', { name: 'Submit' }).click().catch(() => {});
    }
    // App shows an inline "Account name is taken" (the sheet's "red error under
    // Account Name" path); accept either that or an "already exists" toast.
    await expect(adminPage.getByText(/already exists|is taken/i).first()).toBeVisible({ timeout: 10_000 });
    await deleteAccountsByName(request, adminSession, [name]);
  });

  // ── Contact-level validation (valid account, invalid contact) ──────────

  async function fillValidAccountAndContinue(adminPage: any, drawer: any, name: string) {
    await drawer.getByRole('radio', { name: 'Individual' }).check();
    await drawer.getByPlaceholder('Enter account name').fill(name);
    await selectFolderTemplateIfAvailable(drawer);
    await drawer.getByRole('button', { name: 'Continue' }).click();
    await expect(drawer.getByRole('button', { name: 'Add Contact' })).toBeVisible({ timeout: 10_000 });
  }

  test('Contact First Name required @contacts @negative', async ({ adminPage, adminSession, request }) => {
    const name = `QA_AUTO_NoFirst_${RUN}`;
    const drawer = await openAccountDrawer(adminPage);
    await fillValidAccountAndContinue(adminPage, drawer, name);
    await addContact(drawer, 0, { last: 'Doe', email: `nf.${RUN}@test.com` }); // no first name
    await drawer.getByRole('button', { name: 'Submit' }).click();
    await expect(adminPage.getByText(/first name is required/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText('Account saved successfully!')).toHaveCount(0);
    expect(await findAccountId(request, adminSession, name)).toBeNull();
  });

  test('Contact Last Name required @contacts @negative', async ({ adminPage, adminSession, request }) => {
    const name = `QA_AUTO_NoLast_${RUN}`;
    const drawer = await openAccountDrawer(adminPage);
    await fillValidAccountAndContinue(adminPage, drawer, name);
    await addContact(drawer, 0, { first: 'John', email: `nl.${RUN}@test.com` }); // no last name
    await drawer.getByRole('button', { name: 'Submit' }).click();
    await expect(adminPage.getByText(/last name is required/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText('Account saved successfully!')).toHaveCount(0);
    expect(await findAccountId(request, adminSession, name)).toBeNull();
  });

  test('Contact email or phone required @contacts @negative', async ({ adminPage, adminSession, request }) => {
    const name = `QA_AUTO_NoEmailPhone_${RUN}`;
    const drawer = await openAccountDrawer(adminPage);
    await fillValidAccountAndContinue(adminPage, drawer, name);
    await addContact(drawer, 0, { first: 'John', last: 'Doe' }); // no email, no phone
    await drawer.getByRole('button', { name: 'Submit' }).click();
    await expect(adminPage.getByText(/email or phone number is required/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText('Account saved successfully!')).toHaveCount(0);
    expect(await findAccountId(request, adminSession, name)).toBeNull();
  });

  test('Contact invalid email @contacts @negative', async ({ adminPage, adminSession, request }) => {
    const name = `QA_AUTO_BadEmail_${RUN}`;
    const drawer = await openAccountDrawer(adminPage);
    await fillValidAccountAndContinue(adminPage, drawer, name);
    await addContact(drawer, 0, { first: 'John', last: 'Doe', email: 'john@' });
    await drawer.getByRole('button', { name: 'Submit' }).click();
    await expect(adminPage.getByText(/valid email address/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText('Account saved successfully!')).toHaveCount(0);
    expect(await findAccountId(request, adminSession, name)).toBeNull();
  });

  test('Contact with phone only @contacts @edge', async ({ adminPage, adminSession, request }) => {
    const name = `QA_AUTO_PhoneOnly_${RUN}`;
    const drawer = await openAccountDrawer(adminPage);
    await fillValidAccountAndContinue(adminPage, drawer, name);
    await addContact(drawer, 0, { first: 'Phone', last: 'Only', phone: '+12025550147' });
    await drawer.getByRole('button', { name: 'Submit' }).click();
    await expect(adminPage.getByText('Account saved successfully!')).toBeVisible({ timeout: 20_000 });
    await deleteAccountsByName(request, adminSession, [name]);
  });

  test('Duplicate contact emails @contacts @negative', async ({ adminPage, adminSession, request }) => {
    const name = `QA_AUTO_DupEmail_${RUN}`;
    const drawer = await openAccountDrawer(adminPage);
    await fillValidAccountAndContinue(adminPage, drawer, name);
    await addContact(drawer, 0, { first: 'A', last: 'One', email: `dupemail.${RUN}@test.com` });
    await addContact(drawer, 1, { first: 'B', last: 'Two', email: `dupemail.${RUN}@test.com` });
    await drawer.getByRole('button', { name: 'Submit' }).click();
    await expect(adminPage.getByText(/duplicate email/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText('Account saved successfully!')).toHaveCount(0);
    expect(await findAccountId(request, adminSession, name)).toBeNull();
  });
});
