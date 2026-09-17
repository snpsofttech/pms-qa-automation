import { Page, expect } from '@playwright/test';

/**
 * src/pages/AccountDashboard/Documents/Documents.js renders the folder/file
 * tree — no data-testid hooks exist, so these rely on visible text. Verify
 * on first real run; the file/folder list is likely NOT a MUI DataGrid here
 * (folder-mangement's API is tree-shaped, not tabular), so no ARIA grid role.
 */
export class DocumentsPage {
  constructor(private readonly page: Page) {}

  async expectDocumentVisible(fileName: string): Promise<void> {
    await expect(this.page.getByText(fileName, { exact: false })).toBeVisible({ timeout: 15_000 });
  }
}
