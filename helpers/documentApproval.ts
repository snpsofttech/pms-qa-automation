import { APIRequestContext, expect } from '@playwright/test';
import { config } from './config';
import { assertNotProduction } from './config';

/**
 * Sets up a client-visible "pending approval" document for an account, entirely
 * via the folder-management + approvals APIs, so a client can then approve it
 * through the portal UI. Mirrors what the admin "Send For Approval" UI does:
 *
 *   1. ensure the firm folder exists ("Firm docs shared with client" — the
 *      approval/signature actions only appear for docs whose path contains
 *      "firm", per the frontend's docType derivation)
 *   2. upload a QA document into it (WITHOUT the accountId form field, which
 *      triggers a server-side notify path that 500s — a backend bug we route
 *      around; the file still lands in the account folder)
 *   3. create the Approval record (status "pending")
 *   4. stamp the file meta with authStatus="pendingApproval" + approvalId,
 *      which is what the client portal reads to list "Documents Awaiting Your
 *      Action". updateStatus returns 500 from post-write audit code, but the
 *      meta write itself lands — so we verify the meta rather than the status.
 *
 * All resources are QA-prefixed and returned for cleanup tracking.
 */
export interface PendingApproval {
  approvalId: string;
  filename: string;
  targetPath: string;
  accountId: string;
}

const FIRM_FOLDER = 'Firm docs shared with client';

function fm(path: string): string {
  return `${config.services.folderManagement}${path}`;
}

export async function setupPendingApproval(
  request: APIRequestContext,
  adminToken: string,
  accountId: string,
  clientEmail: string,
  runId: string,
): Promise<PendingApproval> {
  assertNotProduction('setupPendingApproval (creates documents/approvals)');
  const auth = { Authorization: `Bearer ${adminToken}` };
  const filename = `QA_AUTO_ApprovalDoc_${runId}.txt`;
  const folderPath = `${accountId}/${FIRM_FOLDER}`;
  const targetPath = `${folderPath}/${filename}`;

  // 1. Ensure the firm folder exists (idempotent — ignore "already exists").
  await request
    .post(fm('/accounts/docs/folder'), {
      headers: auth,
      data: { name: FIRM_FOLDER, accountId, parentPath: '' },
    })
    .catch(() => undefined);

  // 2. Upload the document (no accountId field — see note above).
  const uploadRes = await request.post(
    fm(`/accounts/docs/file/upload?folderPath=${encodeURIComponent(folderPath)}`),
    {
      headers: auth,
      multipart: {
        files: {
          name: filename,
          mimeType: 'text/plain',
          buffer: Buffer.from(`QA automated approval document ${runId}\n`),
        },
      },
    },
  );
  expect(uploadRes.status(), `document upload failed: ${uploadRes.status()} ${await uploadRes.text()}`).toBe(201);

  // 3. Create the Approval record.
  const fileUrl = `${config.services.folderManagement}/uploads/accounts/${folderPath}/${filename}`;
  const apRes = await request.post(fm('/approvals/request-approval'), {
    headers: { ...auth, 'Content-Type': 'application/json' },
    data: { accountId, filename, fileUrl, clientEmail, description: 'QA automated approval request' },
  });
  expect(apRes.ok(), `request-approval failed: ${apRes.status()} ${await apRes.text()}`).toBeTruthy();
  const approvalId = (await apRes.json()).approvalId as string;
  expect(approvalId, 'no approvalId returned').toBeTruthy();

  // 4. Stamp the file meta (tolerate the post-write 500; verify below).
  await request
    .post(fm('/accounts/docs/updateStatus'), {
      headers: { ...auth, 'Content-Type': 'application/json' },
      data: { targetPath, status: { authStatus: 'pendingApproval', approvalId }, accountId },
    })
    .catch(() => undefined);

  // Verify the client-visible state actually materialized.
  const listRes = await request.get(
    fm(`/accounts/docs/files/list/clientView?folderPath=${encodeURIComponent(folderPath)}`),
    { headers: auth },
  );
  const listText = await listRes.text();
  expect(
    listText.includes(filename) && listText.includes('"authStatus":"pendingApproval"') && listText.includes(approvalId),
    'file meta was not stamped pendingApproval — client would not see the approval',
  ).toBeTruthy();

  return { approvalId, filename, targetPath, accountId };
}

export async function cleanupPendingApproval(
  request: APIRequestContext,
  adminToken: string,
  pa: PendingApproval,
): Promise<void> {
  assertNotProduction('cleanupPendingApproval');
  const auth = { Authorization: `Bearer ${adminToken}` };
  await request.delete(fm(`/approvals/${pa.approvalId}`), { headers: auth }).catch(() => undefined);
  await request
    .post(fm('/accounts/docs/delete'), {
      headers: { ...auth, 'Content-Type': 'application/json' },
      data: { targetPath: pa.targetPath, accountId: pa.accountId },
    })
    .catch(() => undefined);
}

/** Reads an approval's current status via the API (pending | approved | cancelled). */
export async function getApprovalStatus(
  request: APIRequestContext,
  adminToken: string,
  approvalId: string,
): Promise<string | undefined> {
  const res = await request.get(fm(`/approvals/approvals/${approvalId}`), {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok()) return undefined;
  const body = await res.json();
  return (body?.approval ?? body)?.status as string | undefined;
}
