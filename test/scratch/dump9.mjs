import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Innertube } = require('youtubei.js');
const yt = await Innertube.create();

const base = await yt.music.search('after hours');
const un = Array.isArray(base.contents) ? base.contents : [base.contents];
const secRow = un.flatMap(n => (n.contents || []).filter(x => x.type === 'MusicResponsiveListItem' && x.item_type === 'song'))[0];
const run1 = secRow?.flex_columns?.[0]?.title?.runs?.[0];
console.log('== UNFILTERED song run endpoint keys:', run1 ? Object.keys(run1.endpoint || {}) : 'no run');
console.log(JSON.stringify(run1?.endpoint, null, 1).slice(0, 600));

const filtered = await base.applyFilter('Albums');
const fn = Array.isArray(filtered.contents) ? filtered.contents : [filtered.contents];
const alRow = fn.flatMap(n => (n.contents || []))[0];
const run2 = alRow?.flex_columns?.[0]?.title?.runs?.[0];
console.log('== FILTERED album run endpoint:', JSON.stringify(run2?.endpoint, null, 1).slice(0, 600));
console.log('== endpoint payload type:', typeof run2?.endpoint?.payload, '| browseId:', run2?.endpoint?.browseId, '| payload?.browseId:', run2?.endpoint?.payload?.browseId);
