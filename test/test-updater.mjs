// test/test-updater.mjs
// Automated Integration & Verification Suite for My Music In-App Auto-Updater IPC & UI
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const PORT = 9225;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 35; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const pages = await res.json();
      const page = pages.find(p => p.url && p.url.includes('index.html')) || pages.find(p => p.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        return page.webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(350);
  }
  throw new Error('Could not connect to Chrome DevTools Protocol port ' + PORT);
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
          console.error('[CDP Parse Error]', e);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const curId = this.id++;
      this.callbacks.set(curId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
      throw new Error(`Evaluation failed: ${desc}`);
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
  }
}

async function run() {
  console.log('[TEST] Starting Electron for Auto-Updater IPC verification...');
  const electronBin = path.join(appRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');
  const electronProc = spawn(electronBin, ['.', `--remote-debugging-port=${PORT}`], {
    cwd: appRoot,
    shell: true,
    stdio: 'pipe'
  });

  const cleanup = () => {
    try { electronProc.kill(); } catch {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  try {
    const wsUrl = await getWsUrl();
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    console.log('[TEST] Connected to CDP on port', PORT);

    // Wait for renderer ready
    await sleep(2000);

    // --- TEST 1: updates:get-status ---
    console.log('\n--- Test 1: updates:get-status ---');
    const status = await cdp.evaluate(`window.api.invoke('updates:get-status')`);
    console.log('Status result:', status);
    if (!status || !status.ok) throw new Error('updates:get-status failed: ' + JSON.stringify(status));
    const data = status.data;
    if (typeof data.supported !== 'boolean') throw new Error('supported must be boolean');
    if (typeof data.enabled !== 'boolean') throw new Error('enabled must be boolean');
    // In unpackaged development mode, supported must be false
    if (data.supported !== false) throw new Error('supported must be false in unpackaged dev mode');
    console.log('PASS: updates:get-status returns valid schema and supported=false in dev');

    // --- TEST 2: updates:defer (valid & invalid) ---
    console.log('\n--- Test 2: updates:defer ---');
    const deferValid = await cdp.evaluate(`window.api.invoke('updates:defer', { version: '9.9.9' })`);
    console.log('Defer valid result:', deferValid);
    if (!deferValid || !deferValid.ok || deferValid.data !== true) {
      throw new Error('updates:defer valid version failed');
    }

    const checkDeferredStore = await cdp.evaluate(`window.api.invoke('library:get')`);
    if (checkDeferredStore?.data?.settings?.updateDeferredVersion !== '9.9.9') {
      throw new Error('Store was not updated with deferred version 9.9.9');
    }
    console.log('PASS: updates:defer successfully updated store settings');

    const deferEmpty = await cdp.evaluate(`window.api.invoke('updates:defer', { version: '' })`);
    console.log('Defer empty result:', deferEmpty);
    if (deferEmpty.ok !== false || !deferEmpty.error) {
      throw new Error('updates:defer should reject empty version string');
    }
    console.log('PASS: updates:defer properly rejects empty version');

    // --- TEST 3: updates:check (unpackaged guard) ---
    console.log('\n--- Test 3: updates:check ---');
    const checkRes = await cdp.evaluate(`window.api.invoke('updates:check', { manual: true })`);
    console.log('Check result:', checkRes);
    if (checkRes.ok !== false || !/Windows Setup/i.test(checkRes.error)) {
      throw new Error('updates:check should enforce updaterSupported guard: ' + JSON.stringify(checkRes));
    }
    console.log('PASS: updates:check enforces updaterSupported guard with clear error message');

    // --- TEST 4: updates:install (precondition guard) ---
    console.log('\n--- Test 4: updates:install ---');
    const installRes = await cdp.evaluate(`window.api.invoke('updates:install')`);
    console.log('Install result:', installRes);
    if (installRes.ok !== false || !/no update ready/i.test(installRes.error)) {
      throw new Error('updates:install should reject when no update is downloaded: ' + JSON.stringify(installRes));
    }
    console.log('PASS: updates:install enforces readiness precondition');

    // --- TEST 5: Settings UI Verification ---
    console.log('\n--- Test 5: Settings UI & DOM State ---');
    // Navigate to settings view
    await cdp.evaluate(`go('settings')`);
    await sleep(600);

    const uiCheck = await cdp.evaluate(`(() => {
      const autoUpdateToggle = document.getElementById('settingAutoUpdate');
      const checkBtn = document.getElementById('checkUpdatesBtn');
      const note = document.getElementById('updateSupportText');
      return {
        hasToggle: !!autoUpdateToggle,
        toggleChecked: autoUpdateToggle ? autoUpdateToggle.checked : false,
        hasCheckBtn: !!checkBtn,
        btnDisabled: checkBtn ? checkBtn.disabled : false,
        noteText: note ? note.textContent : ''
      };
    })()`);
    console.log('UI Check result:', uiCheck);

    if (!uiCheck.hasToggle) throw new Error('settingAutoUpdate toggle missing in settings DOM');
    if (!uiCheck.hasCheckBtn) throw new Error('checkUpdatesBtn button missing in settings DOM');
    if (uiCheck.btnDisabled !== true) throw new Error('checkUpdatesBtn should be disabled in dev mode');
    console.log('PASS: Settings view renders auto-updater controls with dev-mode disabling');

    // Cleanup deferred setting to leave store clean
    await cdp.evaluate(`window.api.invoke('library:mutate', { type: 'settings.set', patch: { updateDeferredVersion: '' } })`);

    cdp.close();
    console.log('\n======================================================');
    console.log('ALL AUTO-UPDATER IPC & UI INTEGRATION TESTS PASSED!');
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('\nFAIL: Test suite encountered an error:', err);
    process.exit(1);
  } finally {
    cleanup();
  }
}

run();
