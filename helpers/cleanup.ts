import fs from 'fs';
import path from 'path';
import { APIRequestContext } from '@playwright/test';
import { assertNotProduction } from './config';

/**
 * Every QA-created record should be named/tagged with this prefix (see
 * fixtures/testData.fixture.ts) so cleanup never touches real customer data
 * and a human can visually confirm a record is QA-owned before deleting it
 * by hand if automated cleanup is ever skipped.
 */
export const QA_PREFIX = 'QA_AUTO_';

interface CreatedResource {
  service: keyof typeof deleteHandlers;
  path: string; // full delete URL
}

const registryPath = path.resolve(__dirname, '..', 'qa-data', 'created-resources.json');

function readRegistry(): CreatedResource[] {
  if (!fs.existsSync(registryPath)) return [];
  return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
}

function writeRegistry(entries: CreatedResource[]): void {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, JSON.stringify(entries, null, 2));
}

const deleteHandlers = {
  jobs: true,
  invoices: true,
  proposals: true,
  documents: true,
  contacts: true,
} as const;

/**
 * Call this immediately after a test creates a QA resource via the API, so
 * teardown can remove it even if the test fails partway through. `deleteUrl`
 * must be the exact DELETE endpoint for that resource.
 */
export function trackCreatedResource(service: keyof typeof deleteHandlers, deleteUrl: string): void {
  assertNotProduction('trackCreatedResource (implies a destructive create happened)');
  const entries = readRegistry();
  entries.push({ service, path: deleteUrl });
  writeRegistry(entries);
}

/**
 * Deletes every resource tracked via trackCreatedResource during this run.
 * Intended to be called from scripts/globalTeardown.ts. Never touches
 * anything not explicitly tracked, and refuses to run in production.
 */
export async function cleanupTrackedResources(request: APIRequestContext, authHeader: string): Promise<void> {
  assertNotProduction('cleanupTrackedResources');
  const entries = readRegistry();
  const failures: string[] = [];

  for (const entry of entries) {
    const response = await request.delete(entry.path, {
      headers: { Authorization: authHeader },
    });
    if (!response.ok() && response.status() !== 404) {
      failures.push(`${entry.service} ${entry.path} -> ${response.status()}`);
    }
  }

  writeRegistry([]);

  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`cleanupTrackedResources: ${failures.length} deletions failed:\n${failures.join('\n')}`);
  }
}
