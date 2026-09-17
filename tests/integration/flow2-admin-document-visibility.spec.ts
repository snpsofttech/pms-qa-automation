import { test } from '../../fixtures/auth.fixture';

/**
 * Critical flow 2: Admin Upload Document -> Verify Document Appears ->
 * Verify Correct Client Visibility.
 *
 * NOT YET IMPLEMENTED — blocked on two unconfirmed facts that the "inspect
 * before writing selectors" rule means shouldn't be guessed:
 *   1. The admin Documents page (src/pages/AccountDashboard/Documents/
 *      Documents.js) upload control's selector — no data-testid exists and
 *      the recon pass didn't render the app to observe the real DOM.
 *   2. folder-mangement's exact multipart upload contract for
 *      `POST /accounts/docs/file/upload` (field name for the file, required
 *      metadata fields) — recon only confirmed the route exists, not its
 *      request shape.
 *
 * To unblock: run the admin app locally, open DevTools while uploading a
 * document by hand once, capture (a) the upload button/input's DOM and
 * (b) the resulting network request body, then fill in DocumentsPage.ts
 * and this spec. See README.md "Recommended next 10 QA tests" item on this.
 */
test.describe('Critical flow 2 — Admin document upload + client visibility', () => {
  test.fixme('admin uploads a document, it appears in the list, and only the correct client can see it', async () => {
    // Intentionally empty — see the blocker notes above.
  });
});
