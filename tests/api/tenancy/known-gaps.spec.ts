import { test, expect } from '@playwright/test';
import { apiClients } from '../../../helpers/apiClient';
import { config } from '../../../helpers/config';
import { attachBugReport } from '../../../helpers/bugReport';

/**
 * These tests are EXPECTED TO FAIL until the underlying services are fixed.
 * Per CHARTER.md this suite reports the gap and never patches it — finding
 * an unauthenticated endpoint does not license adding `protect` to it.
 * Each test writes a fully classified bug report BEFORE its failing
 * assertion, so evidence is captured either way. A failure here means
 * "confirmed still broken"; a pass means someone fixed it, so update
 * ARCHITECTURE.md and the corresponding report.
 *
 * Both tests are deliberately NON-DESTRUCTIVE: neither creates, modifies,
 * nor deletes any record. The write test proves the absence of an auth
 * boundary by showing an unauthenticated request reaches *schema
 * validation* (400) rather than being rejected at the auth layer (401) —
 * which demonstrates the gap without actually writing anything.
 */
test.describe('Known gaps — sidebar services have no auth boundary', () => {
  test('sidebar-backend: writes to /api/newsidebar are not authenticated', async ({ request }, testInfo) => {
    const clients = apiClients(request);

    // Intentionally invalid body — the service requires label/path/icon.
    // A 401 would mean auth rejected us before validation (correct).
    // A 400 means we reached the model layer unauthenticated (the defect).
    const response = await clients.sidebar.post('/api/newsidebar/', { qaProbe: true });
    const status = response.status();
    const bodyText = (await response.text().catch(() => '')).slice(0, 300);

    if (status !== 401) {
      const reachedValidation = status === 400 && /required/i.test(bodyText);
      attachBugReport(testInfo, {
        priority: 'P1',
        title: 'sidebar-backend accepts unauthenticated writes on /api/newsidebar',
        classification: 'APPLICATION_BUG',
        status: 'Confirmed',
        repository: 'c:\\services\\sidebar-backend',
        file: 'routes/newSidebarDataRoutes.js',
        functionOrComponent:
          'All routes in newSidebarDataRoutes.js. The service has middleware/authMiddleware.js and applies `protect` to GET /api/sidebar/ only; nothing in this router is protected.',
        endpointOrUiLocation: 'POST /api/newsidebar/ (and GET/PATCH/DELETE on the same router)',
        stepsToReproduce: [
          `Send POST ${config.services.sidebar}/api/newsidebar/ with a JSON body and NO Authorization header`,
          'Observe the response comes from schema validation or succeeds — never 401',
        ],
        expectedBehavior:
          '401 Unauthorized before any handler logic, matching the `protect` pattern used across the other services.',
        actualBehavior: reachedValidation
          ? `HTTP 400 from Mongoose schema validation — the unauthenticated request passed the routing/auth layer and reached the model. No auth check exists to reject it.`
          : `HTTP ${status} returned for an unauthenticated write request.`,
        errorMessage: bodyText,
        rootCause:
          'routes/newSidebarDataRoutes.js never applies the `protect` middleware exported by middleware/authMiddleware.js — confirmed by source inspection. The models also lack a tenantId field, so there is no tenant scoping here either.',
        evidence: [
          `Unauthenticated POST /api/newsidebar/ -> HTTP ${status}`,
          reachedValidation
            ? 'Response was a schema-validation error listing required fields, proving the request reached the model layer without credentials.'
            : `Response body (truncated): ${bodyText}`,
          'No record was created — this probe deliberately sends an invalid payload so the gap can be demonstrated without writing to the environment.',
        ],
      });
    }

    expect(status, 'unauthenticated writes must be rejected with 401 — see attached bug report').toBe(401);
  });

  test('client-sidebar-backend: reads require no token', async ({ request }, testInfo) => {
    const clients = apiClients(request);
    const response = await clients.clientSidebar.get('/clientsidebar/');
    const status = response.status();
    const bytes = (await response.body().catch(() => Buffer.alloc(0))).length;

    if (status !== 401) {
      attachBugReport(testInfo, {
        priority: 'P1',
        title: 'client-sidebar-backend has no authentication on any route',
        classification: 'APPLICATION_BUG',
        status: 'Confirmed',
        repository: 'c:\\services\\client-sidebar-backend',
        file: 'server.js, routes/sidebarDataRoutes.js',
        functionOrComponent:
          'Every route. The service has no middleware/ directory and performs no JWT verification anywhere.',
        endpointOrUiLocation: 'GET /clientsidebar/ (and every other route in the service)',
        stepsToReproduce: [
          `Send GET ${config.services.clientSidebar}/clientsidebar/ with NO Authorization header`,
          'Observe 200 with a JSON payload instead of 401',
        ],
        expectedBehavior: '401 Unauthorized, matching every other service in the platform.',
        actualBehavior: `HTTP ${status} with a ${bytes}-byte JSON body returned to a caller with no credentials.`,
        rootCause:
          'No authentication middleware exists anywhere in this service — confirmed by source inspection (no middleware/ directory present).',
        evidence: [
          `Unauthenticated GET /clientsidebar/ -> HTTP ${status}, ${bytes} bytes`,
          'Control: GET /workflow/jobs/jobs and GET /account/notes/ both return 401 unauthenticated on the same host, so the proxy is not stripping auth and staging does not have auth globally disabled.',
          'Response body deliberately not captured into QA logs in case it contains tenant data.',
        ],
      });
    }

    expect(status, 'unauthenticated reads must be rejected with 401 — see attached bug report').toBe(401);
  });
});

/**
 * A different shape of gap: folder-mangement IS a protected service — four
 * of its five routers apply `protect` — but one router was mounted without
 * it. That makes this easy to miss in review and invisible to a
 * service-level auth sweep, which is why it gets its own test.
 */
test.describe('Known gaps — folder-mangement has one unprotected router', () => {
  test('folder-mangement: /tempfolder/docManagement is not authenticated', async ({ request }, testInfo) => {
    const clients = apiClients(request);
    const response = await clients.folderManagement.get('/tempfolder/docManagement/list');
    const status = response.status();
    const bytes = (await response.body().catch(() => Buffer.alloc(0))).length;

    if (status !== 401) {
      attachBugReport(testInfo, {
        priority: 'P1',
        title: 'folder-mangement docManagement router accepts unauthenticated requests',
        classification: 'APPLICATION_BUG',
        status: 'Confirmed',
        repository: 'c:\\services\\folder-mangement',
        file: 'routes/docManagementRoutes.js (mounted in server.js)',
        functionOrComponent:
          'The /tempfolder/docManagement router. The service\'s other four routers (/tempfolder/foldertemp, /accounts/docs, /approvals, /audittrail) all apply the `protect` middleware; this one does not.',
        endpointOrUiLocation:
          'GET /tempfolder/docManagement/list — and every other route on that router, including POST /folder, POST /file/upload, POST /delete, POST /move, POST /rename',
        stepsToReproduce: [
          `Send GET ${config.services.folderManagement}/tempfolder/docManagement/list with NO Authorization header`,
          'Observe 200 instead of 401',
        ],
        expectedBehavior:
          '401 Unauthorized, consistent with the other four routers in this same service.',
        actualBehavior: `HTTP ${status} with a ${bytes}-byte body returned to an unauthenticated caller.`,
        rootCause:
          'server.js mounts docManagementRoutes without the `protect` middleware that the service applies to its other routers — confirmed by source inspection. Appears to be an omission rather than intent, since the middleware is already imported and used elsewhere in the same file.',
        evidence: [
          `Unauthenticated GET /tempfolder/docManagement/list -> HTTP ${status}, ${bytes} bytes`,
          `Control: GET /accounts/docs/list on the SAME service returns 401 unauthenticated, so the service is reachable and its auth works — this one router is the exception.`,
          'Write routes on this router (file/folder upload, delete, move, rename) share the same omission. Not exercised, to avoid mutating the environment.',
        ],
      });
    }

    expect(
      status,
      'unauthenticated access to the document-management router must be rejected — see attached bug report',
    ).toBe(401);
  });
});
