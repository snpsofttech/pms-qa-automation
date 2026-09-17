import { test, expect } from '../../fixtures/auth.fixture';
import { DashboardPage } from '../../pages/admin/DashboardPage';
import { JobsPage } from '../../pages/admin/JobsPage';
import { qaName } from '../../fixtures/testData.fixture';
import { trackCreatedResource } from '../../helpers/cleanup';
import { config } from '../../helpers/config';
import { blockTest } from '../../helpers/triage';
import { extractList } from '../../helpers/assertions';

/**
 * Critical flow 1: Admin Login -> Dashboard -> Create Job -> Verify Job Exists.
 * Setup (finding an account + pipeline to attach the job to, then creating
 * it) goes through the API per Phase 8's guidance; only the verification
 * step drives the real UI, via the already-authenticated `adminPage`
 * fixture (real login through AdminLoginPage — see fixtures/auth.fixture.ts).
 */
test.describe('Critical flow 1 — Admin job creation', () => {
  test('creates a job via API and confirms it renders in the admin jobs list', async ({
    adminPage,
    apis,
    adminSession,
  }) => {
    const accountsRes = await apis.accountContact.as(adminSession).get('/api/clientaccounts/');
    expect(accountsRes.ok(), `could not list accounts: ${accountsRes.status()}`).toBeTruthy();
    const accounts = extractList<{ _id: string }>(await accountsRes.json());
    blockTest(test, accounts.length === 0, 'no accounts exist in this environment to attach a job to');

    const pipelinesRes = await apis.templates.as(adminSession).get('/temp/pipeline/pipelines');
    expect(pipelinesRes.ok(), `could not list pipelines: ${pipelinesRes.status()}`).toBeTruthy();
    // Response envelope is { message, pipeline: [...] } — extractList handles it.
    const pipelineList = extractList<{ _id: string }>(await pipelinesRes.json());
    blockTest(test, pipelineList.length === 0, 'no pipelines exist in this environment');

    const jobName = qaName('Job');
    const createRes = await apis.jobs.as(adminSession).post('/workflow/jobs/jobs', {
      accounts: [accounts[0]._id],
      pipeline: pipelineList[0]._id,
      jobname: jobName,
    });
    expect(createRes.ok(), `job creation failed: ${createRes.status()} ${await createRes.text()}`).toBeTruthy();

    // NOTE: createJob's exact success response shape wasn't confirmed
    // against the controller source during recon (only the request
    // contract was). This defensively handles the two most likely shapes;
    // if job cleanup ever silently no-ops, log the real response here once
    // and lock this down to the confirmed shape.
    const created = await createRes.json();
    const createdId: string | undefined = created?.data?.[0]?._id ?? created?._id ?? created?.job?._id;
    if (createdId) {
      trackCreatedResource('jobs', `${config.services.jobs}/workflow/jobs/jobs/${createdId}`);
    }

    const dashboard = new DashboardPage(adminPage);
    await dashboard.gotoJobsList();
    const jobsPage = new JobsPage(adminPage);
    await jobsPage.expectJobVisible(jobName);
  });
});
