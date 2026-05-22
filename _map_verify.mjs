import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('https://vertex-core-db.web.app/index.html?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(9000); // extra time for geocoding
const build = await page.evaluate(() => window.VC_BUILD || 'unknown');
console.log('Build:', build);
const boardCards = await page.locator('#serviceRequestList .glass-card').count();
console.log('Service board cards:', boardCards);
const mapPins = await page.locator('.custom-leaflet-marker').count();
console.log('Map pins (after fix):', mapPins);
// Check warning banner
const warningVisible = await page.locator('#mapGeoWarning').isVisible().catch(() => false);
const warningText = warningVisible ? await page.locator('#mapGeoWarning').textContent() : 'hidden';
console.log('Warning banner:', warningText);
// Full page screenshot
await page.screenshot({ path: '_ss_map_verify.png' });
console.log('Screenshot saved');
await browser.close();
