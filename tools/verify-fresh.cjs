const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const os = require('os');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9373;
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-fresh-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + profileDir, '--window-size=1700,1900', 'about:blank'
], { stdio: 'ignore' });

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  let targets = [];
  for (let i = 0; i < 60; i++) {
    try { targets = await getJson('http://127.0.0.1:' + PORT + '/json'); if (targets.length) break; } catch (e) {}
    await sleep(200);
  }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  const errs = [];
  await new Promise(r => { ws.onopen = r; });
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    events.push(msg);
    if (msg.method === 'Runtime.exceptionThrown') errs.push((msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text || '').slice(0, 250));
  };
  const send = (method, params = {}) => new Promise(resolve => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  const evalJs = async expr => {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return res.result && res.result.result ? res.result.result.value : undefined;
  };

  // Phase 1: full load (writes cache)
  await send('Page.navigate', { url: 'http://localhost:5173/frontend/data.html' });
  let done = false;
  for (let i = 0; i < 160 && !done; i++) {
    await sleep(2000);
    const s = await evalJs(`(() => document.getElementById('mapRuntime')?.textContent || '')()`);
    if (s && s.includes('已加载')) done = true;
  }
  console.log('phase1 done:', done);
  await sleep(3000);

  // Phase 2: fresh reload — count-verification runs, but no full reload/reset
  events.length = 0;
  await send('Page.navigate', { url: 'http://localhost:5173/frontend/data.html' });
  const samples = [];
  for (let i = 0; i < 8; i++) {
    await sleep(2000);
    const s = await evalJs(`(() => document.querySelector('#visibleWellCount')?.textContent || '')()`);
    samples.push(s);
  }
  const igs = events.filter(e => e.method === 'Network.responseReceived' && e.params && e.params.response && e.params.response.url.includes('/igs/'));
  const pageReqs = igs.filter(e => !e.params.response.url.includes('returnCountOnly'));
  const countReqs = igs.filter(e => e.params.response.url.includes('returnCountOnly'));
  console.log(JSON.stringify({ phase2: { samples, igsTotal: igs.length, pageRequests: pageReqs.length, countRequests: countReqs.length } }, null, 2));

  // Phase 3: ?refresh=1 — restore + silent refresh; wait for completion and verify display update
  events.length = 0;
  await send('Page.navigate', { url: 'http://localhost:5173/frontend/data.html?refresh=1' });
  await sleep(3000);
  const wellsDuring = await evalJs(`(() => document.querySelector('#visibleWellCount')?.textContent || '')()`);
  for (let i = 0; i < 150; i++) {
    await sleep(2000);
    const s = await evalJs(`(() => document.getElementById('mapRuntime')?.textContent || '')()`);
    if (s && s.includes('已加载') && i > 1) break;
  }
  await sleep(3000);
  const wellsAfter = await evalJs(`(() => document.querySelector('#visibleWellCount')?.textContent || '')()`);
  const runtimeAfter = await evalJs(`(() => document.getElementById('mapRuntime')?.textContent || '')()`);
  const igs2 = events.filter(e => e.method === 'Network.responseReceived' && e.params && e.params.response && e.params.response.url.includes('/igs/')).length;
  console.log(JSON.stringify({ phase3: { wellsDuring, wellsAfter, runtimeAfter, igsRequests: igs2 } }, null, 2));
  console.log(JSON.stringify({ errors: errs.slice(0, 8) }, null, 2));
  chrome.kill();
  process.exit(0);
}

main().catch(e => { console.error('ERR', e); chrome.kill(); process.exit(1); });
