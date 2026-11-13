// YouTube Music service (main process).
// Search/browse/lyrics via youtubei.js (v18 InnerTube client, same as YT Music web).
// Audio stream URLs resolved with the bundled yt-dlp.exe and cached for ~5 hours.

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let YTDLP = path.join(__dirname, '..', '..', 'bin', 'yt-dlp.exe');
try {
  const electron = require('electron');
  if (electron && electron.app && electron.app.isPackaged) {
    const packagedPath = path.join(process.resourcesPath, 'bin', 'yt-dlp.exe');
    if (fs.existsSync(packagedPath)) YTDLP = packagedPath;
  }
} catch {}

let ytm = null;
let initPromise = null;
const streamCache = new Map(); // videoId -> { urls, expires }
const lyricsCache = new Map(); // key -> lyrics result

// YouTube video ids are exactly 11 chars of [A-Za-z0-9_-]; anything else must
// be rejected before it reaches yt-dlp as a spawn argument.
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// Evict expired stream entries, then cap size (Map keeps insertion order, so
// the oldest entries go first).
function pruneCache(map, max) {
  for (const [k, v] of map) {
    if (v && typeof v.expires === 'number' && v.expires <= Date.now()) map.delete(k);
  }
  while (map.size > max) map.delete(map.keys().next().value);
}

function ensureInit() {
  if (!initPromise) {
    initPromise = (async () => {
      const { Innertube } = require('youtubei.js');
      const yt = await Innertube.create();
      ytm = yt.music;
    })().catch(e => { initPromise = null; throw e; });
  }
  return initPromise;
}

// ---------- generic text helpers ----------

const T = (t) => !t ? '' : typeof t === 'string' ? t : t.text || (t.runs || []).map(r => r.text).join('');

function runsOf(t) { return (t && Array.isArray(t.runs)) ? t.runs : []; }

function payloadOf(t) {
  const r = runsOf(t).find(r => r.endpoint && r.endpoint.payload);
  return (r && r.endpoint && r.endpoint.payload) || (t && t.endpoint && t.endpoint.payload) || null;
}

function lastThumb(thumb) {
  if (!thumb) return '';
  if (typeof thumb === 'string') return thumb;
  if (thumb.url && typeof thumb.url === 'string') return thumb.url;
  const arr = thumb && thumb.contents ? thumb.contents : (Array.isArray(thumb) ? thumb : []);
  if (!arr.length) return '';
  const last = arr[arr.length - 1];
  return (last && last.url) || '';
}

const KIND_RE = /^(?:song|video|album|ep|single|playlist|artist|featured on|profile|podcast|episode|top result)$/i;
const METRIC_RE = /^\d+(?:[.,]\d+)?\s*[KMB]?\s*(?:plays|views|subscribers|songs|videos)$/i;
const TIME_RE = /^(?:\d+:)?\d{1,2}:\d{2}$/;

function durToSec(d) {
  if (typeof d === 'number' && isFinite(d)) return d;
  if (typeof d !== 'string' || !d.trim()) return 0;
  const parts = d.split(':').map(n => parseInt(n, 10));
  if (parts.some(isNaN)) return 0;
  return parts.reduce((a, b) => a * 60 + b, 0);
}

function durOfRun(run) {
  const d = run && run.duration;
  if (typeof d === 'number' && isFinite(d)) return d;
  if (d && typeof d === 'object' && d.seconds != null) return d.seconds;
  const text = typeof d === 'string' ? d : (d && d.text) || '';
  return durToSec(String(text));
}

// Column text like "Album • The Weeknd • 2020" -> ["The Weeknd", "2020"]
function metaParts(row) {
  const texts = [
    ...(row.subtitle ? [T(row.subtitle)] : []),
    ...((row.flex_columns || []).slice(1).map(c => T(c.title)))
  ];
  return texts
    .flatMap(t => String(t).split(' • '))
    .map(s => (s || '').trim())
    .filter(s => s && !KIND_RE.test(s) && !METRIC_RE.test(s) && !TIME_RE.test(s) && !/^\d{4}$/.test(s));
}

// ---------- normalizers (v18 parsed rows expose .id/.title/.artists/.album/.duration) ----------

function trackFromRow(row) {
  const p0 = payloadOf(row.flex_columns && row.flex_columns[0] && row.flex_columns[0].title) || {};
  const vt = ((p0.watchEndpointMusicSupportedConfigs || {}).watchEndpointMusicConfig || {}).musicVideoType || '';
  const isVideo = (row.item_type || '').toLowerCase() === 'video' || vt === 'MUSIC_VIDEO_TYPE_OMV' || vt === 'MUSIC_VIDEO_TYPE_UGV';

  const artists = row.artists || row.authors || [];
  const album = row.album;
  const dur = row.duration;

  return {
    id: row.id || (p0.videoId || null),
    title: row.title || 'Unknown title',
    artist: (artists.length ? artists.map(a => a.name).filter(Boolean).join(', ') : '') || metaParts(row)[0] || 'Unknown',
    artistId: (artists[0] && (artists[0].channel_id || (artists[0].endpoint && artists[0].endpoint.payload && artists[0].endpoint.payload.browseId))) || null,
    album: (album && (album.name || T(album))) || '',
    albumId: (album && (album.id || (album.endpoint && album.endpoint.payload && album.endpoint.payload.browseId))) || null,
    duration: durOfRun(row) || 0,
    thumb: lastThumb(row.thumbnail),
    type: isVideo ? 'video' : 'song'
  };
}

function albumFromRow(row) {
  return {
    id: row.id || null,
    title: row.title || 'Unknown album',
    artist: metaParts(row)[0] || '',
    artistId: null,
    thumb: lastThumb(row.thumbnail),
    year: (typeof row.year === 'object' ? T(row.year) : row.year) || '',
    type: 'album'
  };
}

function artistFromRow(row) {
  return {
    id: row.id || null,
    name: row.name || row.title || 'Unknown artist',
    thumb: lastThumb(row.thumbnail),
    type: 'artist'
  };
}

function playlistFromRow(row) {
  return {
    id: row.id || null,
    title: row.title || 'Unknown playlist',
    owner: metaParts(row).pop() || '',
    thumb: lastThumb(row.thumbnail),
    type: 'playlist'
  };
}

function classifyRow(row, out) {
  if (!row || row.type !== 'MusicResponsiveListItem' || !row.id) return false;
  const itemType = (row.item_type || '').toLowerCase();
  if (itemType === 'song' || itemType === 'video') { out[itemType === 'song' ? 'songs' : 'videos'].push(trackFromRow(row)); return true; }
  if (itemType === 'album' || itemType === 'single' || itemType === 'single-ep' || itemType === 'ep') { out.albums.push(albumFromRow(row)); return true; }
  if (itemType === 'artist') { out.artists.push(artistFromRow(row)); return true; }
  if (itemType === 'playlist') { out.playlists.push(playlistFromRow(row)); return true; }

  // no item_type: infer by id shape
  if (/^MPRE/.test(row.id)) { out.albums.push(albumFromRow(row)); return true; }
  if (/^UC/.test(row.id)) { out.artists.push(artistFromRow(row)); return true; }
  if (/^(VL|PL)/.test(row.id)) { out.playlists.push(playlistFromRow(row)); return true; }
  if (/^[A-Za-z0-9_-]{11}$/.test(row.id)) {
    const t = trackFromRow(row);
    if (t.id) { out[t.type === 'video' ? 'videos' : 'songs'].push(t); return true; }
  }
  return false;
}

// MusicCardShelf = "Top result" card (endpoints ARE present on cards).
function classifyCardShelf(card, out) {
  const p0 = payloadOf(card.title) || (card.on_tap && card.on_tap.payload) || {};
  const pageType = ((p0.browseEndpointContextSupportedConfigs || {}).browseEndpointContextMusicConfig || {}).pageType || '';
  const thumb = lastThumb(card.thumbnail);
  const title = T(card.title) || 'Unknown';
  const subs = runsOf(card.subtitle).map(r => r.text).map(s => (s || '').trim())
    .filter(s => s && s !== '•' && !KIND_RE.test(s) && !METRIC_RE.test(s) && !TIME_RE.test(s) && !/^\d{4}$/.test(s));

  if (p0.videoId) {
    const vt = ((p0.watchEndpointMusicSupportedConfigs || {}).watchEndpointMusicConfig || {}).musicVideoType || '';
    const isVideo = vt === 'MUSIC_VIDEO_TYPE_OMV' || vt === 'MUSIC_VIDEO_TYPE_UGV';
    const track = {
      id: p0.videoId, title, artist: subs[0] || 'Unknown', artistId: null, album: '', albumId: null,
      duration: durToSec((runsOf(card.subtitle).map(r => r.text).find(t => TIME_RE.test((t || '').trim()))) || ''),
      thumb, type: isVideo ? 'video' : 'song'
    };
    out.songs.push(track);
    if (isVideo) out.videos.push(track);
  } else if (/^MPRE/.test(p0.browseId || '') || pageType.indexOf('ALBUM') >= 0) {
    out.albums.push({ id: p0.browseId, title, artist: subs[0] || '', artistId: null, thumb, year: '', type: 'album' });
  } else if (pageType === 'MUSIC_PAGE_TYPE_ARTIST' || /^UC/.test(p0.browseId || '')) {
    out.artists.push({ id: p0.browseId, name: title, thumb, type: 'artist' });
  } else if (pageType.indexOf('PLAYLIST') >= 0 || /^(VL|PL)/.test(p0.browseId || '')) {
    out.playlists.push({ id: p0.browseId, title, owner: subs[0] || '', thumb, type: 'playlist' });
  }

  // Also classify any additional tracks/items in the top card's shelf
  for (const item of (card.contents || [])) {
    classifyRow(item, out);
  }
}

// MusicTwoRowItem = carousel cards (home feed, artist shelves).
function twoRowItem(item) {
  const p0 = payloadOf(item.title) || (item.endpoint && item.endpoint.payload) || {};
  const pageType = ((p0.browseEndpointContextSupportedConfigs || {}).browseEndpointContextMusicConfig || {}).pageType || '';
  const thumb = lastThumb(item.thumbnail);
  const title = typeof item.title === 'string' ? item.title : T(item.title);
  const subs = [
    ...(item.subtitle ? [T(item.subtitle)] : []),
    ...((item.flex_columns || []).slice(1).map(c => T(c.title)))
  ].flatMap(t => String(t).split(' • '))
    .map(s => (s || '').trim())
    .filter(s => s && !KIND_RE.test(s) && !METRIC_RE.test(s) && !TIME_RE.test(s) && !/^\d{4}$/.test(s));

  const id = item.id || p0.browseId || p0.videoId || null;
  if (!id) return null;

  if (/^MPRE/.test(id) || pageType.indexOf('ALBUM') >= 0) {
    return { id, title, artist: subs[0] || '', artistId: null, thumb, year: '', type: 'album' };
  }
  if (/^UC/.test(id) || pageType === 'MUSIC_PAGE_TYPE_ARTIST') {
    return { id, name: title, thumb, type: 'artist' };
  }
  if (/^(VL|PL)/.test(id) || pageType.indexOf('PLAYLIST') >= 0) {
    return { id, title, owner: subs[subs.length - 1] || '', thumb, type: 'playlist' };
  }
  if (p0.videoId) {
    const vt = ((p0.watchEndpointMusicSupportedConfigs || {}).watchEndpointMusicConfig || {}).musicVideoType || '';
    return { id: p0.videoId, title, artist: subs[0] || '', thumb, duration: 0, type: vt === 'MUSIC_VIDEO_TYPE_ATV' ? 'song' : 'video' };
  }
  return null;
}

function parseShelfItems(contents) {
  const out = emptyResult();
  for (const node of contents || []) {
    if (node.type === 'MusicResponsiveListItem') classifyRow(node, out);
    else if (node.type === 'MusicTwoRowItem') {
      const it = twoRowItem(node);
      if (it && it.id) out[it.type + 's'].push(it);
    }
  }
  return out;
}

const emptyResult = () => ({ songs: [], videos: [], albums: [], artists: [], playlists: [] });

function dedupe(arr) {
  const seen = new Set();
  return arr.filter(x => x && x.id && !seen.has(x.id) && seen.add(x.id));
}

function finalize(out) {
  for (const k of Object.keys(out)) out[k] = dedupe(out[k]).slice(0, 40);
  return out;
}

// ---------- public API ----------

async function search(query, filter) {
  await ensureInit();
  if (!query || !query.trim()) return finalize(emptyResult());

  const base = await ytm.search(query.trim());
  if (!filter) return finalize(parseSearchResponse(base));

  // Match YT Music's filter chips dynamically and case-insensitively
  const LABEL = { songs: 'Songs', videos: 'Videos', albums: 'Albums', artists: 'Artists' };
  const out = emptyResult();
  try {
    if (filter === 'playlists') {
      for (const label of ['Featured playlists', 'Community playlists', 'Playlists']) {
        const chip = (base.filters || []).find(f => f.toLowerCase() === label.toLowerCase());
        if (chip) {
          try {
            const part = parseSearchResponse(await base.applyFilter(chip));
            out.playlists.push(...part.playlists);
          } catch { /* chip missing for some queries */ }
        }
      }
      if (!out.playlists.length) out.playlists = parseSearchResponse(base).playlists;
    } else {
      const target = LABEL[filter] || filter;
      const chip = (base.filters || []).find(f => f.toLowerCase() === target.toLowerCase() || f.toLowerCase().includes(filter));
      if (chip) {
        const part = parseSearchResponse(await base.applyFilter(chip));
        out[filter] = part[filter] || [];
        // Under songs filter, also include any tracks classified as videos
        if (filter === 'songs' && part.videos && part.videos.length) {
          out.songs.push(...part.videos);
        }
      }
      // If the filter chip was not found or produced 0 items, fall back to base search
      if (!out[filter].length) {
        const part = parseSearchResponse(base);
        out[filter] = part[filter] || [];
        if (filter === 'songs' && part.videos && part.videos.length) {
          out.songs.push(...part.videos);
        }
      }
    }
  } catch {
    const part = parseSearchResponse(base);
    out[filter] = part[filter] || [];
    if (filter === 'songs' && part.videos && part.videos.length) {
      out.songs.push(...part.videos);
    }
  }
  return finalize(out);
}

function parseSearchResponse(res) {
  const out = emptyResult();
  for (const node of res.contents || []) {
    if (node.type === 'MusicCardShelf') {
      classifyCardShelf(node, out);
    } else if (node.type === 'MusicShelf' || node.type === 'ItemSection' || node.type === 'MusicCarouselShelf' || node.type === 'Shelf') {
      for (const row of (node.contents || [])) {
        if (!classifyRow(row, out) && row.type === 'MusicTwoRowItem') {
          const it = twoRowItem(row);
          if (it && it.id) out[it.type + 's'].push(it);
        }
      }
    } else {
      classifyRow(node, out);
    }
  }
  return out;
}

async function suggestions(query) {
  await ensureInit();
  if (!query || !query.trim()) return [];
  try {
    const s = await ytm.getSearchSuggestions(query.trim());
    const out = [];
    for (const sec of (s || [])) {
      for (const it of (sec.contents || [])) {
        const txt = it.suggestion && it.suggestion.text;
        if (txt) out.push(txt);
      }
    }
    return out.slice(0, 8);
  } catch {
    return [];
  }
}

async function home() {
  await ensureInit();
  try {
    const h = await ytm.getHomeFeed();
    const shelves = [];
    for (const sec of (h.sections || [])) {
      const title = (sec.header && T(sec.header.title)) || '';
      const items = parseShelfItems(sec.contents);
      if (items.songs.length || items.albums.length || items.artists.length || items.playlists.length || items.videos.length) {
        shelves.push({ title, ...items });
      }
    }
    return shelves.slice(0, 5);
  } catch {
    return [];
  }
}

async function album(id) {
  await ensureInit();
  const a = await ytm.getAlbum(id);
  const header = a.header || {};
  const parts = T(header.subtitle).split(' • ').map(s => s.trim()).filter(s => s && !KIND_RE.test(s));
  return {
    id,
    title: T(header.title) || 'Album',
    artist: parts[0] || '',
    artistId: null,
    year: (T(header.subtitle).match(/\d{4}/) || [''])[0],
    thumb: lastThumb(header.thumbnail),
    tracks: (a.contents || []).filter(r => r.type === 'MusicResponsiveListItem' && r.id).map(trackFromRow)
  };
}

async function playlist(id) {
  await ensureInit();
  const p = await ytm.getPlaylist(id);
  const header = p.header || {};
  const parts = T(header.subtitle).split(' • ').map(s => s.trim()).filter(s => s && !KIND_RE.test(s));
  return {
    id,
    title: T(header.title) || 'Playlist',
    owner: parts[parts.length - 1] || '',
    thumb: lastThumb(header.thumbnail),
    tracks: (p.contents || []).filter(r => r.type === 'MusicResponsiveListItem' && r.id).map(trackFromRow)
  };
}

async function artist(id) {
  await ensureInit();
  const a = await ytm.getArtist(id);
  const header = a.header || {};
  const songs = [], albums = [], singles = [], videos = [], playlists = [];

  for (const sec of (a.sections || [])) {
    const shelfTitle = ((sec.header && T(sec.header.title)) || '').toLowerCase();
    const items = parseShelfItems(sec.contents);
    songs.push(...items.songs);
    videos.push(...items.videos);
    for (const al of items.albums) (shelfTitle.includes('single') ? singles : albums).push(al);
    playlists.push(...items.playlists);
  }

  return {
    id,
    name: T(header.title) || 'Artist',
    thumb: lastThumb(header.thumbnail),
    songs: dedupe(songs).slice(0, 10),
    albums: dedupe(albums).slice(0, 12),
    singles: dedupe(singles).slice(0, 12),
    videos: dedupe(videos).slice(0, 12),
    playlists: dedupe(playlists).slice(0, 6)
  };
}

// ---------- stream resolution (yt-dlp) ----------

function ytdlpUrl(videoId) {
  return new Promise((resolve, reject) => {
    const p = spawn(YTDLP, [
      '-g', '--no-warnings', '--no-playlist',
      '--extractor-args', 'youtube:player_client=android',
      '-f', 'bestaudio[protocol^=http][ext=m4a]/bestaudio[protocol^=http]/bestaudio/best',
      `https://www.youtube.com/watch?v=${videoId}`
    ], { windowsHide: true });
    let out = '', err = '';
    const to = setTimeout(() => { try { p.kill(); } catch {} reject(new Error('yt-dlp timed out')); }, 45000);
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('error', e => { clearTimeout(to); reject(e); });
    p.on('close', () => {
      clearTimeout(to);
      const lines = out.split(/\r?\n/).map(s => s.trim()).filter(s => s.startsWith('http'));
      if (lines.length) resolve(lines);
      else reject(new Error('yt-dlp: ' + (err.trim().split(/\r?\n/).pop() || 'no output').slice(-160)));
    });
  });
}

async function stream(id) {
  if (!id || !VIDEO_ID.test(id)) throw new Error('invalid track id');

  const cached = streamCache.get(id);
  if (cached && cached.expires > Date.now()) return { urls: cached.urls };

  const urls = await ytdlpUrl(id);
  streamCache.set(id, { urls, expires: Date.now() + 4.5 * 3600 * 1000 });
  pruneCache(streamCache, 40);
  return { urls };
}

// ---------- lyrics ----------

function parseLRC(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\s*\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    if (m) out.push({ t: parseInt(m[1], 10) * 60 + parseFloat(m[2]), text: m[3].trim() });
    else if (line.trim() && !line.trim().startsWith('[')) out.push({ t: null, text: line.trim() });
  }
  return out.filter(l => l.text);
}

function cleanTitle(title) {
  return String(title)
    .replace(/\((?:feat|ft|official|lyric[s]?|audio|video|mv|remix|hd|4k)[^)]*\)/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .trim();
}

async function fetchLrclib(title, artist) {
  const url = `https://lrclib.net/api/search?q=${encodeURIComponent((title + ' ' + artist).trim())}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MyMusic/1.0 (desktop player)' } });
  if (!res.ok) throw new Error('lrclib ' + res.status);
  const list = await res.json();
  if (!Array.isArray(list) || !list.length) return null;
  const score = (x) => {
    let s = 0;
    if (artist && x.artistName && x.artistName.toLowerCase().includes(artist.toLowerCase())) s += 2;
    if (title && x.trackName && x.trackName.toLowerCase().includes(title.toLowerCase())) s += 2;
    if (x.syncedLyrics) s += 1;
    return s;
  };
  return list.slice().sort((a, b) => score(b) - score(a))[0];
}

async function lyrics(track) {
  await ensureInit();
  if (!track || !track.title) return { synced: null, plain: null };
  const cacheKey = track.id || track.title;
  if (lyricsCache.has(cacheKey)) return lyricsCache.get(cacheKey);

  const title = cleanTitle(track.title);
  const artist = (track.artist || '').split(/[,|]/)[0].trim();
  let result = { synced: null, plain: null };

  // 1) lrclib.net: synced (timed) lyrics preferred
  try {
    const best = await fetchLrclib(title, artist);
    if (best) {
      result = best.syncedLyrics
        ? { synced: parseLRC(best.syncedLyrics), plain: best.plainLyrics || null }
        : { synced: null, plain: best.plainLyrics || null };
    }
  } catch { /* fall through */ }

  // 2) YouTube Music's own lyrics endpoint (plain text)
  if (!result.synced && !result.plain && track.id) {
    try {
      const ly = await ytm.getLyrics(track.id);
      const text = T(ly && ly.description);
      if (text) result = { synced: null, plain: text };
    } catch { /* none */ }
  }

  lyricsCache.set(cacheKey, result);
  pruneCache(lyricsCache, 200);
  return result;
}

async function translate(text, targetLang = 'en') {
  if (!text || !String(text).trim()) return '';
  const str = String(text).slice(0, 50000);
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(str)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0].map(item => (item && item[0]) ? item[0] : '').join('');
    }
    return str;
  } catch (e) {
    console.error('[ytm:translate] failed:', (e && e.message) || e);
    return str;
  }
}

async function radio(id) {
  await ensureInit();
  if (!id || !VIDEO_ID.test(id)) return [];
  const tracks = [];
  try {
    const rel = await ytm.getRelated(id);
    for (const shelf of (rel && rel.contents) || []) {
      for (const row of (shelf.contents || [])) {
        if (row.type === 'MusicResponsiveListItem') {
          const t = trackFromRow(row);
          if (t && t.id && t.id !== id) tracks.push(t);
        }
      }
    }
  } catch (e) {
    console.error('[ytm:radio] getRelated failed:', (e && e.message) || e);
  }

  // Fallback: If getRelated returned fewer than 5 tracks, search similar tracks
  if (tracks.length < 5) {
    try {
      const info = await ytm.getInfo(id);
      const title = info && info.basic_info && info.basic_info.title;
      const author = info && info.basic_info && info.basic_info.author;
      const query = [author, title].filter(Boolean).join(' ');
      if (query) {
        const s = await search(query, 'songs');
        for (const t of (s.songs || [])) {
          if (t && t.id && t.id !== id) tracks.push(t);
        }
      }
    } catch (e) {
      console.error('[ytm:radio] fallback search failed:', (e && e.message) || e);
    }
  }

  return dedupe(tracks).slice(0, 25);
}

module.exports = { search, suggestions, home, album, artist, playlist, stream, lyrics, translate, radio };
