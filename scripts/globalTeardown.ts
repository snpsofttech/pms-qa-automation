import { request as playwrightRequest } from '@playwright/test';
import { config } from '../helpers/config';
import { loginAsAdmin } from '../helpers/apiClient';
import { cleanupTrackedResources } from '../helpers/cleanup';

/**
 * Runs once after the whole suite. Deletes every resource tests registered
 * via helpers/cleanup.trackCreatedResource during the run. Never runs
 * against production (cleanupTrackedResources enforces this itself too).
 */
export default async function globalTeardown(): Promise<void> {
  if (config.isProduction) return;

  const apiRequest = await playwrightRequest.newContext();
  try {
    const session = await loginAsAdmin(apiRequest, config.qa.adminEmail, config.qa.adminPassword);
    await cleanupTrackedResources(apiRequest, `Bearer ${session.token}`);
  } finally {
    await apiRequest.dispose();
  }
}
