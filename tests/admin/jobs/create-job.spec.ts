import { test, expect } from '../../../fixtures/auth.fixture';
import { request as pwRequest } from '@playwright/test';
import { navSidebar } from '../../../helpers/adminNav';
import { firstAccountId, createJob } from '../../../helpers/jobsData';
import { createUserPipeline, deleteUserPipeline } from '../../../helpers/jobDrawer';
import { loginAsAdmin } from '../../../helpers/apiClient';
import { config } from '../../../helpers/config';

/**
 * Create Job — P1 happy path. Per decision, job creation is exercised via the
 * proven API path and then VERIFIED in the Jobs list UI (the drawer's own
 * account/pipeline/stage widgets are covered by the later drag/drop + negative
 * pass). A pipeline is seeded for the QA admin (see jobDrawer.createUserPipeline).
 */
const RUN = Date.now().toString(36);
let seededPipeline = '';

test.beforeAll(async () => {
  const ctx = await pwRequest.newContext();
  const admin = await loginAsAdmin(ctx, config.qa.adminEmail, config.qa.adminPassword);
  seededPipeline = (await createUserPipeline(ctx, admin, `QA_AUTO_Pipeline_${RUN}`)).id;
  await ctx.dispose();
});

test.afterAll(async () => {
  const ctx = await pwRequest.newContext();
  const admin = await loginAsAdmin(ctx, config.qa.adminEmail, config.qa.adminPassword);
  await deleteUserPipeline(ctx, admin, seededPipeline);
  await ctx.dispose();
});

test.describe('Create Job @jobs @admin-ui', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Create Job (required fields) — created and rendered in Jobs list @happy', async ({
    adminPage,
    adminSession,
    request,
  }) => {
    const acct = await firstAccountId(request, adminSession);
    const jobName = `QA_AUTO_UIJob_${RUN}`;
    await createJob(request, adminSession, jobName, acct.id, seededPipeline);

    await navSidebar(adminPage, 'Workflow', 'Jobs', /\/jobs\/activejob/);
    await expect(adminPage.getByRole('table').getByText(jobName)).toBeVisible({ timeout: 20_000 });
  });
});
