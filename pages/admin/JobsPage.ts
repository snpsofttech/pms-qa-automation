import { Page, expect } from '@playwright/test';

/**
 * NOTE: the jobs list is rendered via @mui/x-data-grid (per package.json).
 * These locators use the grid's ARIA roles, which MUI X DataGrid renders
 * consistently (role="grid" / role="row" / role="gridcell") — more stable
 * than styling hooks, but still unverified against the live DOM since the
 * recon pass didn't render the app. Confirm on first real run and adjust
 * if MUI's version here diverges.
 */
export class JobsPage {
  constructor(private readonly page: Page) {}

  get grid() {
    return this.page.getByRole('grid');
  }

  async expectJobVisible(jobName: string): Promise<void> {
    await expect(this.grid.getByText(jobName, { exact: false })).toBeVisible({ timeout: 15_000 });
  }

  async expectJobNotVisible(jobName: string): Promise<void> {
    await expect(this.grid.getByText(jobName, { exact: false })).toHaveCount(0);
  }
}
