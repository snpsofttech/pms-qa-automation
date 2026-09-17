import { Page, expect } from '@playwright/test';

/** Same MUI DataGrid caveat as JobsPage.ts — verify locators on first real run. */
export class InvoicePage {
  constructor(private readonly page: Page) {}

  get grid() {
    return this.page.getByRole('grid');
  }

  async expectInvoiceVisible(invoiceNumberOrLabel: string): Promise<void> {
    await expect(this.grid.getByText(invoiceNumberOrLabel, { exact: false })).toBeVisible({ timeout: 15_000 });
  }
}
