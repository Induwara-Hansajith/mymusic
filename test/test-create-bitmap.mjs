// test/test-create-bitmap.mjs
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const PORT = 9227;

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

  const testUrls = [
    'https://yt3.googleusercontent.com/R_cjQK3wwLPEzri1jerx-79zgzGocoKvwGU3NMONaTsaMM0Idd641pfB8r5jgfpn6I8JAoFtf9RBIcI=w120-h120-l90-rj',
    'https://i.ytimg.com/vi/JH398xAYpZA/mqdefault.jpg'
  ];

  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        async function extractPalette(url) {
          try {
            const resp = await fetch(url);
            if (!resp.ok) return { ok: false, err: 'status ' + resp.status };
            const blob = await resp.blob();
            const bmp = await createImageBitmap(blob);
            const c = document.createElement('canvas');
            c.width = 32; c.height = 32;
            const ctx = c.getContext('2d');
            ctx.drawImage(bmp, 0, 0, 32, 32);
            if (typeof bmp.close === 'function') bmp.close();
            const d = ctx.getImageData(0, 0, 32, 32).data;
            const pal = extractHueFromPixels(d);
            return { ok: true, pal };
          } catch (e) {
            return { ok: false, err: e.message };
          }
        }

        const results = {};
        for (const u of ${JSON.stringify(testUrls)}) {
          results[u] = await extractPalette(u);
        }
        return results;
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Results:\n', JSON.stringify(evalRes.result.value, null, 2));
  ws.close();
  child.kill();
}
run().catch(e => { console.error(e); child.kill(); });
