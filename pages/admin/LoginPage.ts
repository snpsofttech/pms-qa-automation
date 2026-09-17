import { Page, Locator, expect } from '@playwright/test';
import { config } from '../../helpers/config';

/**
 * src/login-signup/Login.js has no data-testid/id/aria-label anywhere, so
 * these locators use `name` attributes and visible role/text — the most
 * stable hooks that actually exist in the current markup.
 *
 * The form has FOUR required inputs, not two. Client-side validation
 * (Login.js:481 and :489) rejects the submit unless an expiry duration is
 * selected and the terms checkbox is ticked, so a Playwright login that
 * only fills email+password silently stays on /login with a toast.
 *
 * The submit control is a plain <button onClick=...>, NOT type="submit"
 * and NOT inside a <form>, so pressing Enter does nothing — always click.
 */
export class AdminLoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly durationSelect: Locator;
  readonly termsCheckbox: Locator;
  readonly loginButton: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.durationSelect = page.getByRole('combobox');
    this.termsCheckbox = page.getByRole('checkbox');
    this.loginButton = page.getByRole('button', { name: 'Login' });
  }

  async goto(): Promise<void> {
    // Always an absolute URL: the app lives under a base path (/admin/), and
    // a leading-slash relative goto() would resolve against the origin and
    // land on nginx's default page instead.
    await this.page.goto(`${config.admin.baseURL}/login`);
  }

  /**
   * `duration` is the visible option label — one of "1 minute", "5 minutes",
   * "30 minutes", "4 hours", "8 hours". Defaults to the longest so a token
   * can't expire mid-suite (the backend defaults to 30min when unset).
   */
  async loginAs(email: string, password: string, duration = '8 hours'): Promise<void> {
    await this.emailInput.fill(email);
    // Blur fires getUsersByEmail, which resolves the account and can open a
    // picker for multi-account emails — let it settle before continuing.
    await this.passwordInput.click();
    await this.passwordInput.fill(password);

    // Radix Select: click the trigger, then pick the option from the popup.
    await this.durationSelect.click();
    await this.page.getByRole('option', { name: duration }).click();

    await this.termsCheckbox.check();
    await this.loginButton.click();
  }

  /** Waits for the post-login redirect. Default target is /insights. */
  async expectLoggedIn(): Promise<void> {
    await expect(this.page).toHaveURL(/\/insights/, { timeout: 15_000 });
  }
}
