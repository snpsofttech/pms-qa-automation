import { test } from '../../fixtures/auth.fixture';

/**
 * Critical flow 4: Admin Create Proposal -> Client -> Verify Proposal
 * Accessible.
 *
 * NOT YET IMPLEMENTED — same Gmail-connected-admin gate as flow3, this time
 * on POST /account/proposals (controllers/accountProposalController.js:845).
 * See flow3-invoice-to-client.spec.ts for the full explanation and the two
 * ways to unblock it. The `/api/proposals` endpoint (controllers/
 * proposalController.js) does NOT have this gate, so if the real user flow
 * for "send a proposal to a client" goes through that route instead of
 * `/account/proposals/`, this flow may be unblocked already — confirm which
 * endpoint the admin UI's proposal-creation form actually calls before
 * assuming either path.
 */
test.describe('Critical flow 4 — Admin proposal creation, client visibility', () => {
  test.fixme('admin creates a proposal and the client can access it', async () => {
    // Intentionally empty — see the blocker notes above.
  });
});
