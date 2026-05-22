import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('https://vertex-core-db.web.app/index.html?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(6000);

// Inspect ticket data to understand why some are missing
const info = await page.evaluate(() => {
  const db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
  const currentBoardView = window.currentBoardView || 'day';
  const dateInput = document.getElementById('boardDateSelector')?.value || '';
  return db.filter(sc => !sc.archived && sc.status !== 'Completed' && sc.status !== 'Canceled')
    .map(sc => ({
      id: sc.id,
      customer: sc.customerName,
      address: sc.locationAddress,
      city: sc.custCity,
      state: sc.custState,
      date: sc.date,
      status: sc.status,
      assignedTech: sc.assignedTech,
      geoLat: sc.geoLat,
      geoLng: sc.geoLng,
      boardView: currentBoardView,
      boardDate: dateInput,
    }));
});

console.log('Active tickets:', JSON.stringify(info, null, 2));
await browser.close();
