import { APIRequestContext } from '@playwright/test';
import { apiClients, AuthSession } from './apiClient';
import { extractList } from './assertions';

/** Look up a contact by email over the API (bare-array list per ARCHITECTURE). */
export async function findContactByEmail(
  request: APIRequestContext,
  admin: AuthSession,
  email: string,
): Promise<Record<string, any> | null> {
  const apis = apiClients(request);
  const res = await apis.accountContact.as(admin).get('/api/contacts/');
  if (!res.ok()) return null;
  const contacts = extractList<Record<string, any>>(await res.json());
  const lc = email.toLowerCase();
  return (
    contacts.find(
      (c) => String(c.email ?? c.contact?.email ?? '').toLowerCase() === lc,
    ) ?? null
  );
}
