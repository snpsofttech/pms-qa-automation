import fs from 'fs';
import path from 'path';

/**
 * File-based OTP relay for the signup flow. The signup OTP is emailed and
 * cannot be read programmatically without inbox access, so a human relays it:
 * the test prints where the OTP was sent, then polls this file until a 6-digit
 * code appears. The operator pastes the code they received into the file.
 *
 *   1. clearOtp() at the start (removes any stale code)
 *   2. the test triggers send-otp, prints OTP_FILE_PATH
 *   3. operator writes the 6-digit code into that file and saves
 *   4. waitForOtp() returns the code
 */
export const OTP_FILE_PATH = path.resolve(__dirname, '..', 'qa-data', 'otp.txt');

export function clearOtp(): void {
  fs.mkdirSync(path.dirname(OTP_FILE_PATH), { recursive: true });
  fs.writeFileSync(OTP_FILE_PATH, '');
}

export async function waitForOtp(timeoutMs = 300_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const content = fs.existsSync(OTP_FILE_PATH) ? fs.readFileSync(OTP_FILE_PATH, 'utf-8') : '';
    const m = content.match(/\b(\d{6})\b/);
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(
    `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for a 6-digit OTP in ${OTP_FILE_PATH}. ` +
      `Paste the emailed code into that file and save.`,
  );
}
