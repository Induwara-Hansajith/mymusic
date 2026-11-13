import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Innertube } = require('youtubei.js');
const yt = await Innertube.create();
const cut = (o, n = 800) => JSON.stringify(o)?.slice(0, n);

const base = await yt.music.search('after hours');
const filtered = await base.applyFilter('Albums');
const nodes = Array.isArray(filtered.contents) ? filtered.contents : [filtered.contents];
console.log('nodes:', nodes.map(n => `${n.type}(${n.contents?.length})`).join(', '));
const shelf = nodes.find(n => (n.contents || []).length);
const row = shelf?.contents?.[0];
console.log('row type:', row?.type, '| item_type:', row?.item_type);
console.log('row title payload:', cut(row?.title?.endpoint?.payload || row?.flex_columns?.[0]?.title?.endpoint?.payload, 400));
console.log('cols:', (row?.flex_columns || []).map(c => c.title?.text));
