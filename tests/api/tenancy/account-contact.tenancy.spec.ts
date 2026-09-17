import { test, expect } from '../../../fixtures/tenant.fixture';
import { expectAuthorizationFailure, expectNoLeakedIds, extractList, hasKeyDeep } from '../../../helpers/assertions';
import { blockTest } from '../../../helpers/triage';

interface AccountRecord {
  _id: string;
  accountName?: string;
}

/**
 * account-contact-backend filters LIST queries by req.user.tenantId, but its
 * by-ID handlers use `Model.findById({_id, tenantId})` — which Mongoose casts
 * by extracting `_id`, silently dropping the tenant predicate. These tests
 * cover both paths, and the by-ID ones are currently EXPECTED TO FAIL:
 * see bug-reports/P0-cross-tenant-read-access-via-findById-object-arg.md
 */
test.describe('Tenant isolation — accounts', () => {
  test('Tenant A account list never contains a Tenant B account id', async ({ apis, tenantA, tenantB }) => {
    const [resA, resB] = await Promise.all([
      apis.accountContact.as(tenantA.admin).get('/api/clientaccounts/'),
      apis.accountContact.as(tenantB.admin).get('/api/clientaccounts/'),
    ]);
    expect(resA.ok(), `Tenant A account list failed: ${resA.status()}`).toBeTruthy();
    expect(resB.ok(), `Tenant B account list failed: ${resB.status()}`).toBeTruthy();

    const listA = extractList<AccountRecord>(await resA.json());
    const listB = extractList<AccountRecord>(await resB.json());
    blockTest(test, listB.length === 0, 'Tenant B has no accounts in this environment');

    expectNoLeakedIds(listA, listB.map((a) => a._id));
  });

  test('Tenant A admin cannot fetch a Tenant B account by id directly', async ({ apis, tenantA, tenantB }) => {
    const resB = await apis.accountContact.as(tenantB.admin).get('/api/clientaccounts/');
    const listB = extractList<AccountRecord>(await resB.json());
    blockTest(test, listB.length === 0, 'Tenant B has no accounts to test against in this environment');

    const targetId = listB[0]._id;
    const crossTenantRead = await apis.accountContact.as(tenantA.admin).get(`/api/clientaccounts/${targetId}`);
    await expectAuthorizationFailure(crossTenantRead);
  });

  test('Tenant A admin cannot fetch a Tenant B contact by id directly', async ({ apis, tenantA, tenantB }) => {
    const resB = await apis.accountContact.as(tenantB.admin).get('/api/contacts/');
    const contactsB = extractList<AccountRecord>(await resB.json());
    blockTest(test, contactsB.length === 0, 'Tenant B has no contacts to test against in this environment');

    const targetId = contactsB[0]._id;
    const crossTenantRead = await apis.accountContact.as(tenantA.admin).get(`/api/contacts/contact/${targetId}`);
    await expectAuthorizationFailure(crossTenantRead);
  });

  test('contact responses never expose password hashes or activation tokens', async ({ apis, tenantA }) => {
    const res = await apis.accountContact.as(tenantA.admin).get('/api/contacts/');
    const contacts = extractList<AccountRecord>(await res.json());
    blockTest(test, contacts.length === 0, 'Tenant A has no contacts in this environment');

    const detail = await apis.accountContact.as(tenantA.admin).get(`/api/contacts/contact/${contacts[0]._id}`);
    const body = await detail.json();

    // Must search recursively: this endpoint wraps the record in
    // { success, data: {...} }, so a top-level-only check silently passes
    // while the hash sits one level down. Parsed keys, not raw text, so a
    // field's string value can't trigger a false positive either.
    expect(
      hasKeyDeep(body, 'password'),
      'password hash must never be serialized to an API response — see bug-reports/P0-sensitive-fields-exposed-in-contact-api.md',
    ).toBe(false);
    expect(
      hasKeyDeep(body, 'activationToken'),
      'activation token must never be serialized to an API response (present only pre-activation) — see bug-reports/P0-sensitive-fields-exposed-in-contact-api.md',
    ).toBe(false);
  });
});
