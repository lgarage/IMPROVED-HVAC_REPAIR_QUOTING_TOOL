import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('https://vertex-core-db.web.app/index.html?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(8000); // extra time for geocoding + map render
const build = await page.evaluate(() => window.VC_BUILD || 'unknown');
console.log('Build:', build);
const boardCards = await page.locator('#serviceRequestList .glass-card').count();
console.log('Service board cards:', boardCards);
const mapPins = await page.locator('.custom-leaflet-marker').count();
console.log('Map pins:', mapPins);
// Full page screenshot showing both board and map
await page.screenshot({ path: '_ss_map_after_full.png' });
// Zoomed map crop
await page.screenshot({ path: '_ss_map_after.png', clip: { x: 380, y: 370, width: 640, height: 380 } });
console.log('Screenshots saved');
await browser.close();
