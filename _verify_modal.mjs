import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('https://vertex-core-db.web.app/index.html?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 15000 });
// Wait for cloud data + service calls to load
await page.waitForTimeout(6000);

const build = await page.evaluate(() => window.VC_BUILD || 'unknown');
console.log('Build:', build);

// Click the Customers nav item directly
await page.locator('#nav-customers').click();
await page.waitForTimeout(2000);

// Check if modal is visible
const modalVisible = await page.locator('#customerModal').isVisible().catch(() => false);
console.log('Modal visible:', modalVisible);

await page.screenshot({ path: '_ss_modal_restored.png' });
console.log('Screenshot done');

// Check which customers are in the table
const rows = await page.locator('#customerDirectoryBody tr.customer-row').all();
console.log('Customer rows:', rows.length);
for (const row of rows) {
  const text = await row.locator('td').first().textContent();
  console.log(' -', text?.trim());
}

await browser.close();
