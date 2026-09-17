import path from 'path';
import dotenv from 'dotenv';

export type TestEnv = 'local' | 'staging' | 'production';

const testEnv = (process.env.TEST_ENV as TestEnv) || 'local';

/**
 * Hard stop on production. The suite is currently sanctioned for staging
 * and local only — production must not be touched at all, not even for
 * read-only smoke. The Phase 11 read-only production design is still
 * intact in the config/scripts, but reaching it now takes a deliberate,
 * explicit ALLOW_PRODUCTION_RUN=true on top of TEST_ENV=production, so it
 * can never happen by accident (a stray TEST_ENV, a mis-set CI variable,
 * a copy-pasted command).
 */
if (testEnv === 'production' && process.env.ALLOW_PRODUCTION_RUN !== 'true') {
  throw new Error(
    'Refusing to run against production. This suite is sanctioned for staging and local only. ' +
      'If a read-only production smoke run is ever explicitly approved, set ALLOW_PRODUCTION_RUN=true ' +
      'alongside TEST_ENV=production — and note that only the smoke-* projects are permitted there ' +
      '(see CHARTER.md and README.md §9).',
  );
}

// Layer the shared .env.example-shaped file for this environment on top of
// whatever is already in process.env (CI secrets take precedence).
dotenv.config({ path: path.resolve(__dirname, '..', `.env.${testEnv}`) });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var "${name}" for TEST_ENV="${testEnv}". ` +
        `Copy .env.example to .env.${testEnv} and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const config = {
  env: testEnv,
  isProduction: testEnv === 'production',

  admin: {
    baseURL: required('ADMIN_BASE_URL'),
  },
  client: {
    baseURL: required('CLIENT_BASE_URL'),
  },

  // Direct microservice base URLs — the apps call these individually,
  // there is no shared API gateway. See ARCHITECTURE.md for the full
  // route inventory backing each one.
  services: {
    signupLogin: required('SIGNUP_LOGIN_API'),
    accountContact: required('ACCOUNT_CONTACT_API'),
    accountNote: optional('ACCOUNT_NOTE_API'),
    accountTasks: optional('ACCOUNT_TASKS_API'),
    jobs: optional('JOBS_API'),
    invoice: optional('INVOICE_API'),
    proposal: optional('PROPOSAL_API'),
    esignature: optional('ESIGNATURE_API'),
    folderManagement: optional('FOLDER_MANAGEMENT_API'),
    internalCommunication: optional('INTERNAL_COMMUNICATION_API'),
    organizer: optional('ORGANIZER_API'),
    templates: optional('TEMPLATES_API'),
    chat: optional('CHAT_API'),
    sidebar: optional('SIDEBAR_API'),
    clientSidebar: optional('CLIENT_SIDEBAR_API'),
  },

  qa: {
    tenantA: required('QA_TENANT_A'),
    tenantB: required('QA_TENANT_B'),

    adminEmail: required('QA_ADMIN_EMAIL'),
    adminPassword: required('QA_ADMIN_PASSWORD'),

    adminBEmail: optional('QA_ADMIN_B_EMAIL'),
    adminBPassword: optional('QA_ADMIN_B_PASSWORD'),

    clientEmail: optional('QA_CLIENT_EMAIL'),
    clientPassword: optional('QA_CLIENT_PASSWORD'),
    clientAccountId: optional('QA_CLIENT_ACCOUNT_ID'),

    clientBEmail: optional('QA_CLIENT_B_EMAIL'),
    clientBPassword: optional('QA_CLIENT_B_PASSWORD'),
    clientBAccountId: optional('QA_CLIENT_B_ACCOUNT_ID'),
  },
} as const;

/**
 * Guard for any helper that performs a write/delete. Throws in production
 * regardless of caller intent — destructive flows must only run against
 * local/staging. See helpers/cleanup.ts and Phase 11 in README.md.
 */
export function assertNotProduction(actionDescription: string): void {
  if (config.isProduction) {
    throw new Error(
      `Refusing to run "${actionDescription}" against TEST_ENV=production. ` +
        `Production automation is read-only by design.`,
    );
  }
}
