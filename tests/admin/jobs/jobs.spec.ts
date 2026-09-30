import { test, expect } from '../../../fixtures/auth.fixture';
import { Page } from '@playwright/test';
import { navSidebar } from '../../../helpers/adminNav';
import { firstAccountId, firstPipelineId, createJob, jobExists } from '../../../helpers/jobsData';

/**
 * Admin Jobs list — the actions the happy-path video never touched: single
 * delete (row menu) and bulk delete. Job *creation* is already exercised by
 * business-workflow, so these focus on the deletion gaps.
 *
 * Safety: every job here is QA_AUTO_-prefixed and created by the test itself;
 * we only ever select/delete those specific rows — never "select all", which
 * could catch real jobs. Created jobs are also registered for teardown.
 */
const RUN = Date.now().toString(36);

/** Click the confirm button in the app's confirm dialog (alertdialog or dialog). */
async function confirmDialog(page: Page): Promise<void> {
  const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
  await dialog.getByRole('button', { name: /^(delete|confirm|yes|ok)/i }).first().click();
}

test.describe('Admin — Jobs list actions @jobs @admin-ui', () => {
  // Describe-level timeout reliably covers both the adminPage UI-login fixture
  // setup and the body (real-UI login + staging latency exceed the 30s default).
  test.describe.configure({ timeout: 150_000 });

  test('deletes a job from the Jobs list via the row menu @happy', async ({
    adminPage,
    adminSession,
    request,
  }) => {
    const acct = await firstAccountId(request, adminSession);
    const pipeline = await firstPipelineId(request, adminSession);
    const jobName = `QA_AUTO_Job_del_${RUN}`;
    const jobId = await createJob(request, adminSession, jobName, acct.id, pipeline);

    await navSidebar(adminPage, 'Workflow', 'Jobs', /\/jobs\/activejob/);
    const table = adminPage.getByRole('table');
    const row = table.getByRole('row').filter({ hasText: jobName });
    await expect(row).toBeVisible({ timeout: 20_000 });

    // Open the row's action (⋮) menu — the trailing icon button in the row.
    await row.getByRole('button').last().click();
    await adminPage.getByRole('menuitem', { name: /delete/i }).click();
    await confirmDialog(adminPage);

    await expect(row).toHaveCount(0, { timeout: 15_000 });
    expect(
      await jobExists(request, adminSession, jobId),
      'job should be deleted server-side after UI delete',
    ).toBeFalsy();
  });

  test('bulk-deletes selected jobs from the Jobs list @bulk @happy', async ({
    adminPage,
    adminSession,
    request,
  }) => {
    const acct = await firstAccountId(request, adminSession);
    const pipeline = await firstPipelineId(request, adminSession);
    const nameA = `QA_AUTO_Job_bulkA_${RUN}`;
    const nameB = `QA_AUTO_Job_bulkB_${RUN}`;
    const idA = await createJob(request, adminSession, nameA, acct.id, pipeline);
    const idB = await createJob(request, adminSession, nameB, acct.id, pipeline);

    await navSidebar(adminPage, 'Workflow', 'Jobs', /\/jobs\/activejob/);
    const table = adminPage.getByRole('table');
    const rowA = table.getByRole('row').filter({ hasText: nameA });
    const rowB = table.getByRole('row').filter({ hasText: nameB });
    await expect(rowA).toBeVisible({ timeout: 20_000 });
    await expect(rowB).toBeVisible();

    // Select ONLY our two QA rows (never select-all).
    await rowA.getByRole('checkbox').check();
    await rowB.getByRole('checkbox').check();

    await adminPage
      .getByRole('button', { name: /delete selected|delete \(\d+\)|^delete$/i })
      .click();
    await confirmDialog(adminPage);

    await expect(rowA).toHaveCount(0, { timeout: 15_000 });
    await expect(rowB).toHaveCount(0);
    expect(await jobExists(request, adminSession, idA)).toBeFalsy();
    expect(await jobExists(request, adminSession, idB)).toBeFalsy();
  });
});
