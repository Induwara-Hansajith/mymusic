import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Innertube } = require('youtubei.js');
const yt = await Innertube.create();

const base = await yt.music.search('after hours');
const filtered = await base.applyFilter('Albums');
const fn = Array.isArray(filtered.contents) ? filtered.contents : [filtered.contents];
const shelf = fn.find(n => (n.contents || []).length);
const alRow = shelf?.contents?.[0];
console.log('row type:', alRow?.type, '| item_type:', alRow?.item_type);
const run2 = alRow?.flex_columns?.[0]?.title?.runs?.[0];
console.log('run endpoint:', JSON.stringify(run2?.endpoint, null, 1)?.slice(0, 700));
console.log('endpoint payload?', run2?.endpoint && 'payload' in run2.endpoint, '| payload:', JSON.stringify(run2?.endpoint?.payload || null)?.slice(0, 300));
console.log('title endpoint?', JSON.stringify(alRow?.flex_columns?.[0]?.title?.endpoint || null)?.slice(0, 300));
