import { Page, APIRequestContext } from '@playwright/test';
import { openQuickCreate } from './quickCreate';
import { apiClients, AuthSession } from './apiClient';
import { extractList } from './assertions';

/**
 * UI helpers for the Create Job drawer (opened via "+ → Jobs"). The drawer is
 * a custom side panel (not role=dialog). Controls (from live recon):
 *   Account   → the 2nd [role=combobox] (searchable multi-select of accounts)
 *   Pipeline  → text trigger "Select pipeline..." (searchable popover)
 *   Stage     → text trigger "Select stage..." (auto-selects first on pipeline pick)
 *   Job Name  → input placeholder "Enter job name"
 *   Save      → button "Save"
 */

export async function getFirstPipeline(
  request: APIRequestContext,
  admin: AuthSession,
): Promise<{ id: string; name: string }> {
  const apis = apiClients(request);
  const res = await apis.templates.as(admin).get('/temp/pipeline/pipelines');
  const list = extractList<Record<string, any>>(await res.json());
  const p = list[0];
  return { id: p._id as string, name: (p.pipelineName ?? p.name ?? p.title ?? '') as string };
}

/**
 * Create a pipeline OWNED BY (available to) the given admin, with 2 stages, so
 * it appears in the JobDrawer pipeline list (which filters by
 * `availableto: <userId>`). Returns { id, name }.
 */
export async function createUserPipeline(
  request: APIRequestContext,
  admin: AuthSession,
  name: string,
): Promise<{ id: string; name: string }> {
  const apis = apiClients(request);
  const res = await apis.templates.as(admin).post('/temp/pipeline/createpipeline', {
    pipelineName: name,
    availableto: [admin.userId],
    stages: [
      { name: 'To Do', automations: [] },
      { name: 'Done', automations: [] },
    ],
  });
  const body = await res.json().catch(() => ({}));
  const id = (body?.pipeline?._id ?? body?._id) as string;
  return { id, name };
}

export async function deleteUserPipeline(
  request: APIRequestContext,
  admin: AuthSession,
  id: string,
): Promise<void> {
  if (!id) return;
  const apis = apiClients(request);
  await apis.templates.as(admin).delete(`/temp/pipeline/pipeline/${id}`).catch(() => {});
}

export async function openJobDrawer(page: Page): Promise<void> {
  await openQuickCreate(page, 'Jobs');
  await page.getByPlaceholder('Enter job name').waitFor({ state: 'visible', timeout: 15_000 });
}

export async function selectJobAccount(page: Page, name: string): Promise<void> {
  await page.locator('[role=combobox]').nth(1).click();
  await page.waitForTimeout(300);
  await page.keyboard.type(name);
  await page.waitForTimeout(700);
  const opt = page.getByRole('option', { name }).first();
  if (await opt.isVisible().catch(() => false)) await opt.click();
  else await page.getByText(name, { exact: true }).first().click();
  await page.keyboard.press('Escape').catch(() => {});
}

/** Open the pipeline popover and pick the first pipeline (or one matching `name`). */
export async function selectJobPipeline(page: Page, name?: string): Promise<void> {
  await page.getByText('Select pipeline...', { exact: true }).click();
  await page.waitForTimeout(700);
  if (name) {
    await page.keyboard.type(name);
    await page.waitForTimeout(600);
  }
  const opt = name
    ? page.getByRole('option', { name }).first()
    : page.getByRole('option').first();
  await opt.waitFor({ state: 'visible', timeout: 8_000 });
  await opt.click();
}

/** If a stage wasn't auto-selected after picking a pipeline, pick the first. */
export async function ensureJobStage(page: Page): Promise<void> {
  // Give the stage list time to load after the pipeline pick (auto-selects
  // the first stage when it arrives). Bounded so we never hang on a disabled
  // trigger.
  await page.waitForTimeout(1200);
  const stageTrigger = page.getByText('Select stage...', { exact: true });
  if (await stageTrigger.isVisible().catch(() => false)) {
    await stageTrigger.click({ timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(400);
    const opt = page.getByRole('option').first();
    if (await opt.isVisible().catch(() => false)) await opt.click().catch(() => {});
  }
}

export async function findJobByName(
  request: APIRequestContext,
  admin: AuthSession,
  name: string,
): Promise<Record<string, any> | null> {
  const apis = apiClients(request);
  const res = await apis.jobs.as(admin).get('/workflow/jobs/jobs');
  if (!res.ok()) return null;
  const jobs = extractList<Record<string, any>>(await res.json());
  return jobs.find((j) => (j.jobname ?? j.jobName ?? j.name) === name) ?? null;
}
