// test/test-top-artists-e2e.mjs
// Automated E2E verification for Top Artist Pictures in Home and Stats
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const PORT = 9230;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 35; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const pages = await res.json();
      const page = pages.find(p => p.url && p.url.includes('index.html')) || pages.find(p => p.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(350);
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
  console.log('[TEST] Starting Electron for Top Artist Pictures E2E verification...');

  const electronBin = path.join(appRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');
  const child = spawn(electronBin, ['.', `--remote-debugging-port=${PORT}`], {
    cwd: appRoot,
    shell: true,
    stdio: 'ignore'
  });

  try {
    const wsUrl = await getWsUrl();
    const client = new CdpClient(wsUrl);
    await client.connect();
    await client.send('Runtime.enable');

    // Wait for boot and Home view rendering
    await sleep(2500);

    // 1. Verify Home Top Artists Chips & Thumbnails
    const homeCheck = await client.eval(`
      (() => {
        const chips = document.querySelectorAll('.artist-chip');
        const thumbs = document.querySelectorAll('[data-artist-thumb-home]');
        const images = document.querySelectorAll('[data-artist-thumb-home] img');
        return {
          chipCount: chips.length,
          thumbWrapCount: thumbs.length,
          imageCount: images.length
        };
      })()
    `);
    console.log('Home check initial:', homeCheck);

    // Wait for background thumbnail resolution
    await sleep(3500);

    const homeAfterCheck = await client.eval(`
      (() => {
        const images = Array.from(document.querySelectorAll('[data-artist-thumb-home] img')).map(img => ({
          src: img.src,
          alt: img.alt
        }));
        return {
          imageCount: images.length,
          samples: images.slice(0, 3)
        };
      })()
    `);
    console.log('Home after thumbnail fetch:', homeAfterCheck);

    // 2. Navigate to Stats view
    await client.eval(`go('stats')`);
    await sleep(1500);

    const statsCheck = await client.eval(`
      (() => {
        const artistItems = document.querySelectorAll('.stat-section:last-child .top-item');
        const statThumbs = document.querySelectorAll('[data-artist-thumb-stat]');
        const statImages = document.querySelectorAll('[data-artist-thumb-stat] img');
        return {
          artistItemCount: artistItems.length,
          statThumbCount: statThumbs.length,
          statImageCount: statImages.length,
          sampleSrc: statImages[0] ? statImages[0].src : null
        };
      })()
    `);
    console.log('Stats view check:', statsCheck);

    client.close();
    child.kill();

    if (homeAfterCheck.imageCount > 0 && statsCheck.statThumbCount > 0) {
      console.log('\nPASS: Top artist pictures successfully verified on Home and Stats views!');
      process.exit(0);
    } else {
      console.error('\nFAIL: Artist images were not loaded into DOM');
      process.exit(1);
    }
  } catch (err) {
    console.error('[TEST FAIL]', err);
    child.kill();
    process.exit(1);
  }
}

run();
