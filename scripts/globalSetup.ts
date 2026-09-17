import fs from 'fs';
import path from 'path';
import { request as playwrightRequest } from '@playwright/test';
import { config } from '../helpers/config';
import { loginAsAdmin, loginAsClient } from '../helpers/apiClient';

/**
 * Runs once before the whole suite.
 *
 * IMPORTANT constraint discovered during architecture inspection (see
 * ARCHITECTURE.md): neither app's session is a clean fit for Playwright's
 * built-in `storageState` (cookies + localStorage only):
 *   - admin app keeps its access token in an in-memory JS variable and its
 *     refresh token in an httpOnly cookie marked `Secure` — that cookie is
 *     only ever sent by the browser over HTTPS, so storageState reuse only
 *     works against staging/production, never plain http://localhost.
 *   - client app keeps its session in `sessionStorage`, which Playwright's
 *     storageState does NOT capture at all (by design — it's cookies and
 *     localStorage only).
 *
 * So this setup does NOT try to fake a universal storageState solution.
 * Instead:
 *   1. It fails the whole run fast, with one clear error, if the QA
 *      credentials themselves are wrong — instead of every test in the
 *      suite failing individually with a confusing login timeout.
 *   2. Individual tests get their authenticated Page via the `adminPage` /
 *      `clientPage` fixtures (real UI login, always works) or the fast API
 *      + sessionStorage-seed path (`clientPageFast`, client app only).
 */
export default async function globalSetup(): Promise<void> {
  fs.mkdirSync(path.resolve(__dirname, '..', '.auth'), { recursive: true });
  fs.mkdirSync(path.resolve(__dirname, '..', 'qa-data'), { recursive: true });

  const apiRequest = await playwrightRequest.newContext();
  try {
    const checks: Array<Promise<unknown>> = [
      loginAsAdmin(apiRequest, config.qa.adminEmail, config.qa.adminPassword),
    ];
    if (config.qa.clientEmail && config.qa.clientPassword) {
      checks.push(
        loginAsClient(apiRequest, config.qa.clientEmail, config.qa.clientPassword, config.qa.clientAccountId),
      );
    }
    if (config.qa.adminBEmail && config.qa.adminBPassword) {
      checks.push(loginAsAdmin(apiRequest, config.qa.adminBEmail, config.qa.adminBPassword));
    }
    if (config.qa.clientBEmail && config.qa.clientBPassword) {
      checks.push(
        loginAsClient(apiRequest, config.qa.clientBEmail, config.qa.clientBPassword, config.qa.clientBAccountId),
      );
    }

    const results = await Promise.allSettled(checks);
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failures.length > 0) {
      const message = failures.map((f) => f.reason?.message ?? String(f.reason)).join('\n');
      throw new Error(`globalSetup: one or more QA identities failed to log in:\n${message}`);
    }
  } finally {
    await apiRequest.dispose();
  }
}
