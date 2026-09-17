import fs from 'fs';
import path from 'path';
import { TestInfo } from '@playwright/test';
import { config } from './config';

/**
 * See CHARTER.md. This repo's only output for a failure is a report like
 * this one — never a fix. `classification` is the QA-facing triage bucket;
 * `status` is how confident we are in that classification.
 */
export type FailureClassification =
  | 'APPLICATION_BUG'
  | 'QA_BUG'
  | 'ENVIRONMENT_ISSUE'
  | 'EXPECTED_BEHAVIOR';

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type BugStatus = 'Confirmed' | 'Suspected' | 'Blocked' | 'Needs Investigation';

export interface BugReport {
  priority: Priority;
  title: string;
  /** Defaults to the current TEST_ENV if omitted. */
  environment?: string;
  repository: string;
  file?: string;
  functionOrComponent?: string;
  endpointOrUiLocation: string;
  stepsToReproduce: string[];
  expectedBehavior: string;
  actualBehavior: string;
  errorMessage?: string;
  /** Only set this when the source investigation actually confirmed a cause — leave undefined otherwise. */
  rootCause?: string;
  evidence: string[];
  /** Defaults to the calling test's full title path if omitted. */
  testCase?: string;
  status: BugStatus;
  classification: FailureClassification;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function renderMarkdown(report: Required<Pick<BugReport, 'environment' | 'testCase'>> & BugReport): string {
  return `# ${report.title}

- **Priority**: ${report.priority}
- **Classification**: ${report.classification}
- **Status**: ${report.status}
- **Environment**: ${report.environment}
- **Repository**: ${report.repository}
${report.file ? `- **File**: ${report.file}\n` : ''}${report.functionOrComponent ? `- **Function/Component**: ${report.functionOrComponent}\n` : ''}- **Endpoint/UI location**: ${report.endpointOrUiLocation}
- **Test case**: ${report.testCase}

## Steps to reproduce
${report.stepsToReproduce.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Expected behavior
${report.expectedBehavior}

## Actual behavior
${report.actualBehavior}
${report.errorMessage ? `\n## Error message\n\`\`\`\n${report.errorMessage}\n\`\`\`\n` : ''}${report.rootCause ? `\n## Root cause\n${report.rootCause}\n` : ''}
## Evidence
${report.evidence.map((e) => `- ${e}`).join('\n')}

---
Generated ${new Date().toISOString()} by pms-qa-automation. This report
documents a finding — the QA suite does not and will not fix it. See
CHARTER.md.
`;
}

/**
 * Writes a bug report to bug-reports/<slug>-<timestamp>.md and returns its
 * path. Call this directly for reports generated outside a running test
 * (e.g. a manual investigation script); inside a test, prefer
 * attachBugReport() so the report is also linked from the HTML report.
 */
export function writeBugReport(report: BugReport): string {
  const environment = report.environment ?? config.env;
  const testCase = report.testCase ?? '(not run from a test)';
  const dir = path.resolve(__dirname, '..', 'bug-reports');
  fs.mkdirSync(dir, { recursive: true });
  // Stable filename derived from the title, deliberately WITHOUT a
  // timestamp: a finding is one bug, and re-running the suite should
  // refresh that bug's report in place, not pile up a new copy each time.
  // (An earlier timestamped version produced four files for two findings
  // after four runs.) The observation time lives inside the file instead.
  const filePath = path.join(dir, `${slugify(report.title)}.md`);
  fs.writeFileSync(filePath, renderMarkdown({ ...report, environment, testCase }));
  return filePath;
}

/**
 * Use this inside a test when you've already identified and want to
 * precisely classify a failure — see tests/api/tenancy/known-gaps.spec.ts
 * for a worked example. Fills `environment`/`testCase` from the running
 * test automatically, writes the report file, and attaches it to the
 * Playwright HTML report so it's visible right next to the trace/screenshot.
 * Call this BEFORE any `expect()` that might throw, so the report is
 * captured even though the test itself still fails afterward.
 */
export function attachBugReport(testInfo: TestInfo, report: BugReport): string {
  const filePath = writeBugReport({
    ...report,
    environment: report.environment ?? config.env,
    testCase: report.testCase ?? testInfo.titlePath.slice(1).join(' > '),
  });
  testInfo.attach('bug-report', { path: filePath, contentType: 'text/markdown' });
  return filePath;
}
