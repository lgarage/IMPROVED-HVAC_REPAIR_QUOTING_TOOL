import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('https://vertex-core-db.web.app/index.html?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(9000);
// Scroll down to see map + warning
await page.evaluate(() => window.scrollTo(0, 400));
await page.waitForTimeout(500);
await page.screenshot({ path: '_ss_map_area.png' });
console.log('Done');
await browser.close();
