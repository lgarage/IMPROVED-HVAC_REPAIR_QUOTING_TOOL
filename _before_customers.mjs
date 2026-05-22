import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('https://vertex-core-db.web.app/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(4000);

// Find nav items
const navItems = await page.locator('[data-tab]').all();
const tabs = [];
for (const n of navItems) {
  const tab = await n.getAttribute('data-tab');
  tabs.push(tab);
}
console.log('Tabs:', JSON.stringify(tabs));

// Try clicking customers tab
const custTab = page.locator('[data-tab="customers"]').first();
if (await custTab.isVisible().catch(() => false)) {
  await custTab.click();
  console.log('Clicked customers tab via data-tab attr');
} else {
  console.log('No data-tab=customers found, triggering via JS');
  await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('customers'); });
}
await page.waitForTimeout(3000);
await page.screenshot({ path: '_ss_customers_before.png' });
console.log('Screenshot saved');
await browser.close();
