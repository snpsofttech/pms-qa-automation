/**
 * Marks a test BLOCKED rather than plain SKIPPED — use when the test would
 * have something real to verify, but a prerequisite is missing in this
 * environment (no test data yet, a dependent service down, a known upstream
 * gate like the Gmail-connected-admin requirement on invoice/proposal
 * creation). See CHARTER.md's "Test result states" for the distinction from
 * SKIPPED (deliberately not implemented / deliberately excluded).
 *
 * Works with any of this repo's `test` exports (base Playwright test, or
 * the auth/tenant fixture-extended ones) since they all share the same
 * `skip(condition, reason)` shape.
 */
export function blockTest(testObj: { skip: (condition: boolean, description?: string) => void }, condition: boolean, reason: string): void {
  testObj.skip(condition, `BLOCKED: ${reason}`);
}
