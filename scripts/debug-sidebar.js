// One-off diagnostic: log in as admin, inspect the sidebar "Accounts" leaf and
// how the "Clients" group expands. Run: node scripts/debug-sidebar.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.staging') });
const { chromium } = require('@playwright/test');

const BASE = process.env.ADMIN_BASE_URL; // https://staging-admin.snptaxes.com/admin
const EMAIL = process.env.QA_ADMIN_EMAIL;
const PASS = process.env.QA_ADMIN_PASSWORD;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}/login`);
    await page.locator('input[name="email"]').fill(EMAIL);
    await page.locator('input[name="password"]').click();
    await page.locator('input[name="password"]').fill(PASS);
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: '8 hours' }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL(/\/insights/, { timeout: 20000 });
    console.log('logged in, on insights');

    const clients = page.getByRole('button', { name: 'Clients', exact: true });
    const accounts = page.getByRole('button', { name: 'Accounts', exact: true });

    const info = async (label) => {
      const box = await accounts.boundingBox().catch(() => null);
      const vis = await accounts.isVisible().catch(() => null);
      const ariaC = await clients.getAttribute('aria-expanded').catch(() => null);
      console.log(`${label}: accounts.box=${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'null'} isVisible=${vis} clients.aria-expanded=${ariaC}`);
    };

    await page.waitForTimeout(1500);
    await info('initial');
    await clients.click();
    await page.waitForTimeout(1200);
    await info('after 1 click on Clients');
    // Try clicking accounts now
    try {
      await accounts.click({ timeout: 5000 });
      await page.waitForTimeout(800);
      console.log('after accounts.click, url =', page.url());
    } catch (e) {
      console.log('accounts.click failed:', e.message.split('\n')[0]);
    }
    // Dump outerHTML of the Accounts button and its parent chain classes
    const html = await accounts.evaluate((el) => {
      let p = el, chain = [];
      for (let i = 0; i < 4 && p; i++) { chain.push(p.className); p = p.parentElement; }
      return { self: el.outerHTML.slice(0, 200), chain };
    }).catch((e) => ({ error: e.message }));
    console.log('accounts html:', JSON.stringify(html, null, 2).slice(0, 800));
  } finally {
    await browser.close();
  }
})();
