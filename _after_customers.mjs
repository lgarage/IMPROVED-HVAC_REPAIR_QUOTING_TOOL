import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
// Bypass cache
await ctx.addInitScript(() => {
  const orig = window.fetch;
  window.fetch = (url, opts = {}) => orig(url, { ...opts, cache: 'no-store' });
});
await page.goto('https://vertex-core-db.web.app/index.html?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(5000);

const build = await page.evaluate(() => window.VC_BUILD || 'unknown');
console.log('Build:', build);

// Trigger switchTab to customers
try {
  await page.evaluate(() => switchTab('customers'));
  console.log('switchTab("customers") called successfully');
} catch(e) {
  console.error('switchTab error:', e.message);
}
await page.waitForTimeout(3000);
await page.screenshot({ path: '_ss_customers_after.png' });
console.log('Screenshot saved');
await browser.close();
