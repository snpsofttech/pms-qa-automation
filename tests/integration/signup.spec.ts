import { test, expect } from '@playwright/test';
import { config } from '../../helpers/config';
import { clearOtp, waitForOtp, OTP_FILE_PATH } from '../../helpers/otpRelay';

/**
 * New-user signup / firm registration (staging only). Drives the 9-step
 * signup wizard end to end. The OTP is emailed and can't be read
 * programmatically, so it's RELAYED: the test sends the OTP, prints where it
 * went, and polls qa-data/otp.txt until the operator pastes the 6-digit code.
 *
 * Run it, then when the console says "OTP SENT", open the inbox for the
 * SIGNUP_EMAIL below and paste the code into qa-data/otp.txt (save). The test
 * continues automatically.
 *
 * NOTE: signup creates a brand-new QA firm/tenant on staging (additive, not
 * destructive). There is no admin-account delete API, so each run leaves a
 * QA-prefixed tenant behind — that's expected.
 *
 *   VIDEO=on SLOWMO=500 TEST_ENV=staging npx playwright test \
 *     tests/integration/signup.spec.ts --project=integration
 */
const RUN = Date.now().toString(36);
const SIGNUP_EMAIL = `vardhan.kulkarni18+qa.signup.${RUN}@gmail.com`;
const FIRM_NAME = `QA Automation Firm ${RUN}`;
const FIRM_URL = `qaauto${RUN}`; // firmURL is unique per tenant
const PASSWORD = 'Test@1234';

test.describe('New user signup', () => {
  test.setTimeout(660_000); // generous — includes the human OTP relay wait

  test('a new user registers a firm through the signup wizard (OTP relayed)', async ({ page }) => {
    const beat = () => page.waitForTimeout(Number(process.env.STEP_PAUSE ?? 1500));
    clearOtp();

    await test.step('1. Enter email + accept terms → send OTP', async () => {
      await page.goto(`${config.admin.baseURL}/signup`);
      await expect(page.getByRole('heading', { name: 'Signup' })).toBeVisible({ timeout: 20_000 });
      await page.getByPlaceholder('Enter Your Email').fill(SIGNUP_EMAIL);
      await page.getByRole('checkbox').first().check();
      await page.getByRole('button', { name: 'Create Account' }).click();
      await expect(page.getByRole('heading', { name: 'Confirmation Code' })).toBeVisible({ timeout: 30_000 });
    });

    await test.step('2. Verify OTP (relayed by operator)', async () => {
      // eslint-disable-next-line no-console
      console.log(
        `\n\n================ OTP SENT ================\n` +
          `Sent to: ${SIGNUP_EMAIL}\n` +
          `Paste the 6-digit code into:\n  ${OTP_FILE_PATH}\n` +
          `and save. Waiting up to 9 minutes...\n` +
          `=========================================\n`,
      );
      const otp = await waitForOtp(540_000);
      const boxes = page.locator('input[aria-label^="Please enter OTP character"]');
      for (let i = 0; i < 6; i++) await boxes.nth(i).fill(otp[i]);
      await page.getByRole('button', { name: 'Verify' }).click();
      await expect(page.getByRole('heading', { name: 'Your Information' })).toBeVisible({ timeout: 30_000 });
      await beat();
    });

    await test.step('3. Your information', async () => {
      await page.getByPlaceholder('First Name').fill('QA');
      await page.getByPlaceholder('Middle Name').fill('Auto');
      await page.getByPlaceholder('Last Name').fill('Signup');
      await page.getByPlaceholder('Enter phone number').fill('2025550123');
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'Firm Information' })).toBeVisible({ timeout: 20_000 });
      await beat();
    });

    await test.step('4. Firm information (name, country, state)', async () => {
      await page.getByPlaceholder('Enter firm name').fill(FIRM_NAME);
      // Country then State are Radix Selects (portaled options).
      await page.getByRole('combobox').nth(0).click();
      await page.getByRole('option', { name: 'United States', exact: true }).click();
      await page.getByRole('combobox').nth(1).click();
      await page.getByRole('option', { name: 'California', exact: true }).click();
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'Firm details' })).toBeVisible({ timeout: 20_000 });
      await beat();
    });

    await test.step('5. Firm details (size + how did you hear)', async () => {
      // Firm size defaults to 1 (valid). Pick a "how did you hear" option.
      await page.getByRole('button', { name: 'Google search', exact: true }).click();
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'Services your firm offers' })).toBeVisible({ timeout: 20_000 });
      await beat();
    });

    await test.step('6. Services offered', async () => {
      await page.getByRole('button', { name: 'Tax Preparation', exact: true }).click();
      await page.getByRole('button', { name: 'Accounting', exact: true }).click();
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'Your role in the firm' })).toBeVisible({ timeout: 20_000 });
      await beat();
    });

    await test.step('7. Role in the firm', async () => {
      await page.getByRole('button', { name: 'Admin', exact: true }).click();
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'Firm Settings' })).toBeVisible({ timeout: 20_000 });
      await beat();
    });

    await test.step('8. Firm settings (URL, currency, language)', async () => {
      await page.getByPlaceholder('Enter your URL').fill(FIRM_URL);
      await page.getByRole('combobox').nth(0).click();
      await page.getByRole('option', { name: 'USD - USD', exact: true }).click();
      await page.getByRole('combobox').nth(1).click();
      await page.getByRole('option', { name: 'English(British)', exact: true }).click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByRole('heading', { name: 'Set Password' })).toBeVisible({ timeout: 20_000 });
      await beat();
    });

    await test.step('9. Set password → registration complete', async () => {
      await page.getByPlaceholder('Password', { exact: true }).fill(PASSWORD);
      await page.getByPlaceholder('Confirm Password').fill(PASSWORD);
      await page.getByRole('button', { name: 'Complete Registration' }).click();
      // Success → redirect to /login after a ~2s toast.
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
      await beat();
    });
  });
});
