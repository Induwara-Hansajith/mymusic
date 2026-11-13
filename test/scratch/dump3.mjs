import { Innertube } from 'youtubei.js';

const yt = await Innertube.create();
const T = (t) => !t ? '' : typeof t === 'string' ? t : t.text || (t.runs || []).map(r => r.text).join('');
const cut = (o, n = 900) => JSON.stringify(o)?.slice(0, n);

// 1) stream url (await decipher)
const info = await yt.getInfo('J7p4bzqLvCw');
const sd = info.streaming_data;
const audio = [...(sd.formats || []), ...(sd.adaptive_formats || [])].filter(f => f.has_audio && !f.has_video).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
try {
  const url = await audio[0].decipher();
  console.log('== stream URL OK:', String(url).slice(0, 90));
  console.log('== HEAD:', (await fetch(url, { method: 'HEAD' })).status);
} catch (e) { console.log('== stream FAIL:', e.message); }

// 2) built-in lyrics text
const ly = await yt.music.getLyrics('J7p4bzqLvCw');
const lyText = T(ly.description);
console.log('== builtin lyrics chars:', lyText.length, '| start:', lyText.slice(0, 60).replace(/\n/g, '/'));

// 3) artist shelves detail
const a0 = await yt.music.getArtist('UClYV6hHlupm_S_ObS1W-DYw');
let albumId = null, plId = null;
for (const sec of (a0.sections || [])) {
  const items = sec.contents || [];
  console.log('== shelf', T(sec.header), '| n', items.length, '| item0:', cut(items[0], 550));
  for (const it of items) {
    const b = it.title?.endpoint?.payload?.browseId || '';
    if (b.startsWith('MPRE') && !albumId) albumId = b;
    if ((b.startsWith('VL') || b.startsWith('PL')) && !plId) plId = b;
  }
}

// 4) album
if (albumId) try {
  const al = await yt.music.getAlbum(albumId);
  console.log('== album keys:', Object.keys(al));
  console.log('== album track0:', cut(al.tracks?.[0], 800));
} catch (e) { console.log('== album FAIL:', e.message); }

// 5) playlist
if (plId) try {
  const pl = await yt.music.getPlaylist(plId);
  console.log('== playlist keys:', Object.keys(pl));
  console.log('== pl track0:', cut(pl.tracks?.[0], 800));
} catch (e) { console.log('== playlist FAIL:', e.message); }

// 6) home item detail
const h = await yt.music.getHomeFeed();
const s0 = (h.sections || [])[0];
console.log('== home shelf0 title:', T(s0?.header), '| item0:', cut(s0?.contents?.[0], 550));
