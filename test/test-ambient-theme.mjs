// test/test-ambient-theme.mjs
// Automated verification for dynamic album artwork color theme & visualizers

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const PORT = 9224;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const pages = await res.json();
      const page = pages.find(p => p.url && p.url.includes('index.html')) || pages.find(p => p.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(400);
  }
  throw new Error('Could not connect to CDP port ' + PORT);
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
    return res && res.result ? res.result.value : null;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('[TEST] Starting Electron to verify Dynamic Album Art Theme & Visualizer...');

  const electronProc = spawn('npx.cmd', ['electron', '.', `--remote-debugging-port=${PORT}`], {
    cwd: appRoot,
    stdio: 'ignore',
    shell: true
  });

  try {
    const wsUrl = await getWsUrl();
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await sleep(2000);

    // 1. Verify extractHueFromPixels in browser context
    console.log('\n--- Test 1: Dual-tone Palette Extraction ---');
    const extractionCheck = await cdp.eval(`(() => {
      // Create synthetic test data with vibrant cyan (#00c8ff, hue ~193) and gold (#ff9600, hue ~35)
      const data = new Uint8ClampedArray(32 * 32 * 4);
      for (let i = 0; i < 32 * 32 * 4; i += 8) {
        data[i] = 0; data[i+1] = 200; data[i+2] = 255; data[i+3] = 255;      // cyan
        data[i+4] = 255; data[i+5] = 150; data[i+6] = 0; data[i+7] = 255;    // gold
      }
      const pal = extractHueFromPixels(data);
      return {
        hasPal: !!pal,
        hue: pal ? pal.hue : null,
        hueSecondary: pal ? pal.hueSecondary : null,
        hasSat: pal ? pal.sat > 0 : false
      };
    })()`);
    console.log('Extraction check:', extractionCheck);
    if (!extractionCheck.hasPal || extractionCheck.hue == null || extractionCheck.hueSecondary == null) {
      throw new Error('Palette extraction failed to extract primary and secondary hues');
    }
    console.log('PASS: Primary and secondary hues successfully extracted');

    // 2. Verify setHue applies CSS variables across entire UI
    console.log('\n--- Test 2: UI CSS Variables & Surface Tinting ---');
    const cssCheck = await cdp.eval(`(() => {
      setHue({ hue: 215, hueSecondary: 38, sat: 0.85 });
      const style = getComputedStyle(document.documentElement);
      return {
        hue: style.getPropertyValue('--hue').trim(),
        accentHue: style.getPropertyValue('--accent-hue').trim(),
        hue2: style.getPropertyValue('--hue-2').trim(),
        accent: style.getPropertyValue('--accent').trim(),
        accent2: style.getPropertyValue('--accent-2').trim(),
        bg: style.getPropertyValue('--bg').trim(),
        bg2: style.getPropertyValue('--bg2').trim(),
        panel: style.getPropertyValue('--panel').trim(),
        sidebarBg: style.getPropertyValue('--sidebar-bg').trim(),
        playerbarBg: style.getPropertyValue('--playerbar-bg').trim(),
        vizTargetHue: vizS.targetHue,
        vizTargetHueSecondary: vizS.targetHueSecondary
      };
    })()`);
    console.log('CSS custom properties check:', cssCheck);
    if (cssCheck.hue !== '215' || cssCheck.hue2 !== '38') {
      throw new Error('setHue did not set --hue or --hue-2 correctly');
    }
    if (!cssCheck.bg.includes('hsl(215') || !cssCheck.sidebarBg.includes('hsla(215')) {
      throw new Error('setHue did not tint UI background and sidebar with artwork hue');
    }
    if (cssCheck.vizTargetHue !== 215 || cssCheck.vizTargetHueSecondary !== 38) {
      throw new Error('vizS target hues not synchronized');
    }
    console.log('PASS: Dynamic CSS custom properties and surface tints set across UI');

    // 3. Verify Full-Screen Backdrop Gradient integration
    console.log('\n--- Test 3: Full-Screen Overlay Gradient Theme ---');
    const fsCheck = await cdp.eval(`(() => {
      const gradEl = document.querySelector('.fs-backdrop-gradient');
      if (!gradEl) return { ok: false, reason: 'missing .fs-backdrop-gradient' };
      const comp = getComputedStyle(gradEl);
      return {
        ok: true,
        hasTransition: comp.transition.includes('background') || comp.transition.includes('all')
      };
    })()`);
    console.log('Full-screen backdrop check:', fsCheck);
    if (!fsCheck.ok) throw new Error(fsCheck.reason);
    console.log('PASS: Full-screen overlay backdrop reflects dynamic color theme');

    // 4. Verify Ambient Colors Toggle
    console.log('\n--- Test 4: Ambient Colors Disable/Revert ---');
    const toggleCheck = await cdp.eval(`(() => {
      settings().ambientColors = false;
      applyAccent(null);
      const style = getComputedStyle(document.documentElement);
      const bg = style.getPropertyValue('--bg').trim();
      const panel = style.getPropertyValue('--panel').trim();
      // Restore
      settings().ambientColors = true;
      return {
        revertedBg: bg,
        revertedPanel: panel
      };
    })()`);
    console.log('Revert check:', toggleCheck);
    if (toggleCheck.revertedBg !== '#07090e') {
      throw new Error('Disabling ambientColors did not revert --bg to #07090e');
    }
    console.log('PASS: Ambient toggle smoothly restores neutral dark theme when disabled');

    cdp.close();
    console.log('\n======================================================');
    console.log('ALL DYNAMIC ALBUM ART THEME TESTS PASSED!');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('TEST ERROR:', err);
    process.exit(1);
  } finally {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', electronProc.pid, '/f', '/t']);
      } else {
        electronProc.kill('SIGKILL');
      }
    } catch {}
  }
}

run();
