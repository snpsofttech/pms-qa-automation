import { Page, Locator, expect, APIRequestContext } from '@playwright/test';
import { navSidebar } from './adminNav';
import { apiClients, AuthSession } from './apiClient';
import { extractList } from './assertions';
import { config } from './config';

/**
 * Helpers for the Account + Contact creation drawer (opened from the Accounts
 * list "Add Account", the same drawer the global "+ → Account" opens).
 *
 * Field map (from live recon):
 *   Step 1: radio[name=clientType] (Individual|Company), input[name=accountName],
 *           input[name=companyName] (Company only), a "Folder Template*" native
 *           <select> ("Select Folder Template"), a Country <select>
 *           ("Select Country"), streetAddress/city/state/postalCode (Company).
 *   Step 2 buttons: Link Existing, Add Contact, Back, Submit.
 *           Contact card: firstName/middleName/lastName, email, ssn, ...
 */

export async function openAccountDrawer(page: Page): Promise<Locator> {
  await navSidebar(page, 'Clients', 'Accounts', /activeaccounts/);
  await page.getByRole('button', { name: 'Add Account' }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText('Create Account')).toBeVisible({ timeout: 15_000 });
  return drawer;
}

/** Select the first real folder template if any exist (field is optional in practice). */
export async function selectFolderTemplateIfAvailable(drawer: Locator): Promise<void> {
  const sel = drawer
    .locator('select')
    .filter({ has: drawer.page().locator('option', { hasText: 'Select Folder Template' }) })
    .first();
  const options = await sel.locator('option').count().catch(() => 0);
  if (options > 1) await sel.selectOption({ index: 1 }).catch(() => {});
}

export async function fillCompanyAddress(
  drawer: Locator,
  addr: { country: string; street: string; city: string; state: string; zip: string },
): Promise<void> {
  const countrySel = drawer
    .locator('select')
    .filter({ has: drawer.page().locator('option', { hasText: 'Select Country' }) })
    .first();
  await countrySel.selectOption({ label: addr.country });
  await drawer.getByPlaceholder('Street address').fill(addr.street);
  await drawer.getByPlaceholder('City').fill(addr.city);
  await drawer.getByPlaceholder('State').fill(addr.state);
  await drawer.getByPlaceholder('ZIP Code').fill(addr.zip);
}

export interface ContactData {
  first?: string;
  middle?: string;
  last?: string;
  email?: string;
  phone?: string;
}

/** Add a contact card and fill it (idx = 0 for the first card). */
export async function addContact(drawer: Locator, idx: number, c: ContactData): Promise<void> {
  await drawer.getByRole('button', { name: 'Add Contact' }).click();
  if (c.first !== undefined) await drawer.getByPlaceholder('First Name').nth(idx).fill(c.first);
  if (c.middle !== undefined) await drawer.getByPlaceholder('Middle Name').nth(idx).fill(c.middle);
  if (c.last !== undefined) await drawer.getByPlaceholder('Last Name').nth(idx).fill(c.last);
  if (c.email !== undefined) await drawer.getByPlaceholder('Email').nth(idx).fill(c.email);
  if (c.phone !== undefined) {
    const phone = drawer.locator('input[type="tel"], .react-tel-input input').nth(idx);
    await phone.fill(c.phone);
  }
}

// ── API helpers (setup + cleanup; QA-prefixed, best-effort) ──────────────

export async function findAccountId(
  request: APIRequestContext,
  admin: AuthSession,
  name: string,
): Promise<string | null> {
  const apis = apiClients(request);
  const res = await apis.accountContact.as(admin).get('/api/clientaccounts/');
  if (!res.ok()) return null;
  const accounts = extractList<Record<string, any>>(await res.json());
  return (accounts.find((a) => a.accountName === name)?._id as string) ?? null;
}

/** Best-effort bulk delete of QA accounts (DELETE …/deleteMultipleAccounts {accountIds}). */
export async function deleteAccountsByName(
  request: APIRequestContext,
  admin: AuthSession,
  names: string[],
): Promise<void> {
  const ids: string[] = [];
  for (const n of names) {
    const id = await findAccountId(request, admin, n).catch(() => null);
    if (id) ids.push(id);
  }
  if (!ids.length) return;
  await request
    .delete(`${config.services.accountContact}/api/clientaccounts/accounts/deleteMultipleAccounts`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { accountIds: ids },
    })
    .catch(() => {});
}
