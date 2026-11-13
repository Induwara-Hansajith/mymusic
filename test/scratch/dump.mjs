import { Innertube } from 'youtubei.js';

const yt = await Innertube.create();
const T = (t) => !t ? '' : typeof t === 'string' ? t : t.text || (t.runs || []).map(r => r.text).join('');
const cut = (o, n = 1500) => JSON.stringify(o)?.slice(0, n);

console.log('== yt.music methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(yt.music)).filter(k => !k.startsWith('_')));

// ---- stream url resolution ----
const info = await yt.getInfo('J7p4bzqLvCw');
const sd = info.streaming_data;
const audio = [...(sd.formats || []), ...(sd.adaptive_formats || [])].filter(f => f.has_audio && !f.has_video).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
console.log('== fmt keys:', Object.keys(audio[0]).join(','));
console.log('== has url:', typeof audio[0].url, '| decipher on fmt:', typeof audio[0].decipher, '| sd.url:', typeof sd.url, '| info methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(info)).filter(k => k.toLowerCase().includes('dec') || k.toLowerCase().includes('url') || k.toLowerCase().includes('play')));
let url = audio[0].url || null;
if (!url && typeof audio[0].decipher === 'function') url = audio[0].decipher();
if (!url && typeof sd.url === 'function') url = sd.url();
console.log('== resolved url?', url ? url.slice(0, 80) : 'NO');
if (url) console.log('== HEAD:', (await fetch(url, { method: 'HEAD' })).status);

// ---- songs-filtered search via chip params ----
const u = await yt.music.search('the weeknd');
const chips = u.header?.chips || [];
const songsChip = chips.find(c => c.text === 'Songs');
const fs = await yt.music.search('the weeknd', { params: songsChip.endpoint.payload.params });
const rows = (fs.contents || []).filter(x => x.type === 'ItemSection').flatMap(s => s.contents || []);
console.log('== songs-filtered rows:', rows.length, '| item_types:', [...new Set(rows.map(r => r.item_type))]);
const row2 = rows.find(r => r.item_type === 'song');
console.log('== song row cols:', JSON.stringify((row2?.flex_columns || []).map(c => T(c.title))));
const allRuns = [].concat(...(row2?.flex_columns || []).map(c => c.title?.runs || []));
const browses = allRuns.map(r => r.endpoint?.payload || {}).filter(p => p.browseId);
console.log('== song row browse payloads:', cut(browses, 600));

// album + playlist from artist page
let albumId = null, plId = null;
const a0 = await yt.music.getArtist('UClYV6hHlupm_S_ObS1W-DYw');
for (const sec of (a0.sections || [])) {
  const t = T(sec.header).toLowerCase();
  for (const it of (sec.contents || [])) {
    const runs = [].concat(...((it.flex_columns || []).map(c => c.title?.runs || [])), (it.title?.runs || []));
    for (const r of runs) {
      const b = r.endpoint?.payload?.browseId || '';
      if (b.startsWith('MPRE') && !albumId) albumId = b;
      if ((b.startsWith('VL') || b.startsWith('PL')) && !plId) plId = b;
    }
    if (it.type === 'MusicTwoRowItem') {
      const b = it.title?.endpoint?.payload?.browseId || '';
      if (b.startsWith('MPRE') && !albumId) albumId = b;
      if ((b.startsWith('VL') || b.startsWith('PL')) && !plId) plId = b;
    }
  }
}
console.log('== from artist page: albumId', albumId, '| plId', plId);
console.log('== artist shelves:', JSON.stringify((a0.sections || []).map(s => ({ t: T(s.header), n: s.contents?.length, types: [...new Set((s.contents || []).map(c => c.type))] }))));

if (albumId) try { const al = await yt.music.getAlbum(albumId); console.log('== album keys:', Object.keys(al)); console.log('album track0:', cut(al.tracks?.[0], 700)); } catch (e) { console.log('album FAIL', e.message); }
if (plId) try { const pl = await yt.music.getPlaylist(plId); console.log('== playlist keys:', Object.keys(pl)); console.log('pl track0:', cut(pl.tracks?.[0], 700)); } catch (e) { console.log('playlist FAIL', e.message); }
