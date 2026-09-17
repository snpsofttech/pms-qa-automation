// Generic HTML -> PDF renderer using the repo's Playwright Chromium.
// Usage: node scripts/html-to-pdf.js <input.html> <output.pdf> ["footer label"]
const path = require('path');
const { chromium } = require('@playwright/test');

(async () => {
  const [, , inArg, outArg, label] = process.argv;
  if (!inArg || !outArg) {
    console.error('Usage: node scripts/html-to-pdf.js <input.html> <output.pdf> ["footer label"]');
    process.exit(1);
  }
  const root = path.resolve(__dirname, '..');
  const htmlPath = 'file://' + path.resolve(root, inArg);
  const outPath = path.resolve(root, outArg);
  const footer = label || 'PMS QA Automation';

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
        footer +
        ' · page <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
    console.log('PDF written to', outPath);
  } finally {
    await browser.close();
  }
})();
