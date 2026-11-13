import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Innertube } = require('youtubei.js');
const yt = await Innertube.create();
const J = (o, n = 260) => JSON.stringify(o)?.slice(0, n);

const rowsOf = (search) => (Array.isArray(search.contents) ? search.contents : [search.contents]).flatMap(n => n.contents || []).filter(x => x.type === 'MusicResponsiveListItem');

const songRow = rowsOf(await yt.music.search('blinding lights', { type: 'songs' }).then(r => r.applyFilter ? r : r) ).find(r => r.item_type === 'song') || rowsOf(await yt.music.search('blinding lights').then(r => r.applyFilter('Songs')))[0];
const sRows = rowsOf(await (await yt.music.search('blinding lights')).applyFilter('Songs'));
const s = sRows[0];
console.log('SONG id:', s.id, '| title:', s.title, '| artists:', J(s.artists), '| album:', J(s.album), '| duration:', J(s.duration), '| year:', s.year, '| thumb:', J(s.thumbnail)?.slice(0, 140));

const aRows = rowsOf(await (await yt.music.search('after hours')).applyFilter('Albums'));
const a = aRows[0];
console.log('ALBUM id:', a.id, '| title:', a.title, '| artists:', J(a.artists), '| authors:', J(a.authors), '| subtitle:', J(a.subtitle), '| year:', a.year);

const arRows = rowsOf(await (await yt.music.search('the weeknd')).applyFilter('Artists'));
const ar = arRows[0];
console.log('ARTIST id:', ar.id, '| name:', ar.name, '| title:', ar.title, '| subscribers:', J(ar.subscribers), '| thumb:', J(ar.thumbnail)?.slice(0, 140));

const pRows = rowsOf(await (await yt.music.search('top hits')).applyFilter('Featured playlists'));
const p = pRows[0];
console.log('PLAYLIST id:', p.id, '| title:', p.title, '| author:', J(p.author), '| item_count:', p.item_count);
