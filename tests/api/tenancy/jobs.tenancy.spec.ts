import { test, expect } from '../../../fixtures/tenant.fixture';
import { expectAuthorizationFailure, extractList } from '../../../helpers/assertions';
import { blockTest } from '../../../helpers/triage';

/**
 * jobs-backend scopes every query by req.user.tenantId (Controller/
 * jobController.js getTenantFilter helper) — this test proves that holds
 * for direct object access, not just list endpoints. Uses whatever job(s)
 * already exist for Tenant B rather than fabricating one, per the "do not
 * fabricate IDs" rule; skips (not fails) if Tenant B currently has no jobs,
 * since that's an environment-data gap, not a product bug.
 */
test.describe('Tenant isolation — jobs', () => {
  test('Tenant A admin cannot fetch a job that belongs to Tenant B', async ({ apis, tenantA, tenantB }) => {
    const tenantBJobs = await apis.jobs.as(tenantB.admin).get('/workflow/jobs/jobs?limit=1');
    expect(tenantBJobs.ok(), `could not list Tenant B jobs: ${tenantBJobs.status()}`).toBeTruthy();
    const data = extractList<{ _id: string }>(await tenantBJobs.json());
    blockTest(test, data.length === 0, 'Tenant B has no jobs to test against in this environment');

    const targetJobId = data[0]._id;

    const crossTenantRead = await apis.jobs.as(tenantA.admin).get(`/workflow/jobs/jobs/${targetJobId}`);
    await expectAuthorizationFailure(crossTenantRead);
  });

  test('Tenant A admin cannot delete a job that belongs to Tenant B', async ({ apis, tenantA, tenantB }) => {
    const tenantBJobs = await apis.jobs.as(tenantB.admin).get('/workflow/jobs/jobs?limit=1');
    const data = extractList<{ _id: string }>(await tenantBJobs.json());
    blockTest(test, data.length === 0, 'Tenant B has no jobs to test against in this environment');

    const targetJobId = data[0]._id;

    const crossTenantDelete = await apis.jobs.as(tenantA.admin).delete(`/workflow/jobs/jobs/${targetJobId}`);
    await expectAuthorizationFailure(crossTenantDelete);

    // Confirm it's still there afterwards, since a 404 alone doesn't prove
    // the delete was blocked rather than silently no-op'd on a missing id.
    const stillExists = await apis.jobs.as(tenantB.admin).get(`/workflow/jobs/jobs/${targetJobId}`);
    expect(stillExists.ok(), 'job disappeared — the cross-tenant delete attempt may have actually succeeded').toBeTruthy();
  });
});
