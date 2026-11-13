import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ytm = require('../src/lib/ytm.js');

const r = await ytm.search('after hours', 'albums');
console.log('module albums:', r.albums.length, '| songs:', r.songs.length);
if (r.albums.length) console.log('first:', JSON.stringify(r.albums[0]).slice(0, 200));

// raw trace through the same path
const { Innertube } = require('youtubei.js');
const yt = await Innertube.create();
const base = await yt.music.search('after hours');
const filtered = await base.applyFilter('Albums');
const nodes = Array.isArray(filtered.contents) ? filtered.contents : [filtered.contents];
let rows = 0, byType = {};
for (const n of nodes) {
  for (const row of (n.contents || [])) {
    rows++;
    byType[row.item_type || row.type] = (byType[row.item_type || row.type] || 0) + 1;
  }
}
console.log('raw rows:', rows, '| breakdown:', JSON.stringify(byType));
const shelf = nodes.find(n => (n.contents || []).length);
const row0 = shelf.contents[0];
console.log('row0.type:', row0.type);
console.log('row0.title?.endpoint?.payload:', JSON.stringify(row0.title?.endpoint?.payload || null));
console.log('row0.flex0 runs payload:', JSON.stringify(row0.flex_columns?.[0]?.title?.runs?.[0]?.endpoint?.payload || null));
