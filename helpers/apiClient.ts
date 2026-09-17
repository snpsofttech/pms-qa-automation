import { APIRequestContext, APIResponse } from '@playwright/test';
import { config } from './config';

export type Role = 'admin' | 'team_member' | 'client';

export interface AuthSession {
  token: string;
  role: Role;
  tenantId: string;
  userId: string;
  /** Only present for client-role sessions — required by every account-scoped endpoint. */
  accountId?: string;
}

/**
 * POST {SIGNUP_LOGIN_API}/api/auth/login
 * Confirmed response shape (signup-login-backend/controllers/authController.js:792-815):
 *   { message, accessToken, user: { id, email, role, username, tenantId, group, permissions }, roleData }
 * A refresh token is also set as an httpOnly `refreshToken` cookie (secure, SameSite=None) —
 * that cookie requires HTTPS to be stored by the browser, so it will silently no-op over
 * plain http://localhost. Fine for API-only tests (we hold the access token directly);
 * relevant if you reuse this session for a browser context locally, see fixtures/auth.fixture.ts.
 */
export async function loginAsAdmin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<AuthSession> {
  const response = await request.post(`${config.services.signupLogin}/api/auth/login`, {
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error(`Admin login failed (${response.status()}) for ${email}: ${await response.text()}`);
  }
  const body = await response.json();
  return {
    token: body.accessToken,
    role: body.user.role,
    tenantId: body.user.tenantId,
    userId: body.user.id,
  };
}

/**
 * POST {ACCOUNT_CONTACT_API}/api/contactauth/login
 * Confirmed response shape (account-contact-backend/controllers/authController.js:218-230):
 *   { message, token, user: { id, email, role: "client", tenantId }, accounts: [{ _id, accountName, clientType, companyName }] }
 * No cookie is set here. `accountId` must be one of `accounts[]._id` — the client app
 * requires both a token AND a selected accountId to be considered authenticated.
 */
export async function loginAsClient(
  request: APIRequestContext,
  email: string,
  password: string,
  accountId?: string,
): Promise<AuthSession> {
  const response = await request.post(`${config.services.accountContact}/api/contactauth/login`, {
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error(`Client login failed (${response.status()}) for ${email}: ${await response.text()}`);
  }
  const body = await response.json();
  const resolvedAccountId = accountId ?? body.accounts?.[0]?._id;
  if (!resolvedAccountId) {
    throw new Error(
      `Client login for ${email} succeeded but no accountId was supplied or available in accounts[]. ` +
        `Set QA_CLIENT_ACCOUNT_ID / QA_CLIENT_B_ACCOUNT_ID in your env file.`,
    );
  }
  return {
    token: body.token,
    role: body.user.role,
    tenantId: body.user.tenantId,
    userId: body.user.id,
    accountId: resolvedAccountId,
  };
}

/**
 * Thin wrapper around Playwright's APIRequestContext that injects the
 * Bearer token for a given session and gives every service the same
 * GET/POST/PUT/PATCH/DELETE surface. One instance per (service, session)
 * pair — call `.as(session)` to get a client bound to a different identity
 * against the same service, e.g. to run the same call as Tenant A vs Tenant B.
 */
export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseURL: string,
    private readonly session?: AuthSession,
  ) {}

  as(session: AuthSession): ApiClient {
    return new ApiClient(this.request, this.baseURL, session);
  }

  private url(path: string): string {
    return path.startsWith('http') ? path : `${this.baseURL}${path}`;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (this.session) {
      headers.Authorization = `Bearer ${this.session.token}`;
    }
    return headers;
  }

  /**
   * Redirects are deliberately NOT followed.
   *
   * Every service is fronted by one nginx reverse proxy that routes by path
   * prefix, and routers mounted at `/` (e.g. `/api/clientaccounts`,
   * `/account/notes`, `/clientsidebar`) issue a 301 to the trailing-slash
   * form. Following that silently is dangerous for a test suite: a 301 on a
   * POST is replayed as a GET with the body dropped, so a "create" call can
   * appear to succeed while having written nothing. Surfacing the 3xx makes
   * a wrong path fail loudly and immediately instead.
   */
  private static readonly NO_REDIRECT = { maxRedirects: 0 } as const;

  get(path: string, extraHeaders?: Record<string, string>): Promise<APIResponse> {
    return this.request.get(this.url(path), { headers: this.headers(extraHeaders), ...ApiClient.NO_REDIRECT });
  }

  post(path: string, data?: unknown, extraHeaders?: Record<string, string>): Promise<APIResponse> {
    return this.request.post(this.url(path), { data, headers: this.headers(extraHeaders), ...ApiClient.NO_REDIRECT });
  }

  put(path: string, data?: unknown, extraHeaders?: Record<string, string>): Promise<APIResponse> {
    return this.request.put(this.url(path), { data, headers: this.headers(extraHeaders), ...ApiClient.NO_REDIRECT });
  }

  patch(path: string, data?: unknown, extraHeaders?: Record<string, string>): Promise<APIResponse> {
    return this.request.patch(this.url(path), { data, headers: this.headers(extraHeaders), ...ApiClient.NO_REDIRECT });
  }

  delete(path: string, extraHeaders?: Record<string, string>): Promise<APIResponse> {
    return this.request.delete(this.url(path), { headers: this.headers(extraHeaders), ...ApiClient.NO_REDIRECT });
  }
}

/** Convenience factory: one ApiClient per known service, unauthenticated by default. */
export function apiClients(request: APIRequestContext) {
  return {
    signupLogin: new ApiClient(request, config.services.signupLogin),
    accountContact: new ApiClient(request, config.services.accountContact),
    accountNote: new ApiClient(request, config.services.accountNote),
    accountTasks: new ApiClient(request, config.services.accountTasks),
    jobs: new ApiClient(request, config.services.jobs),
    invoice: new ApiClient(request, config.services.invoice),
    proposal: new ApiClient(request, config.services.proposal),
    esignature: new ApiClient(request, config.services.esignature),
    folderManagement: new ApiClient(request, config.services.folderManagement),
    internalCommunication: new ApiClient(request, config.services.internalCommunication),
    organizer: new ApiClient(request, config.services.organizer),
    templates: new ApiClient(request, config.services.templates),
    chat: new ApiClient(request, config.services.chat),
    sidebar: new ApiClient(request, config.services.sidebar),
    clientSidebar: new ApiClient(request, config.services.clientSidebar),
  };
}
