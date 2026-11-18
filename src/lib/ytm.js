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
const searchCache = new Map(); // key -> { result, expires }
const suggestionsCache = new Map(); // query -> { result, expires }
const albumCache = new Map();       // album id -> { result, expires }
const artistCache = new Map();      // artist id -> { result, expires }

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
  const p0 = payloadOf(row.flex_columns && row.flex_columns[0] && row.flex_columns[0].title) || (row.endpoint && row.endpoint.payload) || {};
  const vt = ((p0.watchEndpointMusicSupportedConfigs || {}).watchEndpointMusicConfig || {}).musicVideoType || '';
  const isVideo = (row.item_type || '').toLowerCase() === 'video' || vt === 'MUSIC_VIDEO_TYPE_OMV' || vt === 'MUSIC_VIDEO_TYPE_UGV';

  const artists = row.artists || row.authors || (row.author ? [row.author] : []);
  const album = row.album;
  const title = row.title || T(row.flex_columns && row.flex_columns[0] && row.flex_columns[0].title) || 'Unknown title';
  const id = row.id || p0.videoId || null;

  return {
    id,
    title,
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
  const p0 = (row.endpoint && row.endpoint.payload) || {};
  const authorName = (row.author && row.author.name) || (row.artists && row.artists[0] && row.artists[0].name) || metaParts(row)[0] || '';
  const authorId = (row.author && (row.author.channel_id || (row.author.endpoint && row.author.endpoint.payload && row.author.endpoint.payload.browseId))) || (row.artists && row.artists[0] && row.artists[0].channel_id) || null;
  const title = row.title || T(row.flex_columns && row.flex_columns[0] && row.flex_columns[0].title) || 'Unknown album';
  const id = row.id || p0.browseId || null;
  return {
    id,
    title,
    artist: authorName,
    artistId: authorId,
    thumb: lastThumb(row.thumbnail),
    year: (typeof row.year === 'object' ? T(row.year) : row.year) || '',
    type: 'album'
  };
}

function artistFromRow(row) {
  const p0 = (row.endpoint && row.endpoint.payload) || {};
  const name = row.name || row.title || T(row.flex_columns && row.flex_columns[0] && row.flex_columns[0].title) || (row.author && row.author.name) || 'Unknown artist';
  const id = row.id || p0.browseId || null;
  return {
    id,
    name,
    thumb: lastThumb(row.thumbnail),
    type: 'artist'
  };
}

function playlistFromRow(row) {
  const p0 = (row.endpoint && row.endpoint.payload) || {};
  const owner = (row.author && row.author.name) || metaParts(row).pop() || '';
  const title = row.title || T(row.flex_columns && row.flex_columns[0] && row.flex_columns[0].title) || 'Unknown playlist';
  const id = row.id || p0.browseId || null;
  return {
    id,
    title,
    owner,
    thumb: lastThumb(row.thumbnail),
    type: 'playlist'
  };
}

function classifyRow(row, out) {
  if (!row) return false;
  const p0 = payloadOf(row.flex_columns && row.flex_columns[0] && row.flex_columns[0].title) || (row.endpoint && row.endpoint.payload) || {};
  const id = row.id || p0.videoId || p0.browseId || null;
  if (!id) return false;

  const itemType = (row.item_type || '').toLowerCase();
  if (itemType === 'song' || itemType === 'video') { out[itemType === 'song' ? 'songs' : 'videos'].push(trackFromRow(row)); return true; }
  if (itemType === 'album' || itemType === 'single' || itemType === 'single-ep' || itemType === 'ep') { out.albums.push(albumFromRow(row)); return true; }
  if (itemType === 'artist') { out.artists.push(artistFromRow(row)); return true; }
  if (itemType === 'playlist') { out.playlists.push(playlistFromRow(row)); return true; }

  // no item_type: infer by id shape
  if (/^MPRE/.test(id)) { out.albums.push(albumFromRow(row)); return true; }
  if (/^UC/.test(id)) { out.artists.push(artistFromRow(row)); return true; }
  if (/^(VL|PL)/.test(id)) { out.playlists.push(playlistFromRow(row)); return true; }
  if (/^[A-Za-z0-9_-]{11}$/.test(id)) {
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

// Map frontend filter tabs to direct YouTube Music InnerTube search types
const FILTER_TYPE_MAP = {
  songs: 'song',
  videos: 'video',
  albums: 'album',
  artists: 'artist',
  playlists: 'playlist'
};

const SEARCH_CACHE_MAX = 100;
const SEARCH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function retryWithBackoff(fn, retries = 2, delayMs = 600) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = (err && err.message) || String(err);
      const isRateLimit = /429|rate\s*limit|too many requests|sign in to confirm|confirm your age/i.test(msg);
      if (!isRateLimit && attempt > 0) throw err;
      if (attempt < retries) {
        const wait = delayMs * Math.pow(2, attempt) + Math.random() * 200;
        console.warn(`[ytm] Rate limit or transient error on attempt ${attempt + 1}, retrying in ${Math.round(wait)}ms:`, msg);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  const msg = (lastErr && lastErr.message) || String(lastErr);
  if (/429|rate\s*limit|too many requests/i.test(msg)) {
    throw new Error('YouTube is temporarily rate-limiting requests. Please wait a moment and try again.');
  }
  throw lastErr;
}

// ---------- public API ----------

async function search(query, filter) {
  await ensureInit();
  const q = (query || '').trim();
  if (!q) return finalize(emptyResult());

  const cacheKey = `${filter || 'all'}:${q.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.result;
  }

  const directType = FILTER_TYPE_MAP[filter];
  let out = emptyResult();

  // Fast direct 1-step search using InnerTube protobuf filter
  if (directType) {
    try {
      const res = await retryWithBackoff(() => ytm.search(q, { type: directType }), 1, 500);
      const parsed = parseSearchResponse(res);
      if (filter === 'songs') {
        out.songs = [...parsed.songs, ...(parsed.videos || [])];
      } else {
        out[filter] = parsed[filter] || [];
      }
    } catch {
      // Direct filter error, fallback to base
    }
  }

  // Fallback to base search if direct query returned no items or no specific filter requested
  if (!filter || !out[filter] || out[filter].length === 0) {
    try {
      const base = await retryWithBackoff(() => ytm.search(q), 1, 500);
      const parsed = parseSearchResponse(base);
      if (!filter) {
        out = parsed;
      } else {
        out[filter] = parsed[filter] || [];
        if (filter === 'songs' && parsed.videos && parsed.videos.length) {
          out.songs.push(...parsed.videos);
        }
      }
    } catch (err) {
      const msg = (err && err.message) || String(err);
      if (/rate-limit|too many requests/i.test(msg)) throw err;
    }
  }

  const result = finalize(out);
  pruneCache(searchCache, SEARCH_CACHE_MAX);
  searchCache.set(cacheKey, { result, expires: Date.now() + SEARCH_CACHE_TTL });
  return result;
}

function parseSearchResponse(res) {
  const out = emptyResult();

  function parseNodes(nodes) {
    for (const node of (nodes || [])) {
      if (!node) continue;
      if (node.type === 'MusicCardShelf') {
        classifyCardShelf(node, out);
      } else if (node.type === 'MusicResponsiveListItem') {
        classifyRow(node, out);
      } else if (node.type === 'MusicTwoRowItem') {
        const it = twoRowItem(node);
        if (it && it.id) out[it.type + 's'].push(it);
      } else if (node.contents && Array.isArray(node.contents)) {
        parseNodes(node.contents);
      } else if (node.items && Array.isArray(node.items)) {
        parseNodes(node.items);
      } else {
        classifyRow(node, out);
      }
    }
  }

  parseNodes(res && res.contents);
  return out;
}

const SUGGESTIONS_CACHE_MAX = 100;
const SUGGESTIONS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const ALBUM_CACHE_TTL = 30 * 60 * 1000;      // 30 minutes
const ARTIST_CACHE_TTL = 30 * 60 * 1000;     // 30 minutes

async function suggestions(query) {
  await ensureInit();
  const q = (query || '').trim();
  if (!q) return [];

  const cacheKey = q.toLowerCase();
  const cached = suggestionsCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.result;

  try {
    const s = await ytm.getSearchSuggestions(q);
    const out = [];
    for (const sec of (s || [])) {
      for (const it of (sec.contents || [])) {
        const txt = it.suggestion && it.suggestion.text;
        if (txt) out.push(txt);
      }
    }
    const result = out.slice(0, 8);
    pruneCache(suggestionsCache, SUGGESTIONS_CACHE_MAX);
    suggestionsCache.set(cacheKey, { result, expires: Date.now() + SUGGESTIONS_CACHE_TTL });
    return result;
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
  if (!id) return null;
  const cached = albumCache.get(id);
  if (cached && cached.expires > Date.now()) return cached.result;
  await ensureInit();
  const a = await ytm.getAlbum(id);
  const header = a.header || {};
  const parts = T(header.subtitle).split(' • ').map(s => s.trim()).filter(s => s && !KIND_RE.test(s));
  const result = {
    id,
    title: T(header.title) || 'Album',
    artist: parts[0] || '',
    artistId: null,
    year: (T(header.subtitle).match(/\d{4}/) || [''])[0],
    thumb: lastThumb(header.thumbnail),
    tracks: (a.contents || []).filter(r => r.type === 'MusicResponsiveListItem' && r.id).map(trackFromRow)
  };
  pruneCache(albumCache, 50);
  albumCache.set(id, { result, expires: Date.now() + ALBUM_CACHE_TTL });
  return result;
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
  if (!id) return null;
  const cached = artistCache.get(id);
  if (cached && cached.expires > Date.now()) return cached.result;
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

  const result = {
    id,
    name: T(header.title) || 'Artist',
    thumb: lastThumb(header.thumbnail),
    songs: dedupe(songs).slice(0, 10),
    albums: dedupe(albums).slice(0, 12),
    singles: dedupe(singles).slice(0, 12),
    videos: dedupe(videos).slice(0, 12),
    playlists: dedupe(playlists).slice(0, 6)
  };
  pruneCache(artistCache, 50);
  artistCache.set(id, { result, expires: Date.now() + ARTIST_CACHE_TTL });
  return result;
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

  const urls = await retryWithBackoff(() => ytdlpUrl(id), 2, 800);
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

const artistThumbCache = new Map();

async function artistThumb(name, artistId) {
  const normKey = (artistId || name || '').trim().toLowerCase();
  if (!normKey) return null;
  if (artistThumbCache.has(normKey)) return artistThumbCache.get(normKey);

  await ensureInit();

  let thumb = null;
  let resolvedId = artistId || null;

  // 1. Direct fetch if artistId looks like a valid browseId (UC...)
  if (resolvedId && /^UC/.test(resolvedId)) {
    try {
      const a = await artist(resolvedId);
      if (a && a.thumb) thumb = a.thumb;
    } catch {}
  }

  // 2. Search by exact artist name
  if (!thumb && name) {
    try {
      const s = await search(name, 'artists');
      const first = s.artists && s.artists[0];
      if (first && first.thumb) {
        thumb = first.thumb;
        if (!resolvedId && first.id) resolvedId = first.id;
      }
    } catch {}
  }

  // 3. Fallback: search primary artist name before comma, &, or feat
  if (!thumb && name && /[,&]|feat\.|ft\./i.test(name)) {
    const primary = name.split(/[,&]|feat\.|ft\./i)[0].trim();
    if (primary && primary !== name) {
      try {
        const s = await search(primary, 'artists');
        const first = s.artists && s.artists[0];
        if (first && first.thumb) {
          thumb = first.thumb;
          if (!resolvedId && first.id) resolvedId = first.id;
        }
      } catch {}
    }
  }

  if (thumb) {
    if (thumb.includes('=w60-h60')) {
      thumb = thumb.replace('=w60-h60', '=w240-h240');
    }
    const result = { thumb, id: resolvedId };
    artistThumbCache.set(normKey, result);
    if (name) artistThumbCache.set(name.trim().toLowerCase(), result);
    return result;
  }

  return null;
}

module.exports = { search, suggestions, home, album, artist, playlist, stream, lyrics, translate, radio, artistThumb };
