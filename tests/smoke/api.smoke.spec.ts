import { test, expect } from '../../fixtures/auth.fixture';
import { SERVICE_PROBES } from '../../helpers/serviceCatalog';

/**
 * None of the 15 backend services expose a `/health` endpoint (confirmed
 * during recon — see ARCHITECTURE.md). These smoke checks use the lightest
 * real read each service offers, catalogued in helpers/serviceCatalog.ts.
 * A failure here means "the service is unreachable / auth is broken", not
 * "a specific feature is broken" — that's what the rest of tests/api is for.
 *
 * One test per service rather than a loop inside a single test, so the
 * report names the failing service directly and one outage doesn't mask
 * the others behind a first-failure abort.
 */
test.describe('Backend — smoke', () => {
  for (const probe of SERVICE_PROBES) {
    test(`${probe.name} responds on ${probe.path}`, async ({ apis, adminSession }) => {
      const client = probe.requiresAuth ? apis[probe.client].as(adminSession) : apis[probe.client];
      const response = await client.get(probe.path);
      expect(
        response.ok(),
        `${probe.name} GET ${probe.path} returned ${response.status()} — service unreachable or auth broken`,
      ).toBeTruthy();
    });
  }
});
