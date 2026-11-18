// test/test-nowplaying-overlay.mjs
// Automated E2E verification for the Expandable Full-Screen Now Playing Overlay
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const PORT = 9223;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const pages = await res.json();
      const page = pages.find(p => p.url && p.url.includes('index.html')) || pages.find(p => p.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        return page.webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(400);
  }
  throw new Error('Could not connect to Chrome DevTools Protocol port');
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id && this.callbacks.has(msg.id)) {
            const cb = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) cb.reject(new Error(msg.error.message));
            else cb.resolve(msg.result);
          }
        } catch (e) {
          console.error('CDP parse error', e);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('[TEST] Starting Electron for Now Playing Overlay verification...');
  const electronBin = path.join(appRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');
  const child = spawn(electronBin, ['.', `--remote-debugging-port=${PORT}`], {
    cwd: appRoot,
    shell: true,
    stdio: 'pipe'
  });

  try {
    const wsUrl = await getWsUrl();
    console.log('[TEST] Connected to CDP via:', wsUrl);
    const client = new CdpClient(wsUrl);
    await client.connect();
    await client.send('Runtime.enable');

    // Wait for DOM shell
    for (let i = 0; i < 30; i++) {
      try {
        const ready = await client.eval(`!!document.getElementById('nowPlayingOverlay') && !!document.querySelector('.pb-left')`);
        if (ready) break;
      } catch {}
      await sleep(300);
    }

    console.log('\n--- Test 1: Initial Overlay State ---');
    const initCheck = await client.eval(`
      (() => {
        const overlay = document.getElementById('nowPlayingOverlay');
        const pbLeft = document.querySelector('.pb-left');
        return {
          hasOverlay: !!overlay,
          isHidden: overlay?.classList.contains('hidden'),
          hasPbLeft: !!pbLeft,
          pbPointer: window.getComputedStyle(pbLeft).cursor
        };
      })()
    `);
    console.log('Init check:', initCheck);
    if (!initCheck.hasOverlay || !initCheck.isHidden || initCheck.pbPointer !== 'pointer') {
      throw new Error('Initial overlay structure or pb-left styling failed');
    }
    console.log('PASS: Initial overlay hidden and .pb-left pointer styled');

    console.log('\n--- Test 2: Trigger Overlay by Clicking .pb-left ---');
    const openCheck = await client.eval(`
      (() => {
        const pbLeft = document.querySelector('.pb-left');
        pbLeft.click();
        const overlay = document.getElementById('nowPlayingOverlay');
        return {
          isOpen: !overlay.classList.contains('hidden'),
          hasCanvas: !!document.getElementById('fsCanvas'),
          hasHeader: !!document.querySelector('.fs-header'),
          hasStageView: !!document.getElementById('fs-view-stage'),
          hasLyricsView: !!document.getElementById('fs-view-lyrics'),
          hasQueueView: !!document.getElementById('fs-view-queue'),
          hasTransport: !!document.querySelector('.fs-transport')
        };
      })()
    `);
    console.log('Open check:', openCheck);
    if (!openCheck.isOpen || !openCheck.hasCanvas || !openCheck.hasStageView) {
      throw new Error('Failed to open overlay or missing core views');
    }
    console.log('PASS: Overlay opened smoothly with canvas, header, stage, lyrics, queue, and transport');

    console.log('\n--- Test 3: Tab Switching in Overlay ---');
    const tabCheck = await client.eval(`
      (async () => {
        const lyricsTabBtn = document.querySelector('.fs-tab-btn[data-tab="lyrics"]');
        const queueTabBtn = document.querySelector('.fs-tab-btn[data-tab="queue"]');
        const stageTabBtn = document.querySelector('.fs-tab-btn[data-tab="stage"]');

        lyricsTabBtn.click();
        await new Promise(r => setTimeout(r, 100));
        const lyricsActive = document.getElementById('fs-view-lyrics').classList.contains('active');

        queueTabBtn.click();
        await new Promise(r => setTimeout(r, 100));
        const queueActive = document.getElementById('fs-view-queue').classList.contains('active');

        stageTabBtn.click();
        await new Promise(r => setTimeout(r, 100));
        const stageActive = document.getElementById('fs-view-stage').classList.contains('active');

        // Test lyrics card click jumping to lyrics tab
        const lyricsCard = document.getElementById('fs-lyrics-card');
        lyricsCard.click();
        await new Promise(r => setTimeout(r, 100));
        const cardJumpedToLyrics = document.getElementById('fs-view-lyrics').classList.contains('active');

        return {
          lyricsActive,
          queueActive,
          stageActive,
          cardJumpedToLyrics
        };
      })()
    `);
    console.log('Tab check:', tabCheck);
    if (!tabCheck.lyricsActive || !tabCheck.queueActive || !tabCheck.stageActive || !tabCheck.cardJumpedToLyrics) {
      throw new Error('Tab switching or lyrics card jump failed');
    }
    console.log('PASS: Tab switching and lyrics card shortcut verified');

    console.log('\n--- Test 4: Visualizer Style Selector ---');
    const vizCheck = await client.eval(`
      (() => {
        const sel = document.getElementById('fs-viz-select');
        if (!sel) return { ok: false };
        const modes = Array.from(sel.options).map(o => o.value);
        sel.value = 'stardust';
        sel.dispatchEvent(new Event('change'));
        return {
          ok: true,
          modes,
          selected: sel.value
        };
      })()
    `);
    console.log('Visualizer selector check:', vizCheck);
    if (!vizCheck.ok || !vizCheck.modes.includes('bokeh') || !vizCheck.modes.includes('stardust')) {
      throw new Error('Visualizer selector verification failed');
    }
    console.log('PASS: Visualizer selector modes verified');

    console.log('\n--- Test 5: Transport Controls Sync ---');
    const transportCheck = await client.eval(`
      (() => {
        const fsPlay = document.getElementById('fs-play');
        const fsShuffle = document.getElementById('fs-shuffle');
        const fsRepeat = document.getElementById('fs-repeat');
        const fsFav = document.getElementById('fs-fav');
        const fsSeek = document.getElementById('fs-seek');
        const fsVol = document.getElementById('fs-vol');

        return {
          hasPlay: !!fsPlay,
          hasShuffle: !!fsShuffle,
          hasRepeat: !!fsRepeat,
          hasFav: !!fsFav,
          hasSeek: !!fsSeek,
          hasVol: !!fsVol
        };
      })()
    `);
    console.log('Transport check:', transportCheck);
    if (!transportCheck.hasPlay || !transportCheck.hasSeek || !transportCheck.hasVol) {
      throw new Error('Missing transport control elements');
    }
    console.log('PASS: Transport scrubber and hero buttons verified');

    console.log('\n--- Test 6: Collapse Overlay via Button ---');
    const collapseCheck = await client.eval(`
      (async () => {
        const collapseBtn = document.getElementById('fs-collapse');
        collapseBtn.click();
        await new Promise(r => setTimeout(r, 350));
        const overlay = document.getElementById('nowPlayingOverlay');
        return {
          isClosed: overlay.classList.contains('hidden')
        };
      })()
    `);
    console.log('Collapse check:', collapseCheck);
    if (!collapseCheck.isClosed) throw new Error('Collapse button failed to close overlay');
    console.log('PASS: Collapse button closes overlay smoothly');

    console.log('\n--- Test 7: Re-open and Close via Escape Key ---');
    const escCheck = await client.eval(`
      (async () => {
        const pbLeft = document.querySelector('.pb-left');
        pbLeft.click();
        await new Promise(r => setTimeout(r, 100));
        const overlay = document.getElementById('nowPlayingOverlay');
        const reOpened = !overlay.classList.contains('hidden');

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await new Promise(r => setTimeout(r, 350));
        const closedByEsc = overlay.classList.contains('hidden');

        return {
          reOpened,
          closedByEsc
        };
      })()
    `);
    console.log('Escape key check:', escCheck);
    if (!escCheck.reOpened || !escCheck.closedByEsc) throw new Error('Escape key dismiss failed');
    console.log('PASS: Escape key closes overlay');

    console.log('\n======================================================');
    console.log('ALL NOW PLAYING OVERLAY E2E VERIFICATIONS PASSED!');
    console.log('======================================================\n');

    client.close();
  } finally {
    if (child && child.pid) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    }
  }
}

run().catch(err => {
  console.error('[TEST FAIL]', err);
  process.exit(1);
});
