import { defineConfig, devices } from '@playwright/test';
import { config } from './helpers/config';

export default defineConfig({
  globalSetup: require.resolve('./scripts/globalSetup'),
  globalTeardown: require.resolve('./scripts/globalTeardown'),

  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    // Auto-generates a "needs investigation" bug-report skeleton for any
    // failure a test didn't manually classify via helpers/bugReport.ts.
    // See CHARTER.md.
    ['./reporters/bugReportReporter.ts'],
  ],

  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Videos normally record only for failed browser tests. Set VIDEO=on to
    // record every test (useful for watching a flow run): `VIDEO=on npm run
    // test:staging -- --project=smoke-admin`. Output is a .webm per test
    // under test-results/ — play it in a browser or VLC (Windows' Movies & TV
    // often can't decode .webm), or view it inline via `npm run report`.
    video:
      process.env.VIDEO === 'on'
        ? { mode: 'on', size: { width: 1280, height: 720 } }
        : 'retain-on-failure',
    // Record video at a fixed, share-friendly size regardless of device.
    viewport: { width: 1366, height: 768 },
    // SLOWMO=<ms> slows each action so a recorded flow is watchable (e.g.
    // SLOWMO=450 for the business-workflow demo video).
    launchOptions: { slowMo: process.env.SLOWMO ? Number(process.env.SLOWMO) : 0 },
  },

  projects: [
    {
      name: 'admin',
      testDir: './tests/admin',
      use: { ...devices['Desktop Chrome'], baseURL: config.admin.baseURL },
    },
    {
      name: 'client',
      testDir: './tests/client',
      use: { ...devices['Desktop Chrome'], baseURL: config.client.baseURL },
    },
    {
      name: 'api',
      testDir: './tests/api',
      use: {},
    },
    {
      name: 'integration',
      testDir: './tests/integration',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'smoke-admin',
      testDir: './tests/smoke',
      testMatch: /admin\.smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: config.admin.baseURL },
    },
    {
      name: 'smoke-client',
      testDir: './tests/smoke',
      testMatch: /client\.smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: config.client.baseURL },
    },
    {
      name: 'smoke-api',
      testDir: './tests/smoke',
      testMatch: /api\.smoke\.spec\.ts/,
      use: {},
    },
  ],
});
