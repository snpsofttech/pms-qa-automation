import { test, expect } from '../../../fixtures/tenant.fixture';
import { extractList } from '../../../helpers/assertions';
import { blockTest } from '../../../helpers/triage';

/**
 * Regression coverage for the confirmed cross-tenant WRITE vulnerability in
 * account-contact-backend (bug-reports/P0-cross-tenant-WRITE-access-in-
 * account-contact-backend.md). One test per affected write handler.
 *
 * SAFE-BY-DESIGN against a still-vulnerable server: every test records the
 * target's original state as its OWNER, attempts the cross-tenant write as
 * the ATTACKER, and RESTORES in a finally — so even when the write wrongly
 * succeeds (as it does on any deployment still running the unpatched code),
 * no lasting mutation is left behind. Only the two disposable QA tenants are
 * touched; never production, never an unrelated record.
 *
 * Each test asserts the SECURE behavior: the attacker's write is rejected
 * (>=400) and the owner's record is unchanged. So:
 *   - against the FIXED code  -> rejected, no change  -> PASS
 *   - against unpatched code  -> write lands, restored -> FAIL (reports the
 *                                vuln without leaving a mess)
 *
 * NOTE ON DEPLOYMENT: these run against whatever `ACCOUNT_CONTACT_API` points
 * at (staging). The fix in c:\services\account-contact-backend is a local,
 * undeployed working-copy change — until it is deployed, these tests fail by
 * design, which is the correct signal that the running system is still
 * vulnerable.
 */

interface Account {
  _id: string;
  clientType?: string;
  active?: boolean;
  contacts?: Array<{ contact: string; canNotify?: boolean }>;
}
interface Contact {
  _id: string;
  companyName?: string;
}

const ACCOUNTS = '/api/clientaccounts/';
const CONTACTS = '/api/contacts/';

async function firstAccount(apis: any, session: any): Promise<Account | undefined> {
  const res = await apis.accountContact.as(session).get(ACCOUNTS);
  return extractList<Account>(await res.json())[0];
}
async function accountById(apis: any, session: any, id: string): Promise<Account> {
  const res = await apis.accountContact.as(session).get(`/api/clientaccounts/${id}`);
  const body = await res.json();
  return (body?.data ?? body) as Account;
}
async function firstContact(apis: any, session: any): Promise<Contact | undefined> {
  const res = await apis.accountContact.as(session).get(CONTACTS);
  return extractList<Contact>(await res.json())[0];
}
async function contactById(apis: any, session: any, id: string): Promise<Contact> {
  const res = await apis.accountContact.as(session).get(`/api/contacts/contact/${id}`);
  const body = await res.json();
  return (body?.data ?? body) as Contact;
}

test.describe('Cross-tenant WRITE isolation — account-contact-backend', () => {
  // These probes MUTATE (then restore) Tenant B data. Against a target still
  // running the unpatched code they are unsafe to fire indiscriminately — in
  // particular `updateAccountActiveStatus` carries a tenant-REASSIGNMENT bug
  // that, if MongoDB folds the stray key, would move the account out of
  // Tenant B and leave it unrecoverable by its owner. So the whole spec is
  // gated: it runs only when ALLOW_TENANCY_WRITE_PROBES is set, which should
  // be done only against a deployment that HAS the fix (where every write is
  // rejected and the probes are harmless no-ops). The vulnerability itself is
  // already empirically confirmed via the controlled single-field probe
  // recorded in bug-reports/P0-cross-tenant-WRITE-access-in-account-contact-backend.md.
  test.beforeEach(() => {
    test.skip(
      !process.env.ALLOW_TENANCY_WRITE_PROBES,
      'BLOCKED: cross-tenant write probes are gated. Deploy the account-contact-backend fix, then run with ALLOW_TENANCY_WRITE_PROBES=1 against that target.',
    );
  });

  test('updateAccount: Tenant A cannot modify Tenant B account (PUT /api/clientaccounts/:id)', async ({
    apis,
    tenantA,
    tenantB,
  }) => {
    const acc = await firstAccount(apis, tenantB.admin);
    blockTest(test, !acc, 'Tenant B has no account to target');

    const original = acc!.clientType ?? 'Individual';
    const probe = original === 'Individual' ? 'Company' : 'Individual';
    let attemptStatus = 0;
    try {
      const res = await apis.accountContact.as(tenantA.admin).put(`/api/clientaccounts/${acc!._id}`, {
        clientType: probe,
      });
      attemptStatus = res.status();
    } finally {
      await apis.accountContact
        .as(tenantB.admin)
        .put(`/api/clientaccounts/${acc!._id}`, { clientType: original })
        .catch(() => {});
    }

    const after = await accountById(apis, tenantB.admin, acc!._id);
    expect(attemptStatus, 'cross-tenant account update must be rejected (>=400)').toBeGreaterThanOrEqual(400);
    expect(after.clientType, 'Tenant B account must be unchanged by a Tenant A write').toBe(original);
  });

  test('updateContactwithoutPassword: Tenant A cannot modify Tenant B contact (PUT /api/contacts/contact/:id)', async ({
    apis,
    tenantA,
    tenantB,
  }) => {
    const contact = await firstContact(apis, tenantB.admin);
    blockTest(test, !contact, 'Tenant B has no contact to target');

    const original = contact!.companyName ?? '';
    const probe = `QA_PROBE_${Date.now()}`;
    let attemptStatus = 0;
    try {
      const res = await apis.accountContact.as(tenantA.admin).put(`/api/contacts/contact/${contact!._id}`, {
        companyName: probe,
      });
      attemptStatus = res.status();
    } finally {
      await apis.accountContact
        .as(tenantB.admin)
        .put(`/api/contacts/contact/${contact!._id}`, { companyName: original })
        .catch(() => {});
    }

    const after = await contactById(apis, tenantB.admin, contact!._id);
    expect(attemptStatus, 'cross-tenant contact update must be rejected (>=400)').toBeGreaterThanOrEqual(400);
    expect(after.companyName ?? '', 'Tenant B contact must be unchanged by a Tenant A write').toBe(original);
  });

  test('updateAccountActiveStatus: Tenant A cannot archive/activate Tenant B accounts (PATCH /api/clientaccounts/update-active)', async ({
    apis,
    tenantA,
    tenantB,
  }) => {
    const acc = await firstAccount(apis, tenantB.admin);
    blockTest(test, !acc, 'Tenant B has no account to target');

    const original = acc!.active ?? true;
    let attemptStatus = 0;
    try {
      const res = await apis.accountContact.as(tenantA.admin).patch('/api/clientaccounts/update-active', {
        ids: [acc!._id],
        active: !original,
      });
      attemptStatus = res.status();
    } finally {
      await apis.accountContact
        .as(tenantB.admin)
        .patch('/api/clientaccounts/update-active', { ids: [acc!._id], active: original })
        .catch(() => {});
    }

    const after = await accountById(apis, tenantB.admin, acc!._id);
    // This handler currently returns 200 even for zero matches, so also assert
    // the account's active flag is untouched — the stronger guarantee.
    expect(after.active, 'Tenant B account active-flag must be unchanged by a Tenant A bulk update').toBe(original);
  });

  test('toggleContactLogin: Tenant A cannot change Tenant B contact permissions (PATCH /:accountId/contact/:contactId)', async ({
    apis,
    tenantA,
    tenantB,
  }) => {
    const acc = await firstAccount(apis, tenantB.admin);
    blockTest(test, !acc || !acc.contacts || acc.contacts.length === 0, 'Tenant B account has no attached contact');
    const entry = acc!.contacts![0];
    const originalCanNotify = entry.canNotify ?? false;

    let attemptStatus = 0;
    try {
      // canNotify is toggled deliberately (not canLogin) so the test never
      // mints an activation token or disturbs the QA client's login state.
      const res = await apis.accountContact
        .as(tenantA.admin)
        .patch(`/api/clientaccounts/${acc!._id}/contact/${entry.contact}`, { canNotify: !originalCanNotify });
      attemptStatus = res.status();
    } finally {
      await apis.accountContact
        .as(tenantB.admin)
        .patch(`/api/clientaccounts/${acc!._id}/contact/${entry.contact}`, { canNotify: originalCanNotify })
        .catch(() => {});
    }

    const after = await accountById(apis, tenantB.admin, acc!._id);
    const afterEntry = after.contacts?.find((c) => c.contact === entry.contact);
    expect(attemptStatus, 'cross-tenant permission change must be rejected (>=400)').toBeGreaterThanOrEqual(400);
    expect(afterEntry?.canNotify ?? false, 'Tenant B contact permissions must be unchanged').toBe(originalCanNotify);
  });

  test('addContactsToAccount: Tenant A cannot attach a contact to a Tenant B account (POST /:accountId/contacts)', async ({
    apis,
    tenantA,
    tenantB,
  }) => {
    const bAcct = await firstAccount(apis, tenantB.admin);
    const aContact = await firstContact(apis, tenantA.admin);
    blockTest(test, !bAcct || !aContact, 'need a Tenant B account and a Tenant A contact');

    let attemptStatus = 0;
    try {
      const res = await apis.accountContact
        .as(tenantA.admin)
        .post(`/api/clientaccounts/${bAcct!._id}/contacts`, {
          contacts: [{ contact: aContact!._id, canLogin: false }],
        });
      attemptStatus = res.status();
    } finally {
      // If it wrongly succeeded, detach the foreign contact as the owner.
      await apis.accountContact
        .as(tenantB.admin)
        .delete(`/api/clientaccounts/${bAcct!._id}/contact/${aContact!._id}`)
        .catch(() => {});
    }

    const after = await accountById(apis, tenantB.admin, bAcct!._id);
    const leaked = after.contacts?.some((c) => c.contact === aContact!._id) ?? false;
    expect(attemptStatus, 'cross-tenant contact attach must be rejected (>=400)').toBeGreaterThanOrEqual(400);
    expect(leaked, 'a Tenant A contact must not end up attached to a Tenant B account').toBe(false);
  });

  test('removeContactFromAccount: Tenant A cannot detach a contact from a Tenant B account (DELETE /:accountId/contact/:contactId)', async ({
    apis,
    tenantA,
    tenantB,
  }) => {
    const bAcct = await firstAccount(apis, tenantB.admin);
    const aContact = await firstContact(apis, tenantA.admin);
    blockTest(test, !bAcct || !aContact, 'need a Tenant B account and a Tenant A contact');

    // Scaffold a disposable, removable target as the OWNER: attach Tenant A's
    // contact to Tenant B's account. Never touches Tenant B's real client
    // contact. Cleaned up in finally regardless of outcome.
    await apis.accountContact
      .as(tenantB.admin)
      .post(`/api/clientaccounts/${bAcct!._id}/contacts`, { contacts: [{ contact: aContact!._id, canLogin: false }] })
      .catch(() => {});

    let attemptStatus = 0;
    try {
      const res = await apis.accountContact
        .as(tenantA.admin)
        .delete(`/api/clientaccounts/${bAcct!._id}/contact/${aContact!._id}`);
      attemptStatus = res.status();
    } finally {
      await apis.accountContact
        .as(tenantB.admin)
        .delete(`/api/clientaccounts/${bAcct!._id}/contact/${aContact!._id}`)
        .catch(() => {});
    }

    expect(attemptStatus, 'cross-tenant contact detach must be rejected (>=400)').toBeGreaterThanOrEqual(400);
  });

  // uploadProfilePicture (PATCH /api/clientaccounts/:id/profile-picture) shares
  // the identical findByIdAndUpdate({_id,tenantId}) idiom, fixed in the same
  // change. Not probed live: it requires a multipart file upload and writes a
  // file to the server, which is awkward to make cleanly reversible. Covered
  // by the fix and by code review; add a live test if a regression is ever
  // suspected there specifically.
  test.fixme('uploadProfilePicture: cross-tenant profile-picture write is rejected', async () => {});
});
