import { Page, expect } from '@playwright/test';

/**
 * Navigate the admin app via its backend-driven sidebar (GET /api/sidebar).
 * The admin access token lives only in an in-memory JS variable (see
 * ARCHITECTURE.md), so a page reload logs the user out — navigation MUST be
 * click-based through the sidebar, never `page.goto` to a deep link.
 *
 * The sidebar settles slowly and a leaf can be in the DOM but clipped to ~0
 * height until its group is expanded, so we poll on the real rendered height:
 * click the leaf directly if the group is already open (clicking the parent
 * again would collapse it), otherwise expand the parent first.
 *
 * Extracted from the business-workflow spec, where it was proven live.
 */
export async function navSidebar(
  page: Page,
  parent: string,
  leaf: string,
  urlRe: RegExp,
): Promise<void> {
  const parentBtn = page.getByRole('button', { name: parent, exact: true });
  const leafBtn = page.getByRole('button', { name: leaf, exact: true });
  await parentBtn.waitFor({ state: 'visible', timeout: 20_000 });

  const navigated = () =>
    page.waitForURL(urlRe, { timeout: 5_000 }).then(() => true).catch(() => false);

  const box = await leafBtn.boundingBox().catch(() => null);
  if (box && box.height > 10) {
    await leafBtn.click({ force: true, timeout: 5_000 }).catch(() => {});
    if (await navigated()) return;
  }

  await parentBtn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1_000);
  try {
    await leafBtn.click({ timeout: 8_000 });
  } catch {
    await leafBtn.scrollIntoViewIfNeeded().catch(() => {});
    await leafBtn.click({ force: true, timeout: 5_000 });
  }
  await expect(page).toHaveURL(urlRe, { timeout: 15_000 });
}
