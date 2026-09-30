import { APIRequestContext, expect } from '@playwright/test';
import { apiClients, AuthSession } from './apiClient';
import { extractList } from './assertions';
import { trackCreatedResource } from './cleanup';
import { config } from './config';

/**
 * API setup helpers for job UI tests. Jobs are created over the API (fast,
 * and job *creation* is already covered by the business-workflow spec) so the
 * UI specs can focus on the un-covered actions — delete, bulk delete, edit,
 * stage move. Everything is QA_AUTO_-prefixed and registered for teardown.
 *
 * Endpoints (jobs-backend, router mounted at /workflow/jobs):
 *   POST   /workflow/jobs/jobs           create
 *   GET    /workflow/jobs/jobs           list (tenant-scoped)
 *   DELETE /workflow/jobs/jobs/:id       delete
 *   PATCH  /workflow/jobs/jobs/:id/stage move stage
 */

export async function firstAccountId(
  request: APIRequestContext,
  admin: AuthSession,
): Promise<{ id: string; name: string }> {
  const apis = apiClients(request);
  const res = await apis.accountContact.as(admin).get('/api/clientaccounts/');
  expect(res.ok(), `could not list accounts: ${res.status()}`).toBeTruthy();
  const accounts = extractList<Record<string, any>>(await res.json());
  expect(accounts.length, 'no accounts available to attach a job to').toBeGreaterThan(0);
  // Prefer a QA-owned account so nothing here touches real customer data.
  const qa = accounts.find((a) => String(a.accountName ?? '').startsWith('QA_AUTO_'));
  const acct = qa ?? accounts[0];
  return { id: acct._id as string, name: (acct.accountName ?? acct.companyName ?? '') as string };
}

export async function firstPipelineId(
  request: APIRequestContext,
  admin: AuthSession,
): Promise<string> {
  const apis = apiClients(request);
  const res = await apis.templates.as(admin).get('/temp/pipeline/pipelines');
  expect(res.ok(), `could not list pipelines: ${res.status()}`).toBeTruthy();
  const pipelines = extractList<{ _id: string }>(await res.json());
  expect(pipelines.length, 'no pipeline available for job creation').toBeGreaterThan(0);
  return pipelines[0]._id;
}

function extractId(json: any): string | null {
  return (
    json?._id ?? json?.job?._id ?? json?.data?._id ?? json?.jobs?.[0]?._id ?? json?.result?._id ?? null
  );
}

/** Create a job via the API and return its id (registered for teardown). */
export async function createJob(
  request: APIRequestContext,
  admin: AuthSession,
  jobName: string,
  accountId: string,
  pipeline: string,
): Promise<string> {
  const apis = apiClients(request);
  const res = await apis.jobs.as(admin).post('/workflow/jobs/jobs', {
    accounts: [accountId],
    pipeline,
    jobname: jobName,
  });
  expect(res.ok(), `job creation failed: ${res.status()} ${await res.text()}`).toBeTruthy();

  let id = extractId(await res.json().catch(() => ({})));
  if (!id) {
    // Fall back to finding it by name in the tenant-scoped list.
    const list = await apis.jobs.as(admin).get('/workflow/jobs/jobs');
    const jobs = extractList<Record<string, any>>(await list.json());
    id = (jobs.find((j) => (j.jobname ?? j.jobName ?? j.name) === jobName)?._id as string) ?? null;
  }
  expect(id, `could not determine created job id for ${jobName}`).toBeTruthy();
  trackCreatedResource('jobs', `${config.services.jobs}/workflow/jobs/jobs/${id}`);
  return id as string;
}

/** True if the job still exists in the tenant-scoped list. */
export async function jobExists(
  request: APIRequestContext,
  admin: AuthSession,
  jobId: string,
): Promise<boolean> {
  const apis = apiClients(request);
  const res = await apis.jobs.as(admin).get(`/workflow/jobs/jobs/${jobId}`);
  return res.status() === 200;
}
