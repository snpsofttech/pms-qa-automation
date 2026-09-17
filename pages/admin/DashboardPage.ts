import { Page, expect } from '@playwright/test';
import { config } from '../../helpers/config';

/**
 * Thin navigation helper over the admin app's route tree (src/App.js).
 * Deliberately not a full page object per module — JobsPage/InvoicePage/
 * DocumentsPage below own their own module-specific locators.
 */
export class DashboardPage {
  constructor(private readonly page: Page) {}

  async gotoInsights(): Promise<void> {
    await this.page.goto(`${config.admin.baseURL}/insights`);
  }

  async gotoJobsList(): Promise<void> {
    await this.page.goto(`${config.admin.baseURL}/jobs/activejob`);
  }

  async gotoAllInvoices(): Promise<void> {
    await this.page.goto(`${config.admin.baseURL}/billing/Invoices`);
  }

  async gotoAllProposals(): Promise<void> {
    await this.page.goto(`${config.admin.baseURL}/billing/proposalsandels`);
  }

  async gotoAccountDocuments(accountId: string): Promise<void> {
    await this.page.goto(
      `${config.admin.baseURL}/clients/accounts/accountsdash/docs/${accountId}/documents`,
    );
  }

  async gotoAccountWorkflow(accountId: string): Promise<void> {
    await this.page.goto(
      `${config.admin.baseURL}/clients/accounts/accountsdash/workflow/${accountId}/activejobs`,
    );
  }

  async expectOnInsights(): Promise<void> {
    await expect(this.page).toHaveURL(/\/insights/);
  }
}
