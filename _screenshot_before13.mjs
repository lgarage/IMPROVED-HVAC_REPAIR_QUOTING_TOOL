import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('https://vertex-core-db.web.app/technician/index.html?vc_debug=0', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(3000);
await page.locator('select').first().selectOption({ label: 'DAN DAY' });
await page.waitForTimeout(500);
await page.locator('#loginContinueBtn').click({ timeout: 5000 });
await page.waitForTimeout(4000);

// Navigate directly to workspace via JS, inject mock messages
await page.evaluate(() => {
  // Switch to workspace screen
  if (typeof switchScreen === 'function') switchScreen('workspace');
  document.body.classList.add('ws-active');
});
await page.waitForTimeout(500);

// Inject mock messages to fill the chat
await page.evaluate(() => {
  const stream = document.getElementById('ct-message-stream');
  if (!stream) return;
  stream.innerHTML = '';
  for (let i = 1; i <= 14; i++) {
    const div = document.createElement('div');
    div.className = 'ct-message ct-message--tech';
    div.textContent = `Message ${i}: Tech note about the HVAC unit. Compressor is running hot, freon levels low.`;
    const meta = document.createElement('span');
    meta.className = 'ct-message__meta';
    meta.textContent = `May 19, 2026, 10:${String(i).padStart(2,'0')} AM`;
    div.appendChild(meta);
    stream.appendChild(div);
  }
  // Add a final message labelled LAST so we can see if it's hidden
  const last = document.createElement('div');
  last.className = 'ct-message ct-message--tech';
  last.style.background = '#ef4444';
  last.style.color = '#fff';
  last.id = 'last-msg-check';
  last.textContent = '>>> LAST MESSAGE (should be fully visible above composer) <<<';
  const meta = document.createElement('span');
  meta.className = 'ct-message__meta';
  meta.textContent = 'May 19, 2026, 10:15 AM';
  last.appendChild(meta);
  stream.appendChild(last);
  
  // Scroll to bottom
  const msgList = document.getElementById('ct-message-list');
  if (msgList) {
    msgList.scrollTop = msgList.scrollHeight;
  }
});
await page.waitForTimeout(500);

// Measure elements
const measurements = await page.evaluate(() => {
  const msgList = document.getElementById('ct-message-list');
  const dock = document.getElementById('ct-composer-dock');
  const lastMsg = document.getElementById('last-msg-check');
  const bar = document.getElementById('ct-action-bar');
  
  const r = (el) => el ? el.getBoundingClientRect() : null;
  
  return {
    msgList: r(msgList),
    dock: r(dock),
    lastMsg: r(lastMsg),
    bar: r(bar),
    scrollTop: msgList ? msgList.scrollTop : 0,
    scrollHeight: msgList ? msgList.scrollHeight : 0,
    clientHeight: msgList ? msgList.clientHeight : 0,
    msgListComputedPaddingBottom: msgList ? window.getComputedStyle(msgList).paddingBottom : null,
  };
});

console.log('Measurements:');
console.log(JSON.stringify(measurements, null, 2));

if (measurements.lastMsg && measurements.dock) {
  const overlap = measurements.dock.top - measurements.lastMsg.bottom;
  console.log(`\nLast message bottom: ${measurements.lastMsg.bottom.toFixed(1)}px`);
  console.log(`Dock top: ${measurements.dock.top.toFixed(1)}px`);
  console.log(`Gap (positive=clear, negative=overlap): ${overlap.toFixed(1)}px`);
}

await page.screenshot({ path: '_ss_before13_workspace.png' });
await browser.close();
