import { APIResponse, expect } from '@playwright/test';

/** Asserts a 2xx response and returns the parsed JSON body. */
export async function expectSuccess<T = unknown>(response: APIResponse): Promise<T> {
  if (!response.ok()) {
    const body = await response.text().catch(() => '<unreadable body>');
    throw new Error(
      `Expected a successful response but got ${response.status()} ${response.url()}\n${body}`,
    );
  }
  return response.json() as Promise<T>;
}

/** Asserts the request was rejected for lack of authentication (401). */
export async function expectUnauthorized(response: APIResponse): Promise<void> {
  expect(
    response.status(),
    `Expected 401 Unauthorized from ${response.url()}, got ${response.status()}`,
  ).toBe(401);
}

/**
 * Asserts the request was rejected because the caller isn't allowed to see
 * this resource. Some services in this codebase return 403, others return
 * 404 (to avoid confirming the resource exists) — both count as "isolated"
 * for tenant-boundary tests; callers that need to distinguish should check
 * response.status() directly instead of using this helper.
 */
export async function expectAuthorizationFailure(response: APIResponse): Promise<void> {
  expect(
    [401, 403, 404],
    `Expected an authorization failure (401/403/404) from ${response.url()}, got ${response.status()}`,
  ).toContain(response.status());
}

/**
 * Normalizes a list response into a plain array.
 *
 * List endpoints in this platform are not consistent about their envelope —
 * verified against staging 2026-09-10:
 *   GET /api/clientaccounts/     -> [ ... ]                    (bare array)
 *   GET /api/contacts/           -> [ ... ]                    (bare array)
 *   GET /workflow/jobs/jobs      -> { jobList: [ ... ] }
 *   GET /temp/pipeline/pipelines -> { message, pipeline: [...] }
 *
 * Assuming one shape caused a real QA defect: tenancy specs read `.data`,
 * got undefined, and SKIPPED as "no test data in this environment" — quietly
 * stepping over a confirmed P0 cross-tenant leak. Tests must fail or report,
 * never silently skip because of a parsing assumption. Hence this helper:
 * known keys first, then any array-valued property, then empty.
 */
export function extractList<T = Record<string, unknown>>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    for (const key of ['data', 'jobList', 'pipeline', 'items', 'results', 'contacts', 'accounts']) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
    const firstArray = Object.values(record).find((v) => Array.isArray(v));
    if (firstArray) return firstArray as T[];
  }
  return [];
}

/**
 * Recursively reports whether `key` appears anywhere in a parsed response.
 *
 * Needed because response envelopes are inconsistent: `GET /api/contacts/`
 * returns a bare array while `GET /api/contacts/contact/:id` returns
 * `{ success, data: {...} }`. A top-level-only check produced a false
 * NEGATIVE on the password-exposure test — it reported clean while the hash
 * sat one level down in `data`. Checking parsed keys (rather than grepping
 * raw text) also avoids false POSITIVES from a field's string value.
 */
export function hasKeyDeep(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((v) => hasKeyDeep(v, key));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(record, key)) return true;
    return Object.values(record).some((v) => hasKeyDeep(v, key));
  }
  return false;
}

/**
 * Asserts that a list response contains none of the given ids — used to
 * confirm cross-tenant data never leaks into a list endpoint even when the
 * endpoint itself returns 200 instead of rejecting outright.
 */
export function expectNoLeakedIds(items: Array<{ _id?: string; id?: string }>, leakedIds: string[]): void {
  const presentIds = new Set(items.map((item) => item._id ?? item.id));
  for (const leakedId of leakedIds) {
    expect(presentIds.has(leakedId), `Expected id ${leakedId} to be absent but it was present in the response`).toBe(
      false,
    );
  }
}
