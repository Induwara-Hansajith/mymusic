import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Innertube } = require('youtubei.js');
const yt = await Innertube.create();

const base = await yt.music.search('after hours');
const filtered = await base.applyFilter('Albums');
const shelf = (Array.isArray(filtered.contents) ? filtered.contents : [filtered.contents]).find(n => (n.contents || []).length);
const row = shelf.contents[0];
console.log('row own keys:', Object.keys(row));
console.log('row.id:', row.id, '| row.title:', row.title);
console.log('row.authors:', JSON.stringify(row.authors)?.slice(0, 200));
console.log('row.album:', JSON.stringify(row.album));
console.log('row.duration:', row.duration, '| row.thumbnail:', JSON.stringify(row.thumbnail)?.slice(0, 150));
console.log('flex0 title full:', JSON.stringify(row.flex_columns?.[0]?.title)?.slice(0, 500));
