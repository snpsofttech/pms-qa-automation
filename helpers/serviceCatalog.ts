import { apiClients } from './apiClient';

export type ServiceKey = keyof ReturnType<typeof apiClients>;

export interface ServiceProbe {
  /** Directory name of the service under c:\services, for bug reports. */
  name: ServiceKey extends never ? never : string;
  /** Key into apiClients(request). */
  client: ServiceKey;
  /**
   * The cheapest read that exercises the service end to end. Chosen to be
   * side-effect free and to need no path params or seeded data, so a probe
   * failure means "service unreachable / auth broken", never "no test data".
   * Trailing slashes matter where the router is mounted at "/" — see
   * ARCHITECTURE.md.
   */
  path: string;
  /**
   * Whether an unauthenticated request to `path` is expected to be rejected.
   * `false` marks a CONFIRMED, REPORTED gap — not an approval of it. Those
   * are asserted against in tests/api/tenancy/known-gaps.spec.ts, which is
   * expected to fail until the services are fixed. When one is fixed, flip
   * this to true and the auth-boundary suite starts guarding it.
   */
  requiresAuth: boolean;
}

/**
 * Every backend service, with one verified probe endpoint each. Single
 * source of truth shared by the smoke suite and the auth-boundary suite, so
 * adding a service means editing one list rather than several specs.
 *
 * All paths and auth expectations verified live against staging 2026-09-10.
 */
export const SERVICE_PROBES: ServiceProbe[] = [
  { name: 'signup-login-backend', client: 'signupLogin', path: '/api/auth/me', requiresAuth: true },
  { name: 'account-contact-backend', client: 'accountContact', path: '/api/clientaccounts/', requiresAuth: true },
  { name: 'account-note-backend', client: 'accountNote', path: '/account/notes/', requiresAuth: true },
  { name: 'account-task-backend', client: 'accountTasks', path: '/accounts-tasks/', requiresAuth: true },
  { name: 'jobs-backend', client: 'jobs', path: '/workflow/jobs/jobs', requiresAuth: true },
  { name: 'invoice-backend', client: 'invoice', path: '/account/invoicelist/invoicecount', requiresAuth: true },
  { name: 'proposal-backend', client: 'proposal', path: '/api/proposals/', requiresAuth: true },
  { name: 'esignature-backend', client: 'esignature', path: '/api/submissions', requiresAuth: true },
  { name: 'folder-mangement', client: 'folderManagement', path: '/accounts/docs/list', requiresAuth: true },
  { name: 'internal-communication', client: 'internalCommunication', path: '/api/internalchat/', requiresAuth: true },
  { name: 'organizer-backend', client: 'organizer', path: '/api/organizertemp/organizertemplate', requiresAuth: true },
  { name: 'templates-backend', client: 'templates', path: '/temp/pipeline/pipelines', requiresAuth: true },
  { name: 'chat-backend', client: 'chat', path: '/chats/chatsaccountwise', requiresAuth: true },

  // ── Confirmed unauthenticated. Reported, not accepted. ──
  // bug-reports/sidebar-backend-accepts-unauthenticated-writes-on-api-newsidebar.md
  { name: 'sidebar-backend', client: 'sidebar', path: '/api/newsidebar/', requiresAuth: false },
  // bug-reports/client-sidebar-backend-has-no-authentication-on-any-route.md
  { name: 'client-sidebar-backend', client: 'clientSidebar', path: '/clientsidebar/', requiresAuth: false },
];

/**
 * A second, separate gap inside an otherwise-protected service: this router
 * skips the `protect` middleware that the rest of folder-mangement applies.
 * Kept out of SERVICE_PROBES because the service itself IS protected — it's
 * one router that isn't.
 */
export const UNPROTECTED_SUBROUTES = [
  {
    name: 'folder-mangement',
    client: 'folderManagement' as ServiceKey,
    path: '/tempfolder/docManagement/list',
    note: 'routes/docManagementRoutes.js is mounted without protect, unlike the service\'s other four routers',
  },
];
