import { test as authTest, expect } from './auth.fixture';
import { AuthSession } from '../helpers/apiClient';

export interface TenantIdentity {
  admin: AuthSession;
  client: AuthSession;
}

type TenantFixtures = {
  /** Tenant A's admin + client sessions, paired for cross-tenant comparisons. */
  tenantA: TenantIdentity;
  /** Tenant B's admin + client sessions — used as the "other tenant" in isolation tests. */
  tenantB: TenantIdentity;
};

/**
 * Use this in any test that needs to prove Tenant A cannot see Tenant B's
 * data (or vice versa). See tests/api/tenancy/*.spec.ts for the pattern:
 * create a resource as tenantB, then assert tenantA.admin/client cannot
 * read/list/modify/delete it.
 */
export const test = authTest.extend<TenantFixtures>({
  tenantA: async ({ adminSession, clientSession }, use) => {
    await use({ admin: adminSession, client: clientSession });
  },
  tenantB: async ({ adminBSession, clientBSession }, use) => {
    await use({ admin: adminBSession, client: clientBSession });
  },
});

export { expect };
