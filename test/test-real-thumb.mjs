// test/test-real-thumb.mjs
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const PORT = 9228;

const child = spawn('node_modules/electron/dist/electron.exe', ['.', '--remote-debugging-port=' + PORT], {
  cwd: appRoot,
  stdio: 'ignore'
});

async function run() {
  await new Promise(r => setTimeout(r, 2500));
  const res = await fetch('http://127.0.0.1:' + PORT + '/json');
  const pages = await res.json();
  const page = pages.find(p => p.url && p.url.includes('index.html')) || pages[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (m, p = {}) => new Promise((resolve, reject) => {
    const curId = id++;
    const handler = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id === curId) {
        ws.removeEventListener('message', handler);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method: m, params: p }));
  });

  const thumbUrl = 'https://i.ytimg.com/vi/JH398xAYpZA/mqdefault.jpg';

  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        applyAccent("${thumbUrl}");
        await new Promise(r => setTimeout(r, 1000));
        const style = getComputedStyle(document.documentElement);
        return {
          hue: style.getPropertyValue('--hue').trim(),
          accentHue: style.getPropertyValue('--accent-hue').trim(),
          hue2: style.getPropertyValue('--hue-2').trim(),
          bg: style.getPropertyValue('--bg').trim(),
          panel: style.getPropertyValue('--panel').trim(),
          vizHue: vizS.targetHue,
          vizHue2: vizS.targetHueSecondary
        };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('REAL THUMB APPLY ACCENT TEST:\n', JSON.stringify(evalRes.result.value, null, 2));
  ws.close();
  child.kill();
  if (!evalRes.result.value || evalRes.result.value.hue === '258') {
    console.error('FAIL: Hue was not extracted from YouTube thumbnail');
    process.exit(1);
  } else {
    console.log('PASS: Successfully extracted and applied colors from real YouTube thumbnail!');
    process.exit(0);
  }
}
run().catch(e => { console.error(e); child.kill(); process.exit(1); });
