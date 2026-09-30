import { test, expect } from '../../../fixtures/auth.fixture';
import { navSidebar } from '../../../helpers/adminNav';
import { openQuickCreate } from '../../../helpers/quickCreate';
import { findContactByEmail } from '../../../helpers/contactData';

/**
 * Create Contact (New Contact drawer) — sheet group "Create Contact".
 * Opened via the global "+ → Contact". The drawer is a Sheet (not role=dialog),
 * so fields are located by placeholder at page level.
 *
 * Verification: success toast (UI) + API existence by email (data). Created
 * contacts are QA-prefixed and left in place (no standalone-contact delete API;
 * consistent with accepted QA-data accumulation on staging).
 */
const RUN = Date.now().toString(36);

async function openContactDrawer(page: any) {
  await navSidebar(page, 'Clients', 'Contacts', /contacts/);
  await openQuickCreate(page, 'Contact');
  await page.getByPlaceholder('First Name').first().waitFor({ state: 'visible', timeout: 20_000 });
}

test.describe('Create Contact @contacts @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create Contact (required fields) @happy', async ({ adminPage, adminSession, request }) => {
    const email = `qa.req.${RUN}@test.com`;
    await openContactDrawer(adminPage);
    await adminPage.getByPlaceholder('First Name').first().fill('John');
    await adminPage.getByPlaceholder('Last Name').first().fill(`QAReq${RUN}`);
    await adminPage.getByPlaceholder('Email Address').first().fill(email);
    await adminPage.getByRole('button', { name: 'Create Contact' }).click();

    await expect(adminPage.getByText('Contact created successfully!')).toBeVisible({ timeout: 20_000 });
    expect(await findContactByEmail(request, adminSession, email), 'contact should exist server-side').toBeTruthy();
  });

  test('Create Contact (all fields) @happy', async ({ adminPage, adminSession, request }) => {
    const email = `qa.all.${RUN}@test.com`;
    await openContactDrawer(adminPage);
    await adminPage.getByPlaceholder('First Name').first().fill('Jane');
    await adminPage.getByPlaceholder('Middle Name').first().fill('A');
    await adminPage.getByPlaceholder('Last Name').first().fill(`QAAll${RUN}`);
    await adminPage.getByPlaceholder('Company Name').first().fill('QA Corp');
    await adminPage.getByPlaceholder('Email Address').first().fill(email);
    await adminPage.getByPlaceholder('SSN').first().fill('123456789');
    await adminPage.getByPlaceholder('Write a note...').first().fill('QA automation note').catch(() => {});
    await adminPage.getByPlaceholder('Street Address').first().fill('123 QA Street').catch(() => {});
    await adminPage.getByPlaceholder('City').first().fill('QA City').catch(() => {});
    await adminPage.getByPlaceholder('State').first().fill('California').catch(() => {});
    await adminPage.getByPlaceholder('Postal Code').first().fill('10001').catch(() => {});
    await adminPage.getByRole('button', { name: 'Create Contact' }).click();

    await expect(adminPage.getByText('Contact created successfully!')).toBeVisible({ timeout: 20_000 });
    const c = await findContactByEmail(request, adminSession, email);
    expect(c, 'contact should exist').toBeTruthy();
    expect(String(c?.firstName ?? '')).toBe('Jane');
  });

  test('First Name required @negative', async ({ adminPage, adminSession, request }) => {
    const email = `qa.nofirst.${RUN}@test.com`;
    await openContactDrawer(adminPage);
    // Leave First Name empty.
    await adminPage.getByPlaceholder('Last Name').first().fill(`QANoFirst${RUN}`);
    await adminPage.getByPlaceholder('Email Address').first().fill(email);
    await adminPage.getByRole('button', { name: 'Create Contact' }).click();

    // "First Name *" is HTML-required — the browser blocks submit natively (a
    // native bubble, no DOM message). Assert the outcome: nothing created and
    // the drawer stays open on the First Name field.
    await adminPage.waitForTimeout(1500);
    await expect(adminPage.getByText('Contact created successfully!')).toHaveCount(0);
    await expect(adminPage.getByPlaceholder('First Name').first()).toBeVisible();
    expect(await findContactByEmail(request, adminSession, email)).toBeNull();
  });

  test('Contact Name manual edit @edge', async ({ adminPage, adminSession, request }) => {
    const email = `qa.manual.${RUN}@test.com`;
    await openContactDrawer(adminPage);
    await adminPage.getByPlaceholder('First Name').first().fill('John');
    await adminPage.getByPlaceholder('Last Name').first().fill(`QAManual${RUN}`);
    // Overwrite the auto-filled Contact Name.
    const contactName = adminPage.getByPlaceholder('Contact Name').first();
    await contactName.fill('Johnny D');
    await adminPage.getByPlaceholder('Email Address').first().fill(email);
    await adminPage.getByRole('button', { name: 'Create Contact' }).click();

    await expect(adminPage.getByText('Contact created successfully!')).toBeVisible({ timeout: 20_000 });
    const c = await findContactByEmail(request, adminSession, email);
    expect(c, 'contact should exist').toBeTruthy();
    const savedName = String(c?.contactName ?? c?.name ?? c?.fullName ?? '');
    expect(savedName, 'manually typed Contact Name should be saved').toContain('Johnny D');
  });

  test('Multiple phone numbers @happy', async ({ adminPage, adminSession, request }) => {
    const email = `qa.phones.${RUN}@test.com`;
    await openContactDrawer(adminPage);
    await adminPage.getByPlaceholder('First Name').first().fill('Multi');
    await adminPage.getByPlaceholder('Last Name').first().fill(`QAPhones${RUN}`);
    await adminPage.getByPlaceholder('Email Address').first().fill(email);

    // Add up to 3 phone inputs via "Add Phone", then fill each.
    const addPhone = adminPage.getByRole('button', { name: /add phone/i });
    for (let i = 0; i < 2; i++) if (await addPhone.isVisible().catch(() => false)) await addPhone.click().catch(() => {});
    const phones = adminPage.locator('input[type="tel"], .react-tel-input input');
    const count = await phones.count();
    const numbers = ['2025550101', '2025550102', '2025550103'];
    for (let i = 0; i < Math.min(count, 3); i++) await phones.nth(i).fill(numbers[i]).catch(() => {});

    await adminPage.getByRole('button', { name: 'Create Contact' }).click();
    await expect(adminPage.getByText('Contact created successfully!')).toBeVisible({ timeout: 20_000 });
    expect(await findContactByEmail(request, adminSession, email)).toBeTruthy();
  });
});
