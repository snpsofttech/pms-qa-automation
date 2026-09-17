import { test, expect } from '@playwright/test';
import { apiClients } from '../../../helpers/apiClient';
import { config } from '../../../helpers/config';
import { expectUnauthorized } from '../../../helpers/assertions';

test.describe('API — auth', () => {
  test('POST /api/auth/login succeeds for the QA admin and returns a usable access token', async ({ request }) => {
    const clients = apiClients(request);
    const response = await clients.signupLogin.post('/api/auth/login', {
      email: config.qa.adminEmail,
      password: config.qa.adminPassword,
    });
    expect(response.ok(), `login failed: ${response.status()} ${await response.text()}`).toBeTruthy();
    const body = await response.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.user?.tenantId).toBeTruthy();
  });

  test('POST /api/auth/login rejects a wrong password', async ({ request }) => {
    const clients = apiClients(request);
    const response = await clients.signupLogin.post('/api/auth/login', {
      email: config.qa.adminEmail,
      password: 'definitely-not-the-real-password',
    });
    expect(response.status()).toBe(401);
  });

  test('a protected endpoint rejects requests with no token', async ({ request }) => {
    const clients = apiClients(request);
    const response = await clients.jobs.get('/workflow/jobs/jobs');
    await expectUnauthorized(response);
  });

  test('a protected endpoint rejects a garbage bearer token', async ({ request }) => {
    const clients = apiClients(request);
    const response = await clients.jobs.get('/workflow/jobs/jobs', {
      Authorization: 'Bearer not-a-real-jwt',
    });
    await expectUnauthorized(response);
  });
});
