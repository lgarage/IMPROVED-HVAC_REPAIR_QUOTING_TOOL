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

// Check BUILD stamp
const build = await page.evaluate(() => window.VC_BUILD);
console.log('VC_BUILD:', build);

// Check function exists
const hasFn = await page.evaluate(() => typeof syncComposerClearance === 'function');
console.log('syncComposerClearance exists:', hasFn);

// Switch to workspace
await page.evaluate(() => {
  if (typeof switchScreen === 'function') switchScreen('workspace');
  document.body.classList.add('ws-active');
});
await page.waitForTimeout(600);

// Re-run clearance to make sure it fires after ws-active
await page.evaluate(() => {
  if (typeof syncComposerClearance === 'function') syncComposerClearance();
});
await page.waitForTimeout(300);

// Inject mock messages
await page.evaluate(() => {
  const stream = document.getElementById('ct-message-stream');
  if (!stream) return;
  stream.innerHTML = '';
  for (let i = 1; i <= 14; i++) {
    const div = document.createElement('div');
    div.className = 'ct-message ct-message--tech';
    div.textContent = `Message ${i}: Compressor is running hot, freon levels low, checking capacitor now.`;
    const meta = document.createElement('span');
    meta.className = 'ct-message__meta';
    meta.textContent = `May 19, 2026, 10:${String(i).padStart(2,'0')} AM`;
    div.appendChild(meta);
    stream.appendChild(div);
  }
  const last = document.createElement('div');
  last.className = 'ct-message ct-message--tech';
  last.style.background = '#ef4444';
  last.style.color = '#fff';
  last.id = 'last-msg-check';
  last.textContent = '>>> LAST MESSAGE — must be above composer <<<';
  const meta = document.createElement('span');
  meta.className = 'ct-message__meta';
  meta.textContent = 'May 19, 2026, 10:15 AM';
  last.appendChild(meta);
  stream.appendChild(last);
  const msgList = document.getElementById('ct-message-list');
  if (msgList) msgList.scrollTop = msgList.scrollHeight;
});
await page.waitForTimeout(400);

const m = await page.evaluate(() => {
  const dock = document.getElementById('ct-composer-dock');
  const lastMsg = document.getElementById('last-msg-check');
  const msgList = document.getElementById('ct-message-list');
  const r = (el) => el ? el.getBoundingClientRect() : null;
  return {
    dock: r(dock),
    lastMsg: r(lastMsg),
    dockOffsetHeight: dock ? dock.offsetHeight : null,
    msgListPaddingBottom: msgList ? window.getComputedStyle(msgList).paddingBottom : null,
    cssVar: getComputedStyle(document.documentElement).getPropertyValue('--vc-chat-scroll-clearance').trim(),
  };
});
console.log('\nMeasurements (deployed):', JSON.stringify(m, null, 2));
if (m.lastMsg && m.dock) {
  const gap = m.dock.top - m.lastMsg.bottom;
  console.log(`\nGap (positive = clear): ${gap.toFixed(1)}px`);
  console.log(gap >= 0 ? '✅ No overlap' : '❌ Overlap detected');
}

await page.screenshot({ path: '_ss_after13_workspace.png' });
await browser.close();
