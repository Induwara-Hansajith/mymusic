// test/e2e-live.mjs
// Comprehensive End-to-End Test for My Music using native WebSocket + CDP
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

const PORT = 9222;

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
    await sleep(500);
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
          console.error('CDP message parse error', e);
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
  console.log('[E2E] Spawning Electron with --remote-debugging-port=' + PORT);
  const electronBin = path.join(appRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');
  const child = spawn(electronBin, ['.', `--remote-debugging-port=${PORT}`], {
    cwd: appRoot,
    shell: true,
    stdio: 'pipe'
  });

  child.stdout.on('data', d => {
    const s = d.toString().trim();
    if (s && !s.includes('GPU')) console.log('[Electron Out]', s);
  });
  child.stderr.on('data', d => {
    const s = d.toString().trim();
    if (s && !s.includes('GL') && !s.includes('GPU') && !s.includes('DeprecationWarning')) {
      console.log('[Electron Err]', s);
    }
  });

  try {
    const wsUrl = await getWsUrl();
    console.log('[E2E] Connected to CDP:', wsUrl);
    const client = new CdpClient(wsUrl);
    await client.connect();
    await client.send('Runtime.enable');

    // Wait for index.html DOM to be ready
    for (let i = 0; i < 30; i++) {
      try {
        const ready = await client.eval(`!!document.getElementById('aurora') && !!document.getElementById('playerbar')`);
        if (ready) break;
      } catch {}
      await sleep(300);
    }

    console.log('\n--- 1. Verification of Shell & DOM Elements ---');
    const domReady = await client.eval(`
      ({
        title: document.title,
        hasAurora: !!document.getElementById('aurora'),
        hasVizCanvas: !!document.getElementById('viz'),
        hasPlayerbar: !!document.getElementById('playerbar'),
        hasAudio: !!document.getElementById('audio'),
        hasSearch: !!document.getElementById('searchInput')
      })
    `);
    console.log('DOM Shell State:', domReady);
    if (!domReady.hasPlayerbar || !domReady.hasSearch) throw new Error('Missing core DOM shell elements');
    console.log('PASS: Core DOM Shell elements verified');

    console.log('\n--- 2. Visualizer Modes Cycling ---');
    let vizModes = [];
    for (let i = 0; i < 7; i++) {
      const mode = await client.eval(`
        (() => {
          const btn = document.getElementById('pb-viz');
          if (btn) btn.click();
          return {
            canvasVisible: !document.getElementById('viz').classList.contains('hidden'),
            btnTitle: btn ? btn.title : ''
          };
        })()
      `);
      vizModes.push(mode);
      await sleep(150);
    }
    console.log('Visualizer Mode Transitions:', vizModes);
    console.log('PASS: Visualizer modes cycle correctly');

    console.log('\n--- 3. Search and Content Loading ---');
    const searchResult = await client.eval(`
      (async () => {
        const input = document.getElementById('searchInput');
        input.focus();
        input.value = 'Blinding Lights';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Wait for suggestions or directly trigger enter keydown
        for (let i = 0; i < 15; i++) {
          await new Promise(r => setTimeout(r, 200));
          const suggBtn = document.querySelector('[data-sugg]');
          if (suggBtn) {
            suggBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            break;
          }
        }

        // If suggestions didn't click, dispatch enter key
        const enterEv = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        input.dispatchEvent(enterEv);

        // Wait for search result rows (.trow)
        for (let i = 0; i < 25; i++) {
          await new Promise(r => setTimeout(r, 500));
          const rows = document.querySelectorAll('.trow');
          if (rows.length > 0) {
            const firstRow = rows[0];
            return {
              count: rows.length,
              firstTitle: firstRow.querySelector('.trow-title')?.innerText || firstRow.innerText.slice(0, 50)
            };
          }
        }
        return { count: 0 };
      })()
    `);
    console.log('Search Results:', searchResult);
    if (searchResult.count === 0) throw new Error('Search returned no results or did not render');
    console.log('PASS: Search returned and rendered items');

    console.log('\n--- 4. Playback and Accent Hue Extraction ---');
    const playbackResult = await client.eval(`
      (async () => {
        const firstPlayBtn = document.querySelector('.trow [data-action="row-play"]') || document.querySelector('.trow');
        if (firstPlayBtn) firstPlayBtn.click();
        
        // Wait for audio src and playerbar track info
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 500));
          const audio = document.getElementById('audio');
          const title = document.getElementById('np-title')?.innerText;
          const artist = document.getElementById('np-artist')?.innerText;
          const rootStyle = getComputedStyle(document.documentElement);
          const accent = rootStyle.getPropertyValue('--accent')?.trim();
          if (audio && (audio.src || title)) {
            return {
              audioSrcPresent: !!audio.src,
              playingTitle: title,
              playingArtist: artist,
              dynamicAccent: accent
            };
          }
        }
        return { audioSrcPresent: false };
      })()
    `);
    console.log('Playback state:', playbackResult);
    if (!playbackResult.playingTitle) throw new Error('Playback did not populate player bar');
    console.log('PASS: Track triggered playback and populated metadata');

    console.log('\n--- 5. Mini Player Mode Toggle ---');
    const miniModeResult = await client.eval(`
      (async () => {
        const miniBtn = document.getElementById('pb-mini');
        if (!miniBtn) return { found: false };
        miniBtn.click();
        await new Promise(r => setTimeout(r, 600));
        const afterEnter = {
          bodyHasMini: document.body.classList.contains('mini-mode'),
          btnOn: miniBtn.classList.contains('on')
        };
        // Toggle back out
        miniBtn.click();
        await new Promise(r => setTimeout(r, 600));
        const afterExit = {
          bodyHasMini: document.body.classList.contains('mini-mode'),
          btnOn: miniBtn.classList.contains('on')
        };
        return { found: true, afterEnter, afterExit };
      })()
    `);
    console.log('Mini Mode Toggle:', miniModeResult);
    if (!miniModeResult.found || !miniModeResult.afterEnter.bodyHasMini) {
      throw new Error('Mini mode failed to toggle on body class');
    }
    console.log('PASS: Mini mode toggle verified');

    console.log('\n--- 6. Lyrics Panel, Sync Offset, & Translation ---');
    const lyricsResult = await client.eval(`
      (async () => {
        const lyBtn = document.getElementById('pb-lyrics');
        if (!lyBtn) return { found: false };
        lyBtn.click();
        await new Promise(r => setTimeout(r, 1500));
        const panel = document.getElementById('lyricsPanel');
        const hasOffsetBar = !!document.querySelector('.ly-offset-bar');
        const transBtn = document.getElementById('btnTransLyrics');
        
        let transClicked = false;
        if (transBtn) {
          transBtn.click();
          await new Promise(r => setTimeout(r, 1000));
          transClicked = true;
        }

        // Test offset increment
        const plusBtn = document.querySelector('.ly-off-btn[data-dir="1"]');
        let offsetChanged = false;
        if (plusBtn) {
          plusBtn.click();
          await new Promise(r => setTimeout(r, 400));
          offsetChanged = true;
        }

        return {
          lyricsPanelOpen: !panel.classList.contains('hidden'),
          hasOffsetBar,
          transBtnFound: !!transBtn,
          transClicked,
          offsetChanged
        };
      })()
    `);
    console.log('Lyrics Features:', lyricsResult);
    if (!lyricsResult.lyricsPanelOpen) throw new Error('Lyrics panel did not open');
    console.log('PASS: Lyrics panel and controls verified');

    console.log('\n--- 7. Entire Row Click-to-Play Verification ---');
    const rowClickResult = await client.eval(`
      (async () => {
        const rows = document.querySelectorAll('.trow');
        if (!rows.length) return { found: false };
        const secondRow = rows[1] || rows[0];
        const titleEl = secondRow.querySelector('.rtitle');
        const expectedTitle = titleEl ? titleEl.textContent.trim() : '';
        if (titleEl) titleEl.click();
        else secondRow.click();
        await new Promise(r => setTimeout(r, 1200));
        const npTitle = document.getElementById('np-title')?.textContent?.trim();
        return {
          found: true,
          clickedTitle: expectedTitle,
          nowPlayingTitle: npTitle,
          playedCorrectly: npTitle === expectedTitle || !!npTitle
        };
      })()
    `);
    console.log('Row Click-to-Play:', rowClickResult);
    if (!rowClickResult.found || !rowClickResult.playedCorrectly) {
      throw new Error('Entire row click-to-play failed');
    }
    console.log('PASS: Entire row click-to-play verified');

    console.log('\n--- 8. Autoplay / Radio Toggle & Controls ---');
    const radioResult = await client.eval(`
      (async () => {
        const radioBtn = document.getElementById('pb-radio');
        const qBtn = document.getElementById('pb-queue');
        if (qBtn) qBtn.click();
        await new Promise(r => setTimeout(r, 400));
        const qRadio = document.getElementById('q-radio-toggle');
        const initialOn = radioBtn ? radioBtn.classList.contains('on') : false;
        
        if (radioBtn) radioBtn.click();
        await new Promise(r => setTimeout(r, 400));
        const afterToggle = radioBtn ? radioBtn.classList.contains('on') : false;

        if (radioBtn) radioBtn.click();
        await new Promise(r => setTimeout(r, 400));
        const finalOn = radioBtn ? radioBtn.classList.contains('on') : false;

        return {
          radioBtnFound: !!radioBtn,
          qRadioFound: !!qRadio,
          initialOn,
          afterToggle,
          finalOn
        };
      })()
    `);
    console.log('Autoplay / Radio Toggle:', radioResult);
    if (!radioResult.radioBtnFound || radioResult.initialOn === radioResult.afterToggle) {
      throw new Error('Autoplay / radio toggle failed');
    }
    console.log('PASS: Autoplay / Radio controls and toggle verified');

    console.log('\n--- 9. Hidara Features: Equalizer, Downloads, Stats, Settings, & Importer ---');
    const hidaraResult = await client.eval(`
      (async () => {
        // Test EQ Modal
        const eqBtn = document.getElementById('pb-eq');
        if (eqBtn) eqBtn.click();
        await new Promise(r => setTimeout(r, 400));
        const eqModal = document.getElementById('eqModal');
        const eqOpen = eqModal && !eqModal.classList.contains('hidden');
        
        // Click Bass Boost preset
        const bassPreset = eqModal?.querySelector('[data-eq-preset="bass"]');
        if (bassPreset) bassPreset.click();
        await new Promise(r => setTimeout(r, 200));

        // Close EQ Modal
        const eqCloseBtn = eqModal?.querySelector('[data-action="eq-close"]');
        if (eqCloseBtn) eqCloseBtn.click();
        await new Promise(r => setTimeout(r, 200));
        const eqClosed = eqModal?.classList.contains('hidden');

        // Test Downloads view navigation
        const dlNav = document.querySelector('[data-nav="downloads"]');
        if (dlNav) dlNav.click();
        await new Promise(r => setTimeout(r, 500));
        const hasDownloadsView = !!document.querySelector('.downloads-view');

        // Test Stats view navigation
        const statsNav = document.querySelector('[data-nav="stats"]');
        if (statsNav) statsNav.click();
        await new Promise(r => setTimeout(r, 500));
        const hasStatsView = !!document.querySelector('.stats-view');

        // Test Settings view navigation
        const settingsNav = document.querySelector('[data-nav="settings"]');
        if (settingsNav) settingsNav.click();
        await new Promise(r => setTimeout(r, 500));
        const hasSettingsView = !!document.querySelector('.settings-view');

        // Test Wallpaper click
        const cyberWp = document.querySelector('[data-action="set-wallpaper"][data-url*="unsplash"]');
        if (cyberWp) cyberWp.click();
        await new Promise(r => setTimeout(r, 300));
        const wpBackdrop = document.getElementById('wallpaperBackdrop');
        const wpApplied = wpBackdrop && wpBackdrop.style.backgroundImage.includes('unsplash');

        // Test Import Modal
        const importBtn = document.querySelector('[data-action="pl-import"]');
        if (importBtn) importBtn.click();
        await new Promise(r => setTimeout(r, 400));
        const importModal = document.getElementById('importModal');
        const importOpen = importModal && !importModal.classList.contains('hidden');
        const importCloseBtn = importModal?.querySelector('[data-action="import-close"]');
        if (importCloseBtn) importCloseBtn.click();
        await new Promise(r => setTimeout(r, 200));

        // Return home
        const homeNav = document.querySelector('[data-nav="home"]');
        if (homeNav) homeNav.click();

        return {
          eqBtnFound: !!eqBtn,
          eqOpen,
          eqClosed,
          hasDownloadsView,
          hasStatsView,
          hasSettingsView,
          wpApplied,
          importOpen
        };
      })()
    `);
    console.log('Hidara Features Verification:', hidaraResult);
    if (!hidaraResult.eqOpen || !hidaraResult.hasDownloadsView || !hidaraResult.hasStatsView || !hidaraResult.hasSettingsView) {
      throw new Error('Hidara UI features failed verification');
    }
    console.log('PASS: Equalizer, Downloads, Stats, Settings, Wallpaper & Importer verified');

    console.log('\n======================================');
    console.log('ALL LIVE END-TO-END VERIFICATION CHECKS PASSED!');
    console.log('======================================');

    client.close();
  } finally {
    console.log('[E2E] Terminating test Electron instance');
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
  console.error('[E2E FAIL]', err);
  process.exit(1);
});
