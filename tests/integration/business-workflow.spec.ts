import { test, expect } from '@playwright/test';
import { config } from '../../helpers/config';
import { apiClients, loginAsAdmin } from '../../helpers/apiClient';
import { extractList } from '../../helpers/assertions';
import { AdminLoginPage } from '../../pages/admin/LoginPage';
import type { Page } from '@playwright/test';
import {
  setupPendingApproval,
  cleanupPendingApproval,
  getApprovalStatus,
  PendingApproval,
} from '../../helpers/documentApproval';

/**
 * Sidebar groups (Clients, Workflow, …) are expandable; their leaves start
 * expanded but a stray click on the parent collapses them. So expand the
 * parent only when the leaf isn't already actionable, then click the leaf.
 */
async function navSidebar(page: Page, parent: string, leaf: string, urlRe: RegExp): Promise<void> {
  // The sidebar is backend-driven (GET /api/sidebar) and settles slowly; a
  // leaf can be in the DOM but clipped to ~0 height until the group is fully
  // laid out (or expanded). Poll on the REAL rendered height as the
  // actionability signal, expanding the parent once if it stays clipped.
  const parentBtn = page.getByRole('button', { name: parent, exact: true });
  const leafBtn = page.getByRole('button', { name: leaf, exact: true });
  await parentBtn.waitFor({ state: 'visible', timeout: 20_000 });

  const navigated = () => page.waitForURL(urlRe, { timeout: 5_000 }).then(() => true).catch(() => false);

  // 1) If the group is already open (e.g. a second nav within the same group),
  //    a direct leaf click navigates — and we must NOT click the parent, which
  //    would collapse the open group.
  const box = await leafBtn.boundingBox().catch(() => null);
  if (box && box.height > 10) {
    await leafBtn.click({ force: true, timeout: 5_000 }).catch(() => {});
    if (await navigated()) return;
  }

  // 2) Otherwise (or if the direct click didn't land) expand the group by
  //    clicking the parent, then click the leaf.
  await parentBtn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1_000);
  try {
    await leafBtn.click({ timeout: 8_000 });
  } catch {
    await leafBtn.scrollIntoViewIfNeeded().catch(() => {});
    await leafBtn.click({ force: true, timeout: 5_000 });
  }
  await expect(page).toHaveURL(urlRe, { timeout: 15_000 });
}

/**
 * End-to-end business workflow, recorded as one continuous journey for the
 * demo video. Drives the REAL UI throughout; the only non-UI step is reading
 * the contact's activation token over the API, because tenant-scoped
 * activation emails don't send on staging (intended notification policy),
 * so the token can't arrive by email.
 *
 * Journey (admin creation via UI+API, client actions via UI):
 *   1.  Admin logs in
 *   2.  Navigate to Accounts (sidebar; admin token is in-memory so nav must
 *       be click-based, never page.goto to a deep link)
 *   3.  Create an account with a contact (2-step drawer wizard)
 *   4.  Grant the contact portal login (bulk Settings → Login)
 *   5.  Create a job (API) → verify in the Jobs list (UI)
 *   6.  Create an invoice (API) → view in Billing → Invoices (UI)
 *   7.  Create a proposal (API) → view in Billing → Proposals (UI)
 *   8.  Assign an organizer to the account (API)
 *   8b. Send a document for approval (API setup)
 *   9.  [bridge] read the contact's activation token (API — email can't send)
 *   10. Client sets their password (activation page)
 *   11. Client logs into the portal
 *   12. Client signs the proposal (first-party signature pad — "Type" mode)
 *   13. Client views their invoice (Billing)
 *   14. Client completes the organizer
 *   15. Client approves the document → status flips to "approved"
 *
 * NOT covered (genuinely un-automatable): document e-signature (DocuSeal is a
 * cross-origin iframe), invoice payment (real transaction), and signup+OTP
 * (needs an inbox read — see the separate signup segment).
 *
 * Record: VIDEO=on SLOWMO=350 TEST_ENV=staging npx playwright test \
 *   tests/integration/business-workflow.spec.ts --project=integration
 */

const RUN = Date.now().toString(36);
const ACCOUNT_NAME = `QA_AUTO_Acct_${RUN}`;
const COMPANY_NAME = `QA_AUTO_Company_${RUN}`;
const CONTACT_FIRST = 'QA';
const CONTACT_LAST = `Client_${RUN}`;
const CONTACT_EMAIL = `vardhan.kulkarni18+qa.wf.${RUN}@gmail.com`;
const NEW_PASSWORD = `QAauto-${RUN}-Cc3!`;
const QA_TAG = 'QA_AUTO_Tag';
const ADDRESS = { street: '123 QA Street', city: 'QA City', state: 'California', zip: '90001', country: 'United States' };

test.describe('Business workflow — client onboarding end to end', () => {
  test.setTimeout(300_000);

  test('admin onboards a client through the UI; client activates and signs in', async ({ page, request }) => {
    const admin = new AdminLoginPage(page);

    // A visible "beat" between steps so a recorded run is easy to follow.
    // Tune/disable via STEP_PAUSE (ms); defaults to a short pause.
    const beat = () => page.waitForTimeout(Number(process.env.STEP_PAUSE ?? 1800));

    // Prerequisite: ensure a QA tag exists so the account form can assign it.
    const setupSession = await loginAsAdmin(request, config.qa.adminEmail, config.qa.adminPassword);
    await apiClients(request)
      .templates.as(setupSession)
      .post('/temp/tags', { tagName: QA_TAG, tagColour: '#2f7d55' })
      .catch(() => undefined); // idempotent — ignore "already exists"

    await test.step('1. Admin logs in', async () => {
      await admin.goto();
      await admin.loginAs(config.qa.adminEmail, config.qa.adminPassword);
      await admin.expectLoggedIn(); // lands on /insights
    });

    await test.step('2. Navigate to Accounts (sidebar)', async () => {
      await navSidebar(page, 'Clients', 'Accounts', /activeaccounts/);
    });

    await test.step('3. Create a Company account (contract details + tag) with a contact', async () => {
      await page.getByRole('button', { name: 'Add Account' }).click();
      const drawer = page.getByRole('dialog');
      await expect(drawer.getByText('Create Account')).toBeVisible();

      // Step 1 — Company account info + contract details
      await drawer.getByRole('radio', { name: 'Company' }).check();
      await drawer.getByPlaceholder('Enter account name').fill(ACCOUNT_NAME);
      await drawer.getByPlaceholder('Enter company name').fill(COMPANY_NAME);

      // Country is a native <select> (the one carrying the "Select Country" option).
      const countrySelect = drawer
        .locator('select')
        .filter({ has: page.locator('option', { hasText: 'Select Country' }) })
        .first();
      await countrySelect.selectOption({ label: ADDRESS.country });

      // Business address / contract details
      await drawer.getByPlaceholder('Street address').fill(ADDRESS.street);
      await drawer.getByPlaceholder('City').fill(ADDRESS.city);
      await drawer.getByPlaceholder('State').fill(ADDRESS.state);
      await drawer.getByPlaceholder('ZIP Code').fill(ADDRESS.zip);

      // Tag assignment (default react-select isMulti). The placeholder has
      // pointer-events:none, so click the control container (its "control"
      // ancestor), then type to filter and Enter to select the focused option.
      const tagsControl = drawer
        .getByText('Select tags')
        .locator('xpath=ancestor::div[contains(@class,"control")][1]');
      await tagsControl.click({ timeout: 10_000 });
      await page.keyboard.type(QA_TAG);
      await page.waitForTimeout(800); // let the option list filter
      await page.keyboard.press('Enter');
      // The selected tag renders as a chip (exact text) — react-select's
      // aria-live log also contains the name, so match exactly.
      await expect(drawer.getByText(QA_TAG, { exact: true })).toBeVisible({ timeout: 10_000 });

      await drawer.getByRole('button', { name: 'Continue' }).click();

      // Step 2 — add one contact, then submit
      await drawer.getByRole('button', { name: 'Add Contact' }).click();
      await drawer.getByPlaceholder('First Name').first().fill(CONTACT_FIRST);
      await drawer.getByPlaceholder('Last Name').first().fill(CONTACT_LAST);
      await drawer.getByPlaceholder('Email').first().fill(CONTACT_EMAIL);
      await drawer.getByRole('button', { name: 'Submit' }).click();

      await expect(page.getByText('Account saved successfully!')).toBeVisible({ timeout: 20_000 });
      await beat();
    });

    await test.step('4. Grant the contact portal login (Settings → Login)', async () => {
      const row = page.getByRole('row', { name: new RegExp(ACCOUNT_NAME) });
      await row.getByRole('checkbox').check();
      // "Settings" also exists in the sidebar (aside); target the bulk-action
      // bar's Settings — the one that is NOT inside the sidebar.
      const bulkSettings = page
        .getByRole('button', { name: 'Settings', exact: true })
        .and(page.locator(':not(aside *)'));
      await bulkSettings.click();
      await expect(page.getByText('Edit Login, Notify and Email Sync')).toBeVisible();
      // The page also has pagination/filter selects; the Login/Notify/EmailSync
      // selects are the ones carrying an "Assign to all" option. Login is the
      // first of those three.
      const loginSelect = page
        .locator('select')
        .filter({ has: page.locator('option', { hasText: 'Assign to all' }) })
        .first();
      await loginSelect.selectOption({ label: 'Assign to all' });
      await page.getByRole('button', { name: 'Save' }).click();

      // Save grants portal login and mints the activation token server-side.
      // The drawer may stay open because the activation-email send fails on
      // staging (intended notification policy: tenant Gmail not connected) —
      // that's cosmetic; the token is minted regardless (asserted in step 6).
      // Close the drawer so navigation can continue.
      await page.waitForTimeout(3_000);
      const drawerHeading = page.getByRole('heading', { name: 'Edit Login, Notify and Email Sync' });
      if (await drawerHeading.isVisible().catch(() => false)) {
        await page.keyboard.press('Escape').catch(() => {});
        for (const name of ['Cancel', 'Close', 'Done']) {
          const btn = page.getByRole('button', { name, exact: true });
          if (await btn.isVisible().catch(() => false)) {
            await btn.click().catch(() => {});
            break;
          }
        }
      }
      await expect(drawerHeading).toBeHidden({ timeout: 10_000 });
    });

    // Resolve the created account + contact ids over the API for the job and
    // the activation-token bridge.
    const adminSession = await loginAsAdmin(request, config.qa.adminEmail, config.qa.adminPassword);
    const apis = apiClients(request);

    const accountId = await test.step('3b. Verify the created Company account data (API)', async () => {
      const res = await apis.accountContact.as(adminSession).get('/api/clientaccounts/');
      const accounts = extractList<Record<string, any>>(await res.json());
      const acct = accounts.find((a) => a.accountName === ACCOUNT_NAME);
      expect(acct, `created account ${ACCOUNT_NAME} not found via API`).toBeTruthy();
      // Verify the Company fields, contract details and tag were persisted.
      expect(acct!.clientType, 'account should be a Company').toBe('Company');
      expect(acct!.companyName, 'company name should be saved').toBe(COMPANY_NAME);
      expect(String(acct!.streetAddress ?? ''), 'street address should be saved').toContain(ADDRESS.street);
      expect((acct!.tags ?? []).length, 'a tag should be assigned to the account').toBeGreaterThan(0);
      return acct!._id as string;
    });

    await test.step('5. Create a job (API) and verify it in the Jobs list (UI)', async () => {
      const pipelinesRes = await apis.templates.as(adminSession).get('/temp/pipeline/pipelines');
      const pipelines = extractList<{ _id: string }>(await pipelinesRes.json());
      expect(pipelines.length, 'no pipeline available for job creation').toBeGreaterThan(0);

      const jobName = `QA_AUTO_Job_${RUN}`;
      const createRes = await apis.jobs.as(adminSession).post('/workflow/jobs/jobs', {
        accounts: [accountId],
        pipeline: pipelines[0]._id,
        jobname: jobName,
      });
      expect(createRes.ok(), `job creation failed: ${createRes.status()} ${await createRes.text()}`).toBeTruthy();

      // Navigate to the Jobs list (nested under the "Workflow" group).
      await navSidebar(page, 'Workflow', 'Jobs', /\/jobs\/activejob/);
      // The list is a native table, not a DataGrid.
      await expect(page.getByRole('table').getByText(jobName)).toBeVisible({ timeout: 20_000 });
      await beat();
    });

    await test.step('6. Create an invoice (API) and view it in Billing → Invoices (UI)', async () => {
      const createRes = await apis.invoice.as(adminSession).post('/account/invoicelist/invoice', {
        account: accountId,
        invoiceLabel: `QA_AUTO_Invoice_${RUN}`,
        invoicedate: new Date().toISOString(),
        lineItems: [],
        summary: {},
        active: true,
      });
      // Decoupled from Gmail — this now succeeds even without a connected mailbox.
      expect(
        createRes.status(),
        `invoice creation failed: ${createRes.status()} ${await createRes.text()}`,
      ).toBe(201);

      await navSidebar(page, 'Billing', 'Invoices', /\/billing\/[Ii]nvoices/);
      await expect(page.getByRole('table')).toBeVisible({ timeout: 20_000 });
    });

    await test.step('7. Create a proposal (API) and view it in Billing → Proposals (UI)', async () => {
      const createRes = await apis.proposal.as(adminSession).post('/account/proposals/', {
        general: { account: accountId, proposalName: `QA_AUTO_Proposal_${RUN}` },
        status: 'Pending',
      });
      expect(
        createRes.status(),
        `proposal creation failed: ${createRes.status()} ${await createRes.text()}`,
      ).toBe(201);

      await navSidebar(page, 'Billing', 'Proposals&Els', /proposalsandels/);
      await expect(page.getByRole('table')).toBeVisible({ timeout: 20_000 });
    });

    await test.step('8. Assign an organizer to the account (API)', async () => {
      // A QA organizer template is seeded once (QA_AUTO_Organizer_Template).
      const tplRes = await apis.organizer.as(adminSession).get('/api/organizertemp/organizertemplate');
      const tplBody = await tplRes.json();
      const templates = (tplBody?.OrganizerTemplates ?? tplBody?.data ?? []) as Array<{ _id: string; templatename?: string }>;
      const tpl = templates.find((t) => t.templatename === 'QA_AUTO_Organizer_Template') ?? templates[0];
      expect(tpl?._id, 'no organizer template found (seed QA_AUTO_Organizer_Template)').toBeTruthy();

      const res = await apis.organizer.as(adminSession).post('/api/orgaccwise/organizeraccountwise/org', {
        organizertemplateid: tpl!._id,
        accountid: [accountId],
        organizerName: 'QA Automation Organizer',
        status: 'Pending',
      });
      expect(res.status(), `organizer assignment failed: ${res.status()} ${await res.text()}`).toBe(201);
    });

    let pendingApproval: PendingApproval | undefined; // client will APPROVE this one
    let pendingApprovalB: PendingApproval | undefined; // client will DISAPPROVE this one
    await test.step('8b. Send two documents for approval (API setup)', async () => {
      pendingApproval = await setupPendingApproval(request, adminSession.token, accountId, CONTACT_EMAIL, `${RUN}a`);
      pendingApprovalB = await setupPendingApproval(request, adminSession.token, accountId, CONTACT_EMAIL, `${RUN}b`);
    });

    const activationToken = await test.step('9. [bridge] read the activation token (API)', async () => {
      const res = await apis.accountContact.as(adminSession).get('/api/contacts/');
      const contacts = extractList<{ _id: string; email?: string }>(await res.json());
      const contact = contacts.find((c) => c.email === CONTACT_EMAIL);
      expect(contact, `contact ${CONTACT_EMAIL} not found via API`).toBeTruthy();

      const detailRes = await apis.accountContact.as(adminSession).get(`/api/contacts/contact/${contact!._id}`);
      const body = await detailRes.json();
      const token = (body?.data ?? body)?.activationToken as string | undefined;
      expect(token, 'no activation token present on the contact (was portal login enabled?)').toBeTruthy();
      return token!;
    });

    await test.step('10. Client sets their password (activation page)', async () => {
      await page.goto(`${config.client.baseURL}/updatepassword/${activationToken}`);
      await page.getByPlaceholder('Enter new password').fill(NEW_PASSWORD);
      await page.getByPlaceholder('Confirm new password').fill(NEW_PASSWORD);
      await page.getByRole('button', { name: 'Set Password' }).click();
      await expect(page.getByText(/Password set successfully/i)).toBeVisible({ timeout: 20_000 });
    });

    await test.step('11. Client logs into the portal', async () => {
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
      await page.locator('input[type="email"]').fill(CONTACT_EMAIL);
      await page.locator('input[type="password"]').fill(NEW_PASSWORD);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/\/home/, { timeout: 20_000 });
      await expect(page.getByText("Here's what needs your attention today.")).toBeVisible({ timeout: 20_000 });
      await beat();
    });

    // The client app keeps its session in sessionStorage (survives reload),
    // so client-side navigation can use page.goto directly.
    await test.step('12. Client signs the proposal (Type signature)', async () => {
      await page.goto(`${config.client.baseURL}/proposalsels`);
      await expect(page.getByRole('heading', { name: 'Proposals & ELs' })).toBeVisible({ timeout: 20_000 });
      await page.getByText(`QA_AUTO_Proposal_${RUN}`).first().click();

      // Reach the signature section inside the proposal dialog if it's a step.
      const signNav = page.getByRole('button', { name: 'Sign & Accept' });
      if (await signNav.isVisible().catch(() => false)) await signNav.click();

      // "Type" mode avoids drawing on the canvas.
      await page.getByRole('button', { name: 'Type', exact: true }).click();
      await page.getByPlaceholder('Type your full name').fill('QA Client Signature');
      await page.getByText('I accept the Terms & Conditions').click();
      await page.getByRole('button', { name: 'Complete Proposal' }).click();
      await expect(page.getByText(/Proposal signed successfully/i)).toBeVisible({ timeout: 20_000 });
      await beat();
    });

    await test.step('13. Client views their invoice in Billing', async () => {
      await page.goto(`${config.client.baseURL}/billing/invoices`);
      await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('table')).toBeVisible({ timeout: 20_000 });
    });

    await test.step('14. Client completes the organizer', async () => {
      await page.goto(`${config.client.baseURL}/organizers`);
      await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible({ timeout: 20_000 });
      // Open the organizer assigned to this account (name may render as the
      // template name or fall back to "Untitled").
      await page.getByText('QA Automation Organizer').or(page.getByText('Untitled')).first().click();

      // The template has one optional Free Entry field; fill it if present.
      const freeEntry = page.getByPlaceholder('Free Entry Answer').first();
      if (await freeEntry.isVisible().catch(() => false)) {
        await freeEntry.fill('QA automated answer');
      }
      // Advance through any sections, then submit.
      for (let i = 0; i < 3; i++) {
        const next = page.getByRole('button', { name: 'Next', exact: true });
        if (await next.isVisible().catch(() => false)) await next.click().catch(() => {});
        else break;
      }
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(page.getByText(/Organizer completed and sealed successfully/i)).toBeVisible({ timeout: 20_000 });
      await beat();
    });

    await test.step('15. Client approves the document, and the status flips to approved', async () => {
      // Approval success is signalled via native window.alert — auto-accept.
      page.on('dialog', (d) => d.accept().catch(() => {}));
      await page.goto(`${config.client.baseURL}/home`);

      const item = page
        .locator('div', { hasText: pendingApproval!.filename })
        .filter({ has: page.getByText(/Pending Approval/i) })
        .last();
      await expect(item).toBeVisible({ timeout: 20_000 });
      await item.click();
      await page.getByRole('button', { name: 'Approve Document' }).click();

      await expect
        .poll(() => getApprovalStatus(request, adminSession.token, pendingApproval!.approvalId), { timeout: 15_000 })
        .toBe('approved');
      await beat();
    });

    await test.step('16. Client disapproves the second document (with a reason)', async () => {
      await page.goto(`${config.client.baseURL}/home`);
      const item = page
        .locator('div', { hasText: pendingApprovalB!.filename })
        .filter({ has: page.getByText(/Pending Approval/i) })
        .last();
      await expect(item).toBeVisible({ timeout: 20_000 });
      await item.click();

      await page.getByRole('button', { name: 'Disapprove', exact: true }).click();
      // "Cancel Approval" modal → reason → Submit.
      await page.getByPlaceholder('Enter rejection reason...').fill('QA automated disapproval: document needs revision.');
      await page.getByRole('button', { name: 'Submit', exact: true }).click();

      await expect
        .poll(() => getApprovalStatus(request, adminSession.token, pendingApprovalB!.approvalId), { timeout: 15_000 })
        .toBe('cancelled');
      await beat();
    });

    // Best-effort cleanup of the approval documents created for this run.
    if (pendingApproval) await cleanupPendingApproval(request, adminSession.token, pendingApproval);
    if (pendingApprovalB) await cleanupPendingApproval(request, adminSession.token, pendingApprovalB);
  });
});
