import { Page, expect } from '@playwright/test';
import { config } from '../../helpers/config';

export class ClientDashboardPage {
  constructor(private readonly page: Page) {}

  async gotoHome(): Promise<void> {
    await this.page.goto(`${config.client.baseURL}/home`);
  }

  async gotoDocuments(): Promise<void> {
    await this.page.goto(`${config.client.baseURL}/document`);
  }

  async gotoInvoices(): Promise<void> {
    await this.page.goto(`${config.client.baseURL}/billing/invoices`);
  }

  async gotoProposals(): Promise<void> {
    await this.page.goto(`${config.client.baseURL}/proposalsels`);
  }

  async expectOnHome(): Promise<void> {
    await expect(this.page).toHaveURL(/\/home/);
  }
}
