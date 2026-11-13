import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Innertube } = require('youtubei.js');
const yt = await Innertube.create();
const T = (t) => !t ? '' : typeof t === 'string' ? t : t.text || (t.runs || []).map(r => r.text).join('');

const res = await yt.music.search('blinding lights', { type: 'songs' });
console.log('contents isArray:', Array.isArray(res.contents), '| type:', res.contents?.type);
const c = res.contents;
const list = Array.isArray(c) ? c : [c];
for (const n of list) {
  console.log('node type:', n.type, '| title:', T(n.title), '| contents len:', n.contents?.length, '| item types:', [...new Set((n.contents || []).map(x => x.item_type || x.type))].slice(0, 5));
}
const shelf = list.find(n => n.contents?.length);
console.log('sample row item_type:', shelf?.contents?.[0]?.item_type, '| artist col:', (shelf?.contents?.[0]?.flex_columns || [])[1]?.title?.text);
