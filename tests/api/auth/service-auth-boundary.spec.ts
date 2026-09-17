import { test, expect } from '@playwright/test';
import { apiClients } from '../../../helpers/apiClient';
import { SERVICE_PROBES } from '../../../helpers/serviceCatalog';

/**
 * Systematic auth-boundary sweep: every service that is supposed to require
 * authentication must reject an unauthenticated read with 401.
 *
 * This is the test that would have caught the sidebar gaps without anyone
 * thinking to look for them. Adding a service to helpers/serviceCatalog.ts
 * automatically enrolls it here — coverage grows by editing one list.
 *
 * Services with `requiresAuth: false` are the confirmed, already-reported
 * gaps; they're excluded here and asserted against in
 * tests/api/tenancy/known-gaps.spec.ts instead, so this suite stays green
 * when the platform is behaving and the known gaps stay individually
 * tracked rather than blurred into this sweep.
 */
const PROTECTED = SERVICE_PROBES.filter((p) => p.requiresAuth);

test.describe('Auth boundary — every protected service rejects anonymous reads', () => {
  for (const probe of PROTECTED) {
    test(`${probe.name} rejects an unauthenticated GET ${probe.path}`, async ({ request }) => {
      const response = await apiClients(request)[probe.client].get(probe.path);
      expect(
        response.status(),
        `${probe.name} served GET ${probe.path} without a token — if this is a new gap, report it, do not fix it here (see CHARTER.md)`,
      ).toBe(401);
    });
  }

  for (const probe of PROTECTED) {
    test(`${probe.name} rejects a malformed bearer token on ${probe.path}`, async ({ request }) => {
      const response = await apiClients(request)[probe.client].get(probe.path, {
        Authorization: 'Bearer not-a-real-jwt',
      });
      expect(
        response.status(),
        `${probe.name} accepted a garbage token on GET ${probe.path}`,
      ).toBe(401);
    });
  }
});
