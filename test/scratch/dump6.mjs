import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Innertube } = require('youtubei.js');
const yt = await Innertube.create();
const T = (t) => !t ? '' : typeof t === 'string' ? t : t.text || (t.runs || []).map(r => r.text).join('');

for (const type of ['songs', 'albums']) {
  const res = await yt.music.search('blinding lights', { type });
  const nodes = Array.isArray(res.contents) ? res.contents : [res.contents];
  for (const n of nodes) {
    const rows = n.contents || [];
    const msg = rows.find(x => x.type === 'Message');
    if (msg) console.log(`[${type}] MESSAGE:`, T(msg.text || msg.message));
    else console.log(`[${type}] node ${n.type}:`, rows.length, 'rows; item_types:', [...new Set(rows.map(x => x.item_type))]);
  }
}
