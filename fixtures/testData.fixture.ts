import { QA_PREFIX } from '../helpers/cleanup';

/**
 * Every QA-created record's human-visible name must start with this so a
 * person scanning the real UI can immediately tell it's automation-owned,
 * and so a future bulk-cleanup script can safely target only these records.
 * Never build test data from random/production values — see Phase 9 rules
 * in README.md.
 */
export function qaName(label: string): string {
  const runId = process.env.PLAYWRIGHT_RUN_ID ?? Date.now().toString(36);
  return `${QA_PREFIX}${label}_${runId}`;
}

/** Minimal viable payload for POST /workflow/jobs/jobs (jobs-backend). */
export function buildJobPayload(accountId: string, pipelineId: string) {
  return {
    accounts: [accountId],
    pipeline: pipelineId,
    jobname: qaName('Job'),
    priority: 'Normal',
    description: 'Created by pms-qa-automation — safe to delete.',
  };
}

/**
 * Minimal payload for POST /account/notes (account-note-backend). Extend
 * this file with one builder per domain as new flows/tests are added —
 * keep the shape here in sync with the real controller's accepted fields,
 * don't invent fields that aren't read by the backend.
 */
export function buildNotePayload(accountId: string) {
  return {
    account: accountId,
    title: qaName('Note'),
    content: 'Created by pms-qa-automation — safe to delete.',
  };
}
