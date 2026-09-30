import { Page } from '@playwright/test';

/**
 * Open an item from the admin header's global "+" quick-create menu.
 * Items (confirmed live): Account, Contact, Jobs, Proposal, Invoice, Task,
 * Chat, Offline Payment. The menu is a Radix popover; its items aren't
 * role=menuitem, so we click the exact-text entry inside the popover.
 */
export async function openQuickCreate(page: Page, item: string): Promise<void> {
  await page.getByRole('button', { name: '+', exact: true }).click();
  await page.waitForTimeout(400);
  await page
    .locator('[data-radix-popper-content-wrapper], [role=menu], [role=dialog]')
    .getByText(item, { exact: true })
    .first()
    .click({ force: true });
}
