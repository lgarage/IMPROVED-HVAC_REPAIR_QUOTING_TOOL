import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('https://vertex-core-db.web.app/index.html?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(6000);
const build = await page.evaluate(() => window.VC_BUILD || 'unknown');
console.log('Build:', build);
// Count board cards vs map pins
const boardCards = await page.locator('#serviceRequestList .glass-card').count();
console.log('Service board cards:', boardCards);
const mapPins = await page.locator('.custom-leaflet-marker').count();
console.log('Map pins:', mapPins);
await page.screenshot({ path: '_ss_map_before.png', clip: { x: 380, y: 370, width: 640, height: 380 } });
console.log('Screenshot saved');
await browser.close();
