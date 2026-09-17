import { Page, Locator, expect } from '@playwright/test';
import { config } from '../../helpers/config';

/**
 * src/login-signup/Signin.js — plain HTML inputs, no data-testid/id/name.
 * Unlike the admin login, this one IS a real <form> with a
 * button[type=submit], so Enter-to-submit works, but we click explicitly
 * for consistency and clearer failure traces.
 */
export class ClientLoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.getByRole('button', { name: 'Sign In' });
  }

  async goto(): Promise<void> {
    await this.page.goto(`${config.client.baseURL}/login`);
  }

  async loginAs(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /**
   * The client app requires BOTH a token AND a selected accountId to be
   * considered authenticated (isAuthenticated = !!token && !!accountId).
   * If the QA contact has more than one account, an account-picker step
   * may appear here before the redirect to /home — not yet confirmed
   * against the live UI; add a picker step to this method if so.
   */
  async expectLoggedIn(): Promise<void> {
    await expect(this.page).toHaveURL(/\/home/, { timeout: 15_000 });
  }
}
