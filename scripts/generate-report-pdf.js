// Renders PMS-QA-Security-Report.html to PDF using the Playwright Chromium
// that is already installed in this repo — no external tools (wkhtmltopdf,
// pandoc, LaTeX) required. Run: node scripts/generate-report-pdf.js
const path = require('path');
const { chromium } = require('@playwright/test');

(async () => {
  const root = path.resolve(__dirname, '..');
  const htmlPath = 'file://' + path.join(root, 'PMS-QA-Security-Report.html');
  const outPath = path.join(root, 'PMS-QA-Security-Report.pdf');

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(htmlPath, { waitUntil: 'networkidle' });
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#8a94a3;padding:0 14mm;text-align:right;">' +
        'PMS QA Automation &amp; Security Report · page <span class="pageNumber"></span> / <span class="totalPages"></span>' +
        '</div>',
    });
    console.log('PDF written to', outPath);
  } finally {
    await browser.close();
  }
})();
