'use strict';

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDur = (s) => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const call = (ch, payload = {}) => window.api.invoke(ch, payload).then(r => {
  if (!r || !r.ok) throw new Error((r && r.error) || 'call failed');
  return r.data;
});

// ---------- icons ----------
const I = {
  eq: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  import: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3"/>',
  stats: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  palette: '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7H17c3.3 0 6-2.7 6-6 0-5.5-4.5-10-10-10z"/><circle cx="7.5" cy="11.5" r="1.5"/><circle cx="10.5" cy="7.5" r="1.5"/><circle cx="14.5" cy="7.5" r="1.5"/><circle cx="17.5" cy="11.5" r="1.5"/>',
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  heart: '<path d="M12 21s-7-4.6-9.3-8.6C.6 8.9 2.6 5 6.2 5c2 0 3.6 1 4.6 2.6L12 9l1.2-1.4C14.2 6 15.8 5 17.8 5c3.6 0 5.6 3.9 3.5 7.4C19 16.4 12 21 12 21z"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>',
  next: '<path d="M6 5v14l8.5-7zM16 5h3v14h-3z"/>',
  prev: '<path d="M18 5v14l-8.5-7zM5 5h3v14H5z"/>',
  shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  repeat: '<path d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>',
  vol: '<path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  volmute: '<path d="M11 5L6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/>',
  queue: '<path d="M3 6h13M3 12h13M3 18h9M18 10v8M15 18a3 3 0 1 0 6 0 3 3 0 0 0-6 0"/>',
  lyrics: '<path d="M4 5h16M4 10h16M4 15h10M4 20h7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  dots: '<circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  fwd: '<path d="M9 6l6 6-6 6"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  pencil: '<path d="M17 3l4 4L8 20l-5 1 1-5z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  viz: '<path d="M3 12h3l2-7 3 14 3-9 2 5h5"/>',
  mini: '<rect x="3" y="3" width="18" height="18" rx="3"/><rect x="11" y="11" width="8" height="8" rx="1.5"/>',
  translate: '<path d="M5 8h6M8 5v6M4 14c2.5 0 5-1.5 6-4M13 19l4-9 4 9M15 16h4"/>',
  radio: '<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5m-8.4 0c-2.3-2.3-2.3-6.1 0-8.5m11.3-2.8c4 4 4 10.3 0 14.2m-14.2 0c-4-4-4-10.3 0-14.2"/>'
};
const FILLED = new Set(['play', 'pause', 'next', 'prev']);
const icon = (n, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="${FILLED.has(n) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n] || ''}</svg>`;

// ---------- state ----------
const audio = $('#audio');

const S = {
  store: null,
  view: 'home', params: {},
  back: [], fwd: [],
  queue: [], order: [], oi: -1,
  curUrls: null, curUrlIdx: 0, curTrack: null, playToken: 0,
  recorded: new Set(),
  lyrics: null, lyricsId: null,
  lyricsOpen: false,
  translatedLyrics: new Map(), showTranslated: false,
  search: { q: '', filter: 'songs', results: {}, tok: 0 },
  errStreak: 0,
  homeTok: 0,
  viewTok: 0,
  seeking: false,
  lists: {},           // listKey -> track array (for row buttons)
  renderCtx: null,     // { listKey } of the main list in current view
  menuTrack: null, menuExtra: null,
  lastVol: null
};

const curTrack = () => (S.order[S.oi] != null ? S.queue[S.order[S.oi]] : null);
const isFav = (t) => S.store.favorites.some(f => f.id === t.id);
const settings = () => S.store.settings;

// ---------- boot ----------
boot();

async function boot() {
  try {
    S.store = await call('library:get');
  } catch (err) {
    console.error('Failed to load store, using defaults:', err);
    S.store = {
      favorites: [],
      playlists: [],
      recent: [],
      settings: {
        volume: 0.8, repeat: 'off', shuffle: false, viz: 'bars', radio: true,
        speed: 1.0, pitchLock: true, eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], eqPreset: 'flat',
        wallpaper: '', wallpaperDim: 60, accentHue: 'auto', closeToTray: false
      },
      lyricsOffsets: {},
      lastQueue: null,
      playStats: { totalPlays: 0, totalSeconds: 0, tracks: {}, artists: {} }
    };
  }

  try {
    audio.volume = Math.min(1, Math.max(0, settings().volume ?? 0.8));
    buildShell();
    bindShellEvents();
    vizInit();
    applyWallpaper();
    applySpeedAndPitch();

    if (window.api && window.api.on) {
      window.api.on('cmd:toggle', () => togglePlay());
      window.api.on('cmd:next', () => next());
      window.api.on('cmd:prev', () => prev());
    }

    const lq = S.store.lastQueue;
    if (lq && Array.isArray(lq.tracks) && lq.tracks.length) {
      S.queue = lq.tracks;
      S.order = S.queue.map((_, i) => i);
      S.oi = Math.max(0, Math.min(lq.index | 0, S.queue.length - 1));
      if (S.queue[S.oi]) {
        setNowPlaying(S.queue[S.oi], true);
      }
    }
    go('home', {}, { push: false });
    console.log('renderer:ready');
  } catch (err) {
    console.error('Renderer boot error:', err);
  }
}

function buildShell() {
  $('#sidebar').innerHTML = `
    <div class="brand"><span class="logo">${icon('music')}</span>My Music</div>
    <nav>
      <button class="navbtn" data-nav="home">${icon('home')}Home</button>
      <button class="navbtn" data-nav="search">${icon('search')}Search</button>
      <button class="navbtn" data-nav="liked">${icon('heart')}Liked Songs</button>
      <button class="navbtn" data-nav="recent">${icon('clock')}Recently Played</button>
      <button class="navbtn" data-nav="downloads">${icon('download')}Downloads</button>
      <button class="navbtn" data-nav="stats">${icon('stats')}Stats</button>
      <button class="navbtn" data-nav="settings">${icon('settings')}Settings</button>
    </nav>
    <div class="pl-head">
      <span>Playlists</span>
      <div style="display:flex;align-items:center;gap:4px;">
        <button data-action="pl-import" title="Import playlist (Spotify, YouTube, CSV)">${icon('import')}</button>
        <button data-action="pl-create" title="New playlist">${icon('plus')}</button>
      </div>
    </div>
    <div id="plList"></div>`;

  $('#btnBack').innerHTML = icon('back');
  $('#btnFwd').innerHTML = icon('fwd');

  $('#playerbar').innerHTML = `
    <div class="pb-left">
      <img id="np-thumb" src="" alt="">
      <div class="np-meta">
        <div id="np-title" class="np-title">My Music</div>
        <div id="np-artist" class="np-artist">Search YouTube Music to start playing</div>
      </div>
      <button id="pb-fav" class="iconbtn" data-action="pb-fav" title="Like">${icon('heart')}</button>
    </div>
    <div class="pb-center">
      <div class="pb-ctrls">
        <button id="pb-shuffle" class="iconbtn" data-action="pb-shuffle" title="Shuffle">${icon('shuffle')}</button>
        <button id="pb-prev" class="iconbtn" data-action="pb-prev" title="Previous">${icon('prev')}</button>
        <button id="pb-play" data-action="pb-play" title="Play / Pause">${icon('play')}</button>
        <button id="pb-next" class="iconbtn" data-action="pb-next" title="Next">${icon('next')}</button>
        <button id="pb-repeat" class="iconbtn" data-action="pb-repeat" title="Repeat">${icon('repeat')}</button>
        <button id="pb-radio" class="iconbtn" data-action="pb-radio" title="Autoplay / Radio">${icon('radio')}</button>
      </div>
      <div class="pb-seek">
        <span id="t-cur">0:00</span>
        <input id="seek" type="range" min="0" max="100" step="0.1" value="0">
        <span id="t-total">0:00</span>
      </div>
    </div>
    <div class="pb-right">
      <button id="pb-eq" class="iconbtn" data-action="pb-eq" title="Equalizer & DSP">${icon('eq')}</button>
      <button id="pb-viz" class="iconbtn" data-action="pb-viz" title="Visualizer">${icon('viz')}</button>
      <button id="pb-mini" class="iconbtn" data-action="pb-mini" title="Mini Mode (Floating Player)">${icon('mini')}</button>
      <button id="pb-queue" class="iconbtn" data-action="pb-queue" title="Queue">${icon('queue')}</button>
      <button id="pb-lyrics" class="iconbtn" data-action="pb-lyrics" title="Lyrics">${icon('lyrics')}</button>
      <button id="pb-vol" class="iconbtn" data-action="pb-mute" title="Mute">${icon('vol')}</button>
      <input id="vol" type="range" min="0" max="1" step="0.01" value="${audio.volume}">
    </div>`;

  $('#queuePanel').innerHTML = `
    <div class="panel-head">
      <span>Queue</span>
      <div style="display:flex;align-items:center;gap:6px;">
        <button id="q-radio-toggle" class="ghostbtn ${settings().radio ? 'on' : ''}" data-action="toggle-radio" title="Autoplay similar songs when queue ends" style="padding:4px 10px;font-size:12px;display:flex;align-items:center;gap:5px;">
          ${icon('radio')} Autoplay
        </button>
        <button class="iconbtn" data-action="panel-close" data-panel="queuePanel">${icon('close')}</button>
      </div>
    </div>
    <div id="queueBody" class="panel-body"></div>`;
  $('#lyricsPanel').innerHTML = `
    <div class="panel-head">Lyrics<button class="iconbtn" data-action="panel-close" data-panel="lyricsPanel">${icon('close')}</button></div>
    <div id="lyricsBody" class="panel-body"></div>`;

  updateVolFill();
  renderSidebarPlaylists();
  updatePlayBtn();
  updateShuffleRepeatBtns();
  updateFavBtn();
}

function renderSidebarPlaylists() {
  $('#plList').innerHTML = S.store.playlists.map(pl =>
    `<button class="plbtn ${S.view === 'localpl' && S.params.id === pl.id ? 'on' : ''}" data-action="local-pl" data-id="${esc(pl.id)}" title="${esc(pl.name)}">${icon('music')}${esc(pl.name)}</button>`
  ).join('') || '<div class="q-empty" style="padding:4px 12px">No playlists yet</div>';
}

// ---------- persistence ----------
const mutate = async (payload) => { S.store = await call('library:mutate', payload); return S.store; };
const saveSettings = debounce(() => { mutate({ type: 'settings.set', patch: { volume: audio.volume, repeat: settings().repeat, shuffle: settings().shuffle, viz: settings().viz, radio: settings().radio } }); }, 400);
const saveLastQueue = debounce(() => {
  if (!audio.src) return;
  mutate({ type: 'lastQueue.set', data: { tracks: S.queue, index: S.order[S.oi] ?? 0, time: audio.currentTime || 0 } });
}, 800);

// ---------- router ----------
const VIEWS = {
  home: () => renderHome(),
  search: () => renderSearch(),
  album: () => renderAlbum(),
  artist: () => renderArtist(),
  ytplaylist: () => renderYtPlaylist(),
  localpl: () => renderLocalPl(),
  liked: () => renderLiked(),
  recent: () => renderRecent(),
  downloads: (tok) => renderDownloads(tok),
  stats: (tok) => renderStats(tok),
  settings: (tok) => renderSettings(tok)
};

function go(view, params = {}, opts = {}) {
  if (opts.push !== false && S.view) {
    S.back.push({ view: S.view, params: S.params });
    if (S.back.length > 50) S.back.shift();
    S.fwd = [];
  }
  S.view = view;
  S.params = params;
  render();
  updateNavActive();
  $('#btnBack').disabled = !S.back.length;
  $('#btnFwd').disabled = !S.fwd.length;
}

function navBack() {
  const h = S.back.pop();
  if (!h) return;
  S.fwd.push({ view: S.view, params: S.params });
  S.view = h.view; S.params = h.params;
  if (S.view === 'search' && S.params.q != null) {
    S.search.q = S.params.q;
    const input = $('#searchInput');
    if (input) input.value = S.params.q;
  }
  render(); updateNavActive();
}
function navFwd() {
  const h = S.fwd.pop();
  if (!h) return;
  S.back.push({ view: S.view, params: S.params });
  S.view = h.view; S.params = h.params;
  if (S.view === 'search' && S.params.q != null) {
    S.search.q = S.params.q;
    const input = $('#searchInput');
    if (input) input.value = S.params.q;
  }
  render(); updateNavActive();
}

function updateNavActive() {
  $$('#sidebar .navbtn').forEach(b => b.classList.toggle('on', b.dataset.nav === S.view || (S.view === 'localpl' && b.dataset.nav === 'search')));
  renderSidebarPlaylists();
}

function render() {
  closeMenu();
  $('#sugg').classList.remove('open');
  S.lists = {};
  const tok = ++S.viewTok;
  (VIEWS[S.view] || VIEWS.home)(tok);
}

const content = $('#content');
function set(html) { content.innerHTML = html; content.scrollTop = 0; }

function rerenderKeepScroll() {
  const st = content.scrollTop;
  const tok = ++S.viewTok;
  (VIEWS[S.view] || VIEWS.home)(tok);
  content.scrollTop = st;
}

function updateNavActiveGuard() { /* nav highlight refresh is cheap; done in updateNavActive */ }

// ---------- shared render pieces ----------
function trackRow(t, listKey, i, opts = {}) {
  const liked = isFav(t);
  const cur = curTrack();
  const playing = cur && cur.id === t.id && (audio.src || S.playing);
  return `<div class="trow ${playing ? 'playing' : ''}" data-list="${esc(listKey)}" data-idx="${i}" data-tid="${esc(t.id)}">
    <button class="rownum" data-action="row-play" title="Play">${i + 1}</button>
    <img class="rthumb" src="${esc(t.thumb)}" alt="">
    <div class="rmeta">
      <div class="rtitle">${esc(t.title)}</div>
      <div class="rartist">${t.artistId ? `<a data-action="artist" data-id="${esc(t.artistId)}">${esc(t.artist)}</a>` : esc(t.artist)}</div>
    </div>
    <div class="ralbum">${t.albumId ? `<a data-action="album" data-id="${esc(t.albumId)}">${esc(t.album)}</a>` : esc(t.album)}</div>
    <span class="rdur">${t.duration ? fmtDur(t.duration) : ''}</span>
    <button class="rheart ${liked ? 'liked' : ''}" data-action="row-fav" title="Like">${icon('heart', liked ? 'filled' : '')}</button>
    <button class="rmenu" data-action="row-menu" title="More">${icon('dots')}</button>
  </div>`;
}

const rowsBlock = (tracks, listKey) => `<div class="trows">${tracks.map((t, i) => trackRow(t, listKey, i)).join('')}</div>`;

function card(item, action, round = false) {
  const label = item.title || item.name || '';
  const sub = item.artist || item.owner || item.subscribers || '';
  return `<button class="card ${round ? 'round' : ''}" data-action="${action}" data-id="${esc(item.id)}">
    <div class="card-thumb"><img src="${esc(item.thumb)}" alt=""></div>
    <div class="card-title">${esc(label)}</div>
    <div class="card-sub">${esc(sub)}</div>
  </button>`;
}

const cardsBlock = (items, action, round = false) => `<div class="grid">${items.map(it => card(it, action, round)).join('')}</div>`;

function ctxHeader({ type, title, meta, thumb, round = false, listKey, extraActions = '' }) {
  return `<div class="ctx-head">
    ${thumb ? `<img class="ctximg ${round ? 'round' : ''}" src="${esc(thumb)}" alt="">` : ''}
    <div class="ctx-info">
      <div class="ctx-type">${esc(type)}</div>
      <div class="ctx-title">${esc(title)}</div>
      <div class="ctx-meta">${meta}</div>
      <div class="ctx-actions">
        ${listKey ? `<button class="playbig" data-action="ctx-play" data-list="${esc(listKey)}" title="Play all">${icon('play')}</button>` : ''}
        ${extraActions}
      </div>
    </div>
  </div>`;
}

// ---------- views ----------
function renderHome() {
  const rec = S.store.recent.slice(0, 8);
  const fav = S.store.favorites.slice(0, 8);
  S.lists['home-recent'] = rec;
  S.lists['home-liked'] = fav;

  let html = `<h1 class="page-title">Home</h1>`;
  if (rec.length) {
    S.lists['home-recent'] = S.store.recent;
    html += `<div class="sechead"><h2>Recently played</h2><button class="seeall" data-nav="recent">Show all</button></div>` + rowsBlock(rec, 'home-recent');
  }
  if (fav.length) {
    S.lists['home-liked'] = S.store.favorites;
    html += `<div class="sechead"><h2>Liked songs</h2><button class="seeall" data-nav="liked">Show all</button></div>` + rowsBlock(fav, 'home-liked');
  }
  if (!rec.length && !fav.length) {
    html += `<div class="empty-hero"><b>Welcome to My Music</b><br>Type in the search bar above to find any song, album, artist or playlist from YouTube Music.</div>`;
  }
  html += `<div id="homeFeed"></div>`;
  set(html);
  loadHomeFeed();
}

async function loadHomeFeed() {
  const tok = ++S.homeTok;
  try {
    const shelves = await call('ytm:home');
    if (tok !== S.homeTok || S.view !== 'home') return;
    const el = $('#homeFeed');
    if (!el) return;
    let html = '';
    shelves.forEach((sh, n) => {
      const key = 'home-feed-' + n;
      const items = [...sh.albums, ...sh.playlists, ...sh.artists, ...sh.videos, ...sh.songs];
      if (!items.length) return;
      html += `<div class="sechead"><h2>${esc(sh.title || 'For you')}</h2></div>`;
      if (sh.albums.length || sh.playlists.length || sh.artists.length) {
        const cards = [...sh.albums, ...sh.playlists, ...sh.artists].slice(0, 12);
        html += `<div class="grid">${cards.map(it => card(it, it.type === 'artist' ? 'artist' : it.type === 'playlist' ? 'ytplaylist' : 'album', it.type === 'artist')).join('')}</div>`;
      } else {
        S.lists[key] = sh.songs.slice(0, 8);
        html += rowsBlock(S.lists[key], key);
      }
    });
    el.innerHTML = html;
  } catch { /* home feed is optional */ }
}

function renderSearch() {
  const q = S.params.q != null ? S.params.q : S.search.q;
  S.search.q = q;
  const input = $('#searchInput');
  if (input && q && input.value !== q) input.value = q;
  const tabs = [['songs', 'Songs'], ['videos', 'Videos'], ['albums', 'Albums'], ['artists', 'Artists'], ['playlists', 'Playlists']];
  set(`<h1 class="page-title">${q ? `Results for “${esc(q)}”` : 'Search'}</h1>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${k === S.search.filter ? 'on' : ''}" data-action="tab" data-tab="${k}">${l}</button>`).join('')}</div>
    <div id="searchBody"><div class="loading">${q ? 'Searching…' : 'Type in the search bar above.'}</div></div>`);
  if (q) {
    if (S.search.results[S.search.filter]) renderSearchBody();
    else loadSearch(S.search.filter || 'songs');
  }
}

function setTabActive(filter) {
  $$('#content .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === filter));
}

async function loadSearch(filter) {
  S.search.filter = filter;
  setTabActive(filter);
  const q = S.search.q;
  if (!q) return;
  if (S.search.results[filter]) { renderSearchBody(); return; }
  const tok = ++S.search.tok;
  const body = $('#searchBody');
  if (body) body.innerHTML = '<div class="loading">Searching…</div>';
  let r;
  try {
    r = await call('ytm:search', { query: q, filter });
  } catch (e) {
    if (tok === S.search.tok && body) body.innerHTML = `<div class="loading">Search failed: ${esc(e.message)}</div>`;
    return;
  }
  if (tok !== S.search.tok || S.search.q !== q) return;
  S.search.results[filter] = r;
  try {
    renderSearchBody();
  } catch (err) {
    console.error('Error rendering search results:', err);
    if (body) body.innerHTML = `<div class="loading">Render failed: ${esc(err.message)}</div>`;
  }
}

function renderSearchBody() {
  const body = $('#searchBody');
  if (!body) return;
  const r = S.search.results[S.search.filter];
  if (!r) { body.innerHTML = '<div class="loading">Searching…</div>'; return; }
  const key = 'search-' + S.search.filter;

  if (S.search.filter === 'songs' || S.search.filter === 'videos') {
    const list = r[S.search.filter] || [];
    S.lists[key] = list;
    body.innerHTML = list.length ? rowsBlock(list, key) : '<div class="empty-note">Nothing found.</div>';
  } else if (S.search.filter === 'albums') {
    S.lists[key] = [];
    body.innerHTML = (r.albums || []).length ? cardsBlock(r.albums, 'album') : '<div class="empty-note">No albums found.</div>';
  } else if (S.search.filter === 'artists') {
    body.innerHTML = (r.artists || []).length ? cardsBlock(r.artists, 'artist', true) : '<div class="empty-note">No artists found.</div>';
  } else {
    body.innerHTML = (r.playlists || []).length ? cardsBlock(r.playlists, 'ytplaylist') : '<div class="empty-note">No playlists found.</div>';
  }
}

async function renderAlbum() {
  set('<div class="loading">Loading album…</div>');
  const tok = S.viewTok;
  try {
    const a = await call('ytm:album', { id: S.params.id });
    if (tok !== S.viewTok || S.view !== 'album') return;
    S.lists['album'] = a.tracks;
    S.renderCtx = 'album';
    const n = a.tracks.length;
    set(ctxHeader({
      type: 'Album', title: a.title,
      meta: `<b>${esc(a.artist)}</b>${a.year ? ' • ' + esc(a.year) : ''} • ${n} song${n === 1 ? '' : 's'}`,
      thumb: a.thumb, listKey: 'album'
    }) + rowsBlock(a.tracks, 'album'));
  } catch (e) {
    if (tok === S.viewTok) set(`<div class="loading">Could not load album: ${esc(e.message)}</div>`);
  }
}

async function renderArtist() {
  set('<div class="loading">Loading artist…</div>');
  const tok = S.viewTok;
  try {
    const a = await call('ytm:artist', { id: S.params.id });
    if (tok !== S.viewTok || S.view !== 'artist') return;
    let html = ctxHeader({
      type: 'Artist', title: a.name, meta: '', thumb: a.thumb, round: true,
      listKey: 'artist-songs', extraActions: ''
    });
    S.lists['artist-songs'] = a.songs;
    if (a.songs.length) html += `<div class="sechead"><h2>Songs</h2></div>` + rowsBlock(a.songs, 'artist-songs');
    if (a.albums.length) html += `<div class="sechead"><h2>Albums</h2></div>` + cardsBlock(a.albums, 'album');
    if (a.singles.length) html += `<div class="sechead"><h2>Singles</h2></div>` + cardsBlock(a.singles, 'album');
    if (a.videos.length) {
      S.lists['artist-videos'] = a.videos;
      html += `<div class="sechead"><h2>Videos</h2></div>` + rowsBlock(a.videos, 'artist-videos');
    }
    set(html);
  } catch (e) {
    if (tok === S.viewTok) set(`<div class="loading">Could not load artist: ${esc(e.message)}</div>`);
  }
}

async function renderYtPlaylist() {
  set('<div class="loading">Loading playlist…</div>');
  const tok = S.viewTok;
  try {
    const p = await call('ytm:playlist', { id: S.params.id });
    if (tok !== S.viewTok || S.view !== 'ytplaylist') return;
    S.lists['ytpl'] = p.tracks;
    const n = p.tracks.length;
    set(ctxHeader({
      type: 'Playlist', title: p.title,
      meta: `<b>${esc(p.owner)}</b> • ${n} song${n === 1 ? '' : 's'}`,
      thumb: p.thumb, listKey: 'ytpl'
    }) + rowsBlock(p.tracks, 'ytpl'));
  } catch (e) {
    if (tok === S.viewTok) set(`<div class="loading">Could not load playlist: ${esc(e.message)}</div>`);
  }
}

function renderLiked() {
  const list = S.store.favorites;
  S.lists['liked'] = list;
  const n = list.length;
  set(ctxHeader({ type: 'Playlist', title: 'Liked Songs', meta: `${n} song${n === 1 ? '' : 's'} you liked`, thumb: list[0] && list[0].thumb, listKey: n ? 'liked' : null }) +
    (n ? rowsBlock(list, 'liked') : '<div class="empty-note">Tap the heart on any song to like it.</div>'));
}

function renderRecent() {
  const list = S.store.recent;
  S.lists['recent'] = list;
  set(ctxHeader({ type: 'History', title: 'Recently Played', meta: `${list.length} track${list.length === 1 ? '' : 's'}`, thumb: list[0] && list[0].thumb, listKey: list.length ? 'recent' : null }) +
    (list.length ? rowsBlock(list, 'recent') : '<div class="empty-note">Songs you play will show up here.</div>'));
}

function renderLocalPl() {
  const pl = S.store.playlists.find(p => p.id === S.params.id);
  if (!pl) { set('<div class="empty-note">Playlist not found.</div>'); return; }
  S.lists['localpl'] = pl.tracks;
  const n = pl.tracks.length;
  const actions = `
    <button class="ghostbtn" data-action="pl-rename" title="Rename">${icon('pencil')} Rename</button>
    <button class="ghostbtn danger" data-action="pl-delete" title="Delete playlist">${icon('trash')} Delete</button>`;
  set(ctxHeader({ type: 'Playlist', title: pl.name, meta: `${n} song${n === 1 ? '' : 's'} • your playlist`, thumb: pl.tracks[0] && pl.tracks[0].thumb, listKey: n ? 'localpl' : null, extraActions: actions }) +
    (n ? rowsBlock(pl.tracks, 'localpl') : '<div class="empty-note">Use the ⋯ menu on any song to add it here.</div>'));
}

// ---------- playback engine ----------
async function playContext(tracks, start = 0) {
  if (!tracks || !tracks.length) return;
  S.queue = tracks.slice();
  if (settings().shuffle) {
    const rest = [...Array(S.queue.length).keys()].filter(i => i !== start);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    S.order = [start, ...rest];
    S.oi = 0;
  } else {
    S.order = S.queue.map((_, i) => i);
    S.oi = Math.min(start, S.queue.length - 1);
  }
  await playIndex(S.oi);
}

function rebuildOrder() {
  const n = S.queue.length;
  if (settings().shuffle) {
    const curIdx = S.order[S.oi] != null ? S.order[S.oi] : 0;
    const rest = [...Array(n).keys()].filter(i => i !== curIdx);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    S.order = [curIdx, ...rest];
  } else {
    S.order = S.queue.map((_, i) => i);
  }
}

let radioLoading = false;
let radioFailStreak = 0;

async function fetchRadioTracks(seedTrack) {
  if (!seedTrack || !seedTrack.id || radioLoading) return 0;
  radioLoading = true;
  try {
    const res = await call('ytm:radio', { id: seedTrack.id });
    if (!res || !Array.isArray(res) || !res.length) {
      radioFailStreak++;
      return 0;
    }
    const existing = new Set(S.queue.map(t => t.id));
    const newTracks = res.filter(t => t && t.id && !existing.has(t.id));
    if (!newTracks.length) {
      radioFailStreak++;
      return 0;
    }
    radioFailStreak = 0;
    const toAdd = newTracks.slice(0, 15);
    const startIdx = S.queue.length;
    S.queue.push(...toAdd);
    for (let i = 0; i < toAdd.length; i++) {
      S.order.push(startIdx + i);
    }
    renderQueuePanel();
    saveLastQueue();
    return toAdd.length;
  } catch (e) {
    console.error('[radio] fetch error:', e);
    radioFailStreak++;
    return 0;
  } finally {
    radioLoading = false;
  }
}

async function playIndex(pos) {
  const idx = S.order[pos];
  if (idx == null || !S.queue[idx]) return;
  S.oi = pos;
  const t = S.queue[idx];
  const token = ++S.playToken;
  S.curUrls = null; S.curUrlIdx = 0; S.curTrack = t;

  setNowPlaying(t);
  renderQueuePanel();
  saveLastQueue();

  // Prefetch radio tracks in the background if nearing the queue end
  if (settings().repeat === 'off' && settings().radio && pos >= S.order.length - 1 && radioFailStreak < 3) {
    fetchRadioTracks(t).catch(() => {});
  }

  if (t.localPath) {
    S.curUrls = ['file:///' + t.localPath.replace(/\\/g, '/')];
    startUrl(0);
    return;
  }

  try {
    const r = await call('ytm:stream', { id: t.id });
    if (token !== S.playToken) return;
    S.curUrls = r.urls;
    startUrl(0);
  } catch (e) {
    if (token !== S.playToken) return;
    toast('Could not play "' + t.title + '" — skipping');
    setTimeout(() => { if (token === S.playToken) next(true); }, 400);
  }
}

function startUrl(i) {
  if (!S.curUrls || i >= S.curUrls.length) {
    S.playing = false;
    updatePlayBtn();
    toast('Playback failed — try another track');
    return;
  }
  S.curUrlIdx = i;
  audio.src = S.curUrls[i];
  audio.play().catch(() => { /* error event handles fallback */ });
}

function togglePlay() {
  if (!S.queue.length) return;
  if (!audio.src) { playIndex(S.oi < 0 ? 0 : S.oi); return; }
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

async function next(auto = false) {
  if (!S.order.length) return;
  if (auto && settings().repeat === 'one') {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  let pos = S.oi + 1;
  if (pos >= S.order.length) {
    if (settings().repeat === 'all') {
      pos = 0;
    } else if (settings().radio && radioFailStreak < 3) {
      const seed = curTrack() || (S.queue.length ? S.queue[S.order[S.order.length - 1]] : null);
      toast('Finding similar songs…');
      const added = await fetchRadioTracks(seed);
      if (added > 0 && pos < S.order.length) {
        playIndex(pos);
        return;
      } else {
        audio.pause();
        audio.currentTime = audio.duration || 0;
        return;
      }
    } else {
      audio.pause();
      audio.currentTime = audio.duration || 0;
      return;
    }
  }
  playIndex(pos);
}

function prev() {
  if (!S.order.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  let pos = S.oi - 1;
  if (pos < 0) pos = settings().repeat === 'all' ? S.order.length - 1 : 0;
  playIndex(pos);
}

function setShuffle(on) {
  settings().shuffle = !!on;
  const curIdx = S.order[S.oi];
  rebuildOrder();
  S.oi = Math.max(0, S.order.indexOf(curIdx));
  updateShuffleRepeatBtns();
  renderQueuePanel();
  saveSettings();
}

function setRepeat(mode) {
  settings().repeat = mode;
  updateShuffleRepeatBtns();
  saveSettings();
}

function setRadio(on) {
  settings().radio = !!on;
  updateShuffleRepeatBtns();
  saveSettings();
  toast('Autoplay ' + (settings().radio ? 'enabled' : 'disabled'));
  if (settings().radio && S.oi >= S.order.length - 1 && radioFailStreak < 3) {
    const seed = curTrack() || (S.queue.length ? S.queue[S.order[S.order.length - 1]] : null);
    if (seed) fetchRadioTracks(seed).catch(() => {});
  }
}

function updateShuffleRepeatBtns() {
  $('#pb-shuffle').classList.toggle('on', !!settings().shuffle);
  const r = settings().repeat;
  const btn = $('#pb-repeat');
  btn.classList.toggle('on', r !== 'off');
  btn.title = 'Repeat: ' + r;
  btn.innerHTML = icon('repeat') + (r === 'one' ? '<span class="rep1">1</span>' : '');

  const radioBtn = $('#pb-radio');
  if (radioBtn) {
    const on = !!settings().radio;
    radioBtn.classList.toggle('on', on);
    radioBtn.title = 'Autoplay / Radio: ' + (on ? 'On' : 'Off');
  }
  const qRadio = $('#q-radio-toggle');
  if (qRadio) {
    const on = !!settings().radio;
    qRadio.classList.toggle('on', on);
  }
}

function updatePlayBtn() {
  $('#pb-play').innerHTML = icon(S.playing ? 'pause' : 'play');
}

function setNowPlaying(t, restoreOnly = false) {
  if (!t) return;
  const thumb = $('#np-thumb');
  if (thumb) thumb.src = t.thumb || '';
  applyAccent(t.thumb);
  const title = $('#np-title');
  if (title) title.textContent = t.title || 'My Music';
  const a = $('#np-artist');
  if (a) {
    a.textContent = t.artist || '';
    a.dataset.artistId = t.artistId || '';
  }
  updateFavBtn();
  if (t.title) document.title = t.title + ' — My Music';
  updateMediaMetadata(t);

  // highlight the row in any visible list
  $$('#content .trow').forEach(row => row.classList.toggle('playing', row.dataset.tid === t.id));
  if (S.lyricsOpen && !restoreOnly) loadLyrics(t);
  syncPresence();
  syncTaskbarTray();
}

function updateFavBtn() {
  const t = curTrack();
  const liked = t ? isFav(t) : false;
  const btn = $('#pb-fav');
  btn.classList.toggle('liked', liked);
  btn.innerHTML = icon('heart', liked ? 'filled' : '');
}

async function toggleFav(track) {
  await mutate({ type: 'fav.toggle', track });
  updateFavBtn();
  // refresh visible hearts
  $$('#content .trow').forEach(row => {
    const t = (S.lists[row.dataset.list] || [])[+row.dataset.idx];
    if (!t) return;
    const liked = isFav(t);
    row.querySelector('.rheart').classList.toggle('liked', liked);
    row.querySelector('.rheart').innerHTML = icon('heart', liked ? 'filled' : '');
  });
  if (S.view === 'liked' || S.view === 'home') rerenderKeepScroll();
}

function updateMediaMetadata(t) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: t.artist,
    album: t.album || 'My Music',
    artwork: t.thumb ? [{ src: t.thumb, sizes: '512x512', type: 'image/jpeg' }] : []
  });
  const h = {
    play: () => togglePlay(),
    pause: () => togglePlay(),
    previoustrack: () => prev(),
    nexttrack: () => next(),
    seekto: (d) => { if (d && d.seekTime != null && audio.duration) audio.currentTime = d.seekTime; }
  };
  for (const [k, fn] of Object.entries(h)) {
    try { navigator.mediaSession.setActionHandler(k, fn); } catch { /* unsupported */ }
  }
  navigator.mediaSession.playbackState = S.playing ? 'playing' : 'paused';
}

// ---------- visualizer + track accent ----------
const VIZ_MODES = ['liquid', 'orbit', 'bars', 'wave', 'silk', 'blob', 'off'];
const vizCanvas = $('#viz');
const vctx = vizCanvas.getContext('2d');
const vizS = {
  mode: 'liquid', raf: 0, sim: false,
  actx: null, analyser: null, freq: null, stream: null,
  zeroFrames: 0, idleFrames: 0, w: 0, h: 0,
  prev: new Float32Array(72), N: 72, hue: 258,
  caps: new Float32Array(72),
  droplets: [],
  particles: []
};
const ACC_DEFAULT_HUE = 258;
const accCache = new Map();          // thumb url -> hue (null = use default)
let curAccThumb = null;

function vizInit() {
  vizS.mode = VIZ_MODES.includes(settings().viz) ? settings().viz : 'bars';
  const btn = $('#pb-viz');
  btn.title = 'Visualizer: ' + vizS.mode;
  btn.classList.toggle('on', vizS.mode !== 'off');
  vizResize();
}

function cycleViz() {
  const i = VIZ_MODES.indexOf(vizS.mode);
  vizS.mode = VIZ_MODES[(i + 1) % VIZ_MODES.length];
  settings().viz = vizS.mode;
  const btn = $('#pb-viz');
  btn.title = 'Visualizer: ' + vizS.mode;
  btn.classList.toggle('on', vizS.mode !== 'off');
  if (vizS.mode === 'off') vizStop();
  else { vizResize(); vizStart(); }
  toast('Visualizer: ' + vizS.mode);
  saveSettings();
}

function vizResize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  vizS.w = vizCanvas.clientWidth;
  vizS.h = vizCanvas.clientHeight;
  vizCanvas.width = Math.max(1, Math.round(vizS.w * dpr));
  vizCanvas.height = Math.max(1, Math.round(vizS.h * dpr));
  vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', vizResize);

// Taps the playing audio for spectrum data without ever routing the audible
// signal through Web Audio — playback cannot be affected by this.
function ensureTap() {
  if (vizS.sim) return;
  try {
    const cap = audio.captureStream || audio.mozCaptureStream;
    if (!cap) throw new Error('captureStream unavailable');
    const tracks = vizS.stream ? vizS.stream.getAudioTracks() : [];
    const live = tracks.length && tracks.every(t => t.readyState === 'live');
    if (vizS.analyser && live) { resumeTap(); return; }
    vizS.stream = cap.call(audio);
    if (!vizS.actx) vizS.actx = new (window.AudioContext || window.webkitAudioContext)();
    if (!vizS.analyser) {
      vizS.analyser = vizS.actx.createAnalyser();
      vizS.analyser.fftSize = 2048;
      vizS.analyser.smoothingTimeConstant = 0.82;
      vizS.freq = new Uint8Array(vizS.analyser.frequencyBinCount);
    }
    vizS.actx.createMediaStreamSource(vizS.stream).connect(vizS.analyser);
    vizS.zeroFrames = 0;
    resumeTap();
    console.log('[viz] spectrum tap engaged');
  } catch (e) {
    const msg = (e && e.message) || String(e);
    console.log('[viz] spectrum tap unavailable:', msg);
    // Transient failures (e.g. "MediaStream has no audio track" right after a
    // play event, before the capture stream is ready) must NOT latch simulated
    // mode — ensureTap() retries on the next play event, so leave sim off.
    if (!/no audio track/i.test(msg)) vizS.sim = true;
  }
}
function resumeTap() { if (vizS.actx && vizS.actx.state === 'suspended') vizS.actx.resume().catch(() => {}); }

function vizStart() {
  if (vizS.raf || vizS.mode === 'off') return;
  vizS.idleFrames = 0;
  vizS.raf = requestAnimationFrame(vizFrame);
}
function vizStop() {
  if (vizS.raf) cancelAnimationFrame(vizS.raf);
  vizS.raf = 0;
  vizS.prev.fill(0);
  if (vizS.caps) vizS.caps.fill(0);
  if (vizS.droplets) vizS.droplets.length = 0;
  vctx.clearRect(0, 0, vizS.w, vizS.h);
  document.documentElement.style.setProperty('--bass', '0');
}

// pseudo-spectrum used when the real one can't be tapped (cross-origin media)
function simBands(t) {
  const N = vizS.N, out = vizS._sim || (vizS._sim = new Float32Array(N));
  const beat = Math.pow(1 - ((t * 0.78) % 1), 3);        // ~78 bpm thump
  const beat2 = Math.pow(1 - ((t * 0.78 + 0.5) % 1), 6); // lighter offbeat
  for (let i = 0; i < N; i++) {
    const f = i / N;
    const env = Math.pow(1 - f, 1.35) * (0.62 + 0.38 * Math.sin(t * (0.9 + f * 2.2) + i * 1.7) * Math.sin(t * 0.53 + i * 0.31));
    const jit = 0.14 * Math.sin(t * (6.5 + i * 0.9) + i * 5.1);
    let bass = 0;
    if (i < N * 0.16) bass = beat * (1 - i / (N * 0.16)) * 0.9;
    else if (i < N * 0.3) bass = beat2 * 0.45;
    out[i] = Math.max(0, Math.min(1, env * 0.62 + jit + bass));
  }
  return out;
}

function vizFrame(ts) {
  vizS.raf = requestAnimationFrame(vizFrame);
  const t = ts / 1000;
  if (vizCanvas.clientWidth !== vizS.w || vizCanvas.clientHeight !== vizS.h) vizResize();
  const playing = S.playing && !audio.paused;

  if (vizS.analyser && !vizS.sim) {
    vizS.analyser.getByteFrequencyData(vizS.freq);
    let mx = 0;
    for (let i = 2; i < 96; i++) if (vizS.freq[i] > mx) mx = vizS.freq[i];
    if (playing && mx === 0) {
      if (++vizS.zeroFrames > 240) {
        vizS.sim = true;
        console.log('[viz] tap reads silence (cross-origin) — switching to simulated spectrum');
      }
    } else vizS.zeroFrames = 0;
  }

  let bands;
  if (vizS.analyser && !vizS.sim) {
    const bins = vizS.freq, N = vizS.N;
    bands = vizS._band || (vizS._band = new Float32Array(N));
    for (let i = 0; i < N; i++) {
      const a = Math.floor(Math.pow(i / N, 2.1) * 420) + 2;
      const b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / N, 2.1) * 420) + 2);
      let s = 0;
      for (let j = a; j < b && j < bins.length; j++) if (bins[j] > s) s = bins[j];
      bands[i] = s / 255;
    }
  } else {
    bands = simBands(t);
    if (!playing) bands.fill(0);
  }

  // smooth toward target so bars rise fast and fall gracefully
  const prev = vizS.prev, N = vizS.N;
  for (let i = 0; i < N; i++) prev[i] += (bands[i] - prev[i]) * (bands[i] > prev[i] ? 0.5 : 0.16);

  let bass = 0;
  for (let i = 0; i < 10; i++) bass += prev[i];
  bass /= 10;
  document.documentElement.style.setProperty('--bass', bass.toFixed(3));

  if (!playing) { if (++vizS.idleFrames > 90) { vizStop(); return; } }
  else vizS.idleFrames = 0;

  const w = vizS.w, h = vizS.h;
  vctx.clearRect(0, 0, w, h);
  if (vizS.mode === 'liquid') drawLiquid(w, h, t, bass);
  else if (vizS.mode === 'orbit') drawOrbit(w, h, t, bass);
  else if (vizS.mode === 'bars') drawBars(w, h);
  else if (vizS.mode === 'wave') drawWave(w, h, t);
  else if (vizS.mode === 'silk') drawSilk(w, h, t, bass);
  else if (vizS.mode === 'blob') drawBlob(w, h, t, bass);
}

const col = (a = 1, light = 62, dh = 0) => `hsla(${(vizS.hue + dh) % 360}, 80%, ${light}%, ${a})`;

function drawLiquid(w, h, t, bass) {
  const N = vizS.N, prev = vizS.prev;
  
  vctx.beginPath();
  vctx.moveTo(0, h);
  for (let i = 0; i <= 36; i++) {
    const f = i / 36;
    const band = prev[Math.floor(f * N * 0.7)];
    const x = f * w;
    const y = h * 0.68 - band * h * 0.42 - Math.sin(t * 2.1 + f * 4.8) * 7;
    vctx.lineTo(x, y);
  }
  vctx.lineTo(w, h);
  vctx.closePath();
  const g1 = vctx.createLinearGradient(0, h * 0.4, 0, h);
  g1.addColorStop(0, col(0.28, 55, 35));
  g1.addColorStop(1, col(0.04, 45, 35));
  vctx.fillStyle = g1;
  vctx.fill();

  vctx.beginPath();
  vctx.moveTo(0, h);
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const f = i / 48;
    const band = prev[Math.floor(f * N * 0.9)];
    const x = f * w;
    const y = h * 0.74 - band * h * 0.5 - Math.sin(t * 2.8 + f * 6.2) * 9 * (1 + bass * 0.6);
    pts.push({ x, y, band });
    vctx.lineTo(x, y);
  }
  vctx.lineTo(w, h);
  vctx.closePath();

  const g2 = vctx.createLinearGradient(0, h * 0.3, 0, h);
  g2.addColorStop(0, col(0.42, 66, -15));
  g2.addColorStop(0.5, col(0.2, 58));
  g2.addColorStop(1, col(0.02, 50));
  vctx.fillStyle = g2;
  vctx.fill();

  vctx.beginPath();
  vctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const prevPt = pts[i - 1], curPt = pts[i];
    const mx = (prevPt.x + curPt.x) / 2, my = (prevPt.y + curPt.y) / 2;
    vctx.quadraticCurveTo(prevPt.x, prevPt.y, mx, my);
  }
  vctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  vctx.strokeStyle = col(0.95, 78, 10);
  vctx.lineWidth = 2.4;
  vctx.shadowColor = col(0.8, 68);
  vctx.shadowBlur = 14;
  vctx.stroke();
  vctx.shadowBlur = 0;

  if (bass > 0.26 && Math.random() < 0.35 && vizS.droplets.length < 24) {
    const randPt = pts[Math.floor(Math.random() * (pts.length - 6)) + 3];
    vizS.droplets.push({
      x: randPt.x + (Math.random() - 0.5) * 16,
      y: randPt.y - 2,
      vx: (Math.random() - 0.5) * 2.2,
      vy: -(2.8 + Math.random() * 3.8 * (1 + bass)),
      r: 2.5 + Math.random() * 3.5,
      life: 1,
      decay: 0.02 + Math.random() * 0.02
    });
  }

  for (let i = vizS.droplets.length - 1; i >= 0; i--) {
    const d = vizS.droplets[i];
    d.x += d.vx;
    d.y += d.vy;
    d.vy += 0.16;
    d.life -= d.decay;
    if (d.life <= 0 || d.y > h) {
      vizS.droplets.splice(i, 1);
      continue;
    }
    vctx.beginPath();
    vctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    const dg = vctx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 0, d.x, d.y, d.r);
    dg.addColorStop(0, '#ffffff');
    dg.addColorStop(0.3, col(d.life * 0.9, 75));
    dg.addColorStop(1, col(d.life * 0.4, 55));
    vctx.fillStyle = dg;
    vctx.fill();

    vctx.beginPath();
    vctx.arc(d.x - d.r * 0.35, d.y - d.r * 0.35, d.r * 0.28, 0, Math.PI * 2);
    vctx.fillStyle = `rgba(255, 255, 255, ${d.life * 0.85})`;
    vctx.fill();
  }
}

function drawOrbit(w, h, t, bass) {
  const N = vizS.N, prev = vizS.prev;
  const cx = w / 2, cy = h * 0.54;
  const R = Math.min(w * 0.13, h * 0.36) * (1 + bass * 0.26);

  vctx.beginPath();
  vctx.arc(cx, cy, R, 0, Math.PI * 2);
  vctx.strokeStyle = col(0.9, 70);
  vctx.lineWidth = 2.2;
  vctx.shadowColor = col(0.7, 65);
  vctx.shadowBlur = 16;
  vctx.stroke();
  vctx.shadowBlur = 0;

  const RAY_COUNT = 48;
  for (let i = 0; i < RAY_COUNT; i++) {
    const a = (i / RAY_COUNT) * Math.PI * 2 + t * 0.2;
    const band = prev[Math.floor(((i / RAY_COUNT) * N) % N)];
    const len = 5 + band * (h * 0.38);
    const cos = Math.cos(a), sin = Math.sin(a);
    const x1 = cx + cos * (R + 3);
    const y1 = cy + sin * (R + 3);
    const x2 = cx + cos * (R + 3 + len);
    const y2 = cy + sin * (R + 3 + len);

    vctx.beginPath();
    vctx.moveTo(x1, y1);
    vctx.lineTo(x2, y2);
    vctx.strokeStyle = col(0.7 + band * 0.3, 62 + band * 14, Math.floor(i * 3));
    vctx.lineWidth = Math.max(1.5, Math.min(3.2, band * 4));
    vctx.stroke();

    vctx.beginPath();
    vctx.arc(x2, y2, 2.2 + band * 2, 0, Math.PI * 2);
    vctx.fillStyle = '#ffffff';
    vctx.shadowColor = col(0.9, 70);
    vctx.shadowBlur = 8;
    vctx.fill();
    vctx.shadowBlur = 0;
  }

  for (let pass = 0; pass < 2; pass++) {
    const dir = pass === 0 ? 1 : -1;
    const ringR = R * (1.35 + pass * 0.32);
    const P_COUNT = 18;
    for (let j = 0; j < P_COUNT; j++) {
      const pa = (j / P_COUNT) * Math.PI * 2 + t * 0.4 * dir;
      const px = cx + Math.cos(pa) * ringR;
      const py = cy + Math.sin(pa) * ringR * 0.88;
      vctx.beginPath();
      vctx.arc(px, py, 1.8 + Math.sin(t * 3 + j) * 0.8, 0, Math.PI * 2);
      vctx.fillStyle = col(0.65, 76, pass * 40);
      vctx.fill();
    }
  }
}

function drawBars(w, h) {
  const N = vizS.N, prev = vizS.prev, caps = vizS.caps;
  const bw = w / N;
  vctx.lineCap = 'round';
  vctx.lineWidth = Math.max(2.6, bw * 0.62);

  for (let i = 0; i < N; i++) {
    const v = prev[i];
    const bh = Math.max(4, v * (h - 16));
    const x = i * bw + bw / 2;

    const g = vctx.createLinearGradient(0, h, 0, h - bh);
    g.addColorStop(0, col(0.95, 54, -25));
    g.addColorStop(1, col(0.95, 68, 10));
    vctx.strokeStyle = g;
    vctx.shadowColor = col(0.5, 64);
    vctx.shadowBlur = 10;
    vctx.beginPath();
    vctx.moveTo(x, h - 2);
    vctx.lineTo(x, h - 2 - bh);
    vctx.stroke();

    if (v >= caps[i]) caps[i] = v;
    else caps[i] = Math.max(0, caps[i] - 0.012);
    const capH = Math.max(4, caps[i] * (h - 16));
    const capY = h - 2 - capH - 4;
    vctx.beginPath();
    vctx.arc(x, Math.max(4, capY), 2.2, 0, Math.PI * 2);
    vctx.fillStyle = '#ffffff';
    vctx.shadowColor = col(0.8, 70);
    vctx.shadowBlur = 6;
    vctx.fill();
  }
  vctx.shadowBlur = 0;
}

function drawWave(w, h, t) {
  const N = vizS.N, prev = vizS.prev;
  const passes = [
    { c: col(0.92, 68), lw: 3, sb: 16, ph: 0 },
    { c: col(0.6, 62, 45), lw: 1.8, sb: 6, ph: 2.4 }
  ];
  for (const p of passes) {
    vctx.beginPath();
    vctx.strokeStyle = p.c;
    vctx.lineWidth = p.lw;
    vctx.shadowColor = col(0.65, 64);
    vctx.shadowBlur = p.sb;
    let x = 0, y = h * 0.6 - prev[0] * h * 0.44;
    vctx.moveTo(x, y);
    for (let i = 1; i < N; i++) {
      const x2 = (i / (N - 1)) * w;
      const y2 = h * 0.6 - prev[i] * h * 0.44 - Math.sin(t * 1.8 + i * 0.5 + p.ph) * 2.5;
      vctx.quadraticCurveTo(x, y, (x + x2) / 2, (y + y2) / 2);
      x = x2; y = y2;
    }
    vctx.stroke();
  }
  vctx.shadowBlur = 0;
}

function drawSilk(w, h, t, bass) {
  const N = vizS.N, prev = vizS.prev;
  const ribbons = [
    { dh: -25, lw: 2.6, yBase: 0.62, speed: 1.4, amp: 0.42 },
    { dh: 15, lw: 3.2, yBase: 0.52, speed: 2.0, amp: 0.5 },
    { dh: 55, lw: 2.2, yBase: 0.44, speed: 2.7, amp: 0.38 }
  ];
  for (let rIdx = 0; rIdx < ribbons.length; rIdx++) {
    const r = ribbons[rIdx];
    vctx.beginPath();
    let x0 = 0, y0 = h * r.yBase - prev[0] * h * r.amp;
    vctx.moveTo(x0, y0);
    for (let i = 1; i < N; i++) {
      const f = i / (N - 1);
      const x1 = f * w;
      const band = prev[i];
      const y1 = h * r.yBase - band * h * r.amp - Math.sin(t * r.speed + f * 5.5 + rIdx * 1.8) * 12 * (1 + bass * 0.4);
      vctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      x0 = x1; y0 = y1;
    }
    vctx.lineTo(w, y0);
    vctx.strokeStyle = col(0.85, 68, r.dh);
    vctx.lineWidth = r.lw;
    vctx.shadowColor = col(0.6, 62, r.dh);
    vctx.shadowBlur = 12;
    vctx.stroke();
  }
  vctx.shadowBlur = 0;
}

function drawBlob(w, h, t, bass) {
  const N = vizS.N, prev = vizS.prev;
  const cx = w / 2, cy = h * 0.56;
  const R = Math.min(w * 0.17, h * 0.42) * (1 + bass * 0.24);
  const PTS = 96, pts = [];
  for (let i = 0; i < PTS; i++) {
    const a = (i / PTS) * Math.PI * 2 + t * 0.38;
    const band = prev[Math.floor(((i / PTS) * N * 2) % N)];
    const wob = 0.18 * band + 0.06 * Math.sin(t * 2.3 + i * 0.8);
    const r = R * (1 + wob);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.82]);
  }
  vctx.beginPath();
  for (let i = 0; i < PTS; i++) {
    const p = pts[i], n = pts[(i + 1) % PTS];
    const mx = (p[0] + n[0]) / 2, my = (p[1] + n[1]) / 2;
    if (i === 0) vctx.moveTo(mx, my); else vctx.quadraticCurveTo(p[0], p[1], mx, my);
  }
  vctx.closePath();
  const g = vctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R * 1.25);
  g.addColorStop(0, col(0.55, 68));
  g.addColorStop(0.7, col(0.18, 58, 24));
  g.addColorStop(1, col(0, 58));
  vctx.fillStyle = g;
  vctx.fill();
  vctx.strokeStyle = col(0.8, 72);
  vctx.lineWidth = 1.8;
  vctx.shadowColor = col(0.6, 64);
  vctx.shadowBlur = 16;
  vctx.stroke();
  vctx.shadowBlur = 0;

  for (let s = 0; s < 3; s++) {
    const sa = t * 1.2 + (s * Math.PI * 2) / 3;
    const sDist = R * (1.35 + Math.sin(t * 2 + s) * 0.15);
    const sx = cx + Math.cos(sa) * sDist;
    const sy = cy + Math.sin(sa) * sDist * 0.75;
    const sr = 5 + bass * 4;
    vctx.beginPath();
    vctx.arc(sx, sy, sr, 0, Math.PI * 2);
    vctx.fillStyle = col(0.7, 72, s * 30);
    vctx.shadowColor = col(0.8, 65, s * 30);
    vctx.shadowBlur = 8;
    vctx.fill();
    vctx.shadowBlur = 0;
  }
}

// ---------- album-art accent ----------
function applyAccent(thumb) {
  if (settings().accentHue != null && settings().accentHue !== 'auto') {
    setHue(settings().accentHue);
    return;
  }
  if (!thumb) { curAccThumb = null; setHue(ACC_DEFAULT_HUE); return; }
  curAccThumb = thumb;
  if (accCache.has(thumb)) { setHue(accCache.get(thumb) ?? ACC_DEFAULT_HUE); return; }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    if (curAccThumb !== thumb) return;
    let hue = null;
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 24;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, 24, 24);
      const d = x.getImageData(0, 0, 24, 24).data;
      const bins = new Array(12).fill(0);
      let satWeight = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
        const sat = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1) || 1);
        if (sat < 0.2 || l < 0.07 || l > 0.93) continue;
        let hh;
        if (mx === r) hh = ((g - b) / (mx - mn)) * 60;
        else if (mx === g) hh = 120 + ((b - r) / (mx - mn)) * 60;
        else hh = 240 + ((r - g) / (mx - mn)) * 60;
        if (hh < 0) hh += 360;
        bins[Math.min(11, Math.floor(hh / 30))] += sat * sat;
        satWeight += sat;
      }
      let bi = -1, bv = 0;
      bins.forEach((v, i) => { if (v > bv) { bv = v; bi = i; } });
      if (bi >= 0 && satWeight > 0.9) hue = bi * 30 + 15;
    } catch { hue = null; }
    accCache.set(thumb, hue);
    if (curAccThumb === thumb) setHue(hue ?? ACC_DEFAULT_HUE);
  };
  img.onerror = () => {
    accCache.set(thumb, null);
    if (curAccThumb === thumb) setHue(ACC_DEFAULT_HUE);
  };
  img.src = thumb;
}

function setHue(h) {
  vizS.hue = h;
  const s = document.documentElement.style;
  s.setProperty('--accent', `hsl(${h}, 78%, 62%)`);
  s.setProperty('--accent-2', `hsl(${(h + 42) % 360}, 72%, 52%)`);
  s.setProperty('--accent-3', `hsl(${(h + 120) % 360}, 80%, 58%)`);
  s.setProperty('--playing', `hsl(${h}, 85%, 72%)`);
  s.setProperty('--accent-soft', `hsla(${h}, 85%, 60%, 0.28)`);
  s.setProperty('--accent-glow', `hsla(${h}, 90%, 62%, 0.52)`);
  s.setProperty('--accent-hue', h);
  s.setProperty('--glass-brd', `hsla(${h}, 50%, 80%, 0.12)`);
  s.setProperty('--glass-brd-hover', `hsla(${h}, 60%, 85%, 0.24)`);
}

// ---------- Discord RPC & Mini mode ----------
const syncPresence = debounce(() => {
  const t = curTrack();
  if (!t) {
    call('presence:update', null);
    return;
  }
  call('presence:update', {
    title: t.title,
    artist: t.artist,
    album: t.album,
    thumb: t.thumb,
    duration: audio.duration || t.duration || 0,
    progress: audio.currentTime || 0,
    playing: S.playing && !audio.paused
  });
}, 400);

async function toggleMiniMode() {
  try {
    const isMini = await call('window:setMiniMode');
    document.body.classList.toggle('mini-mode', isMini);
    $('#pb-mini')?.classList.toggle('on', isMini);
    toast(isMini ? 'Mini player active' : 'Full window restored');
  } catch (e) {
    console.error('[mini] toggle failed:', e);
  }
}

// ---------- audio events ----------
audio.addEventListener('play', () => {
  S.playing = true;
  updatePlayBtn();
  ensureTap();
  ensureDspGraph();
  applySpeedAndPitch();
  vizStart();
  syncPresence();
  syncTaskbarTray();
  const t = curTrack();
  if (t && !S.recorded.has(t.id)) {
    S.recorded.add(t.id);
    if (S.recorded.size > 300) S.recorded = new Set([...S.recorded].slice(-100));
    mutate({ type: 'recent.add', track: t }).then(() => { if (S.view === 'recent' || S.view === 'home') rerenderKeepScroll(); });
  }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
});
audio.addEventListener('pause', () => {
  S.playing = false;
  updatePlayBtn();
  syncPresence();
  syncTaskbarTray();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
});
audio.addEventListener('ended', () => {
  const t = curTrack();
  if (t) recordListening(t, audio.duration || audio.currentTime);
  syncPresence();
  syncTaskbarTray();
  next(true);
});
audio.addEventListener('loadedmetadata', () => {
  $('#t-total').textContent = fmtDur(audio.duration);
  syncPresence();
});
audio.addEventListener('error', () => {
  if (S.curUrls && S.curUrlIdx + 1 < S.curUrls.length) { startUrl(S.curUrlIdx + 1); return; }
  S.playing = false;
  updatePlayBtn();
  syncPresence();
  // Last URL failed: auto-skip to the next queued track instead of dying
  // silently, but stop after 3 consecutive failures (e.g. offline).
  const token = S.playToken;
  const t = curTrack();
  if (t && S.order.length > 1 && ++S.errStreak <= 3) {
    toast('Could not play "' + t.title + '" — skipping');
    setTimeout(() => { if (token === S.playToken) next(true); }, 400);
  }
});
audio.addEventListener('playing', () => { S.errStreak = 0; });

let lastQueueSave = 0;
let lastPresenceSave = 0;
audio.addEventListener('timeupdate', () => {
  if (S.seeking) return;
  const d = audio.duration || 0;
  const pct = d ? (audio.currentTime / d) * 100 : 0;
  const seek = $('#seek');
  seek.value = pct;
  seek.style.setProperty('--fill', pct + '%');
  $('#t-cur').textContent = fmtDur(audio.currentTime);
  if (S.lyricsOpen) highlightLyric(audio.currentTime);
  if (audio.currentTime >= 30) {
    const t = curTrack();
    if (t) recordListening(t, audio.currentTime);
  }
  const now = Date.now();
  if (now - lastQueueSave > 10000 && audio.src) { lastQueueSave = now; saveLastQueue(); }
  // keep Discord's progress bar fresh without flooding the RPC client
  if (now - lastPresenceSave > 15000 && audio.src) { lastPresenceSave = now; syncPresence(); }
});

// ---------- queue panel ----------
function renderQueuePanel() {
  const body = $('#queueBody');
  if (!body) return;
  const cur = curTrack();
  const upcoming = S.order.slice(S.oi + 1).map(i => S.queue[i]).filter(Boolean);
  body.innerHTML = `
    <div class="q-sec">Now playing</div>
    ${cur ? qRow(cur, 'q-cur', -1) : '<div class="q-empty">Nothing playing</div>'}
    <div class="q-sec">Next up</div>
    ${upcoming.length ? upcoming.map((t, i) => qRow(t, '', i)).join('') : '<div class="q-empty">Queue is empty</div>'}`;
}

function qRow(t, cls, i) {
  return `<div class="qrow ${cls}" data-q="${i}">
    <img src="${esc(t.thumb)}" alt="">
    <div class="qmeta">
      <div class="qtitle">${esc(t.title)}</div>
      <div class="qsub">${esc(t.artist)}</div>
    </div>
    ${i >= 0 ? `<button class="qx" data-action="q-remove" data-i="${i}" title="Remove">${icon('close')}</button>` : ''}
  </div>`;
}

function jumpQueue(i) {
  if (i === -1) { playIndex(S.oi); return; }
  playIndex(S.oi + 1 + i);
}

function removeQueue(i) {
  const pos = S.oi + 1 + i;
  const qi = S.order[pos];
  if (qi == null) return;
  S.queue.splice(qi, 1);
  S.order = S.order.filter(x => x !== qi).map(x => (x > qi ? x - 1 : x));
  renderQueuePanel();
  saveLastQueue();
}

// ---------- lyrics panel ----------
function toggleLyrics(force) {
  S.lyricsOpen = force != null ? force : !S.lyricsOpen;
  $('#lyricsPanel').classList.toggle('hidden', !S.lyricsOpen);
  $('#pb-lyrics').classList.toggle('on', S.lyricsOpen);
  const t = curTrack();
  if (S.lyricsOpen && t) loadLyrics(t);
}

function renderLyricsHeader(t) {
  const head = $('#lyricsPanel .panel-head');
  if (!head) return;
  const hasLyrics = S.lyrics && (S.lyrics.synced?.length || S.lyrics.plain);
  head.innerHTML = `
    <div class="ly-head-title">Lyrics</div>
    <div class="ly-head-actions">
      ${hasLyrics ? `<button id="btnTransLyrics" class="ghostbtn ly-trans-btn" title="Translate lyrics to English">${icon('translate')} <span>${S.showTranslated ? 'Original' : 'Translate'}</span></button>` : ''}
      <button class="iconbtn" data-action="panel-close" data-panel="lyricsPanel">${icon('close')}</button>
    </div>`;
  $('#btnTransLyrics')?.addEventListener('click', () => toggleTranslateLyrics(t));
}

function renderLyricsContent(t) {
  S._lastLy = -1;
  const el = $('#lyricsBody');
  const r = (S.showTranslated && S.translatedLyrics.get(t.id)) ? S.translatedLyrics.get(t.id) : S.lyrics;
  if (!r) {
    el.innerHTML = '<div class="ly-load">No lyrics found.</div>';
    return;
  }
  const curOff = (t && S.store && S.store.lyricsOffsets && S.store.lyricsOffsets[t.id]) || 0;
  let offsetBarHtml = '';
  if (r.synced && r.synced.length) {
    offsetBarHtml = `
      <div class="ly-offset-bar">
        <span class="ly-off-label">Sync Offset:</span>
        <button class="ly-off-btn" data-dir="-1" title="-500ms">-0.5s</button>
        <span class="ly-off-val">${curOff > 0 ? '+' : ''}${curOff}ms</span>
        <button class="ly-off-btn" data-dir="1" title="+500ms">+0.5s</button>
        ${curOff !== 0 ? '<button class="ly-off-reset" title="Reset offset">Reset</button>' : ''}
      </div>`;
  }
  if (r.synced && r.synced.length) {
    el.innerHTML = offsetBarHtml + r.synced.map(l => `<div class="ly-line" data-t="${l.t != null ? l.t : ''}">${esc(l.text)}</div>`).join('');
  } else if (r.plain) {
    el.innerHTML = `<div class="ly-plain">${esc(r.plain)}</div>`;
  } else {
    el.innerHTML = '<div class="ly-load">No lyrics found for this track.</div>';
  }

  el.querySelectorAll('.ly-off-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dir = parseInt(btn.dataset.dir, 10);
      adjustLyricsOffset(t, dir * 500);
    });
  });
  el.querySelector('.ly-off-reset')?.addEventListener('click', (e) => {
    e.stopPropagation();
    resetLyricsOffset(t);
  });
}

async function adjustLyricsOffset(t, delta) {
  const cur = (S.store && S.store.lyricsOffsets && S.store.lyricsOffsets[t.id]) || 0;
  const next = Math.max(-10000, Math.min(10000, cur + delta));
  await mutate({ type: 'lyricsOffset.set', id: t.id, offset: next });
  renderLyricsContent(t);
  toast(`Sync offset: ${next > 0 ? '+' : ''}${next}ms`);
}

async function resetLyricsOffset(t) {
  await mutate({ type: 'lyricsOffset.set', id: t.id, offset: 0 });
  renderLyricsContent(t);
  toast('Sync offset reset');
}

async function toggleTranslateLyrics(t) {
  if (!t || !S.lyrics) return;
  if (S.showTranslated) {
    S.showTranslated = false;
    renderLyricsHeader(t);
    renderLyricsContent(t);
    return;
  }
  if (S.translatedLyrics.has(t.id)) {
    S.showTranslated = true;
    renderLyricsHeader(t);
    renderLyricsContent(t);
    return;
  }
  const btn = $('#btnTransLyrics');
  if (btn) btn.innerHTML = `${icon('translate')} <span>Translating…</span>`;
  try {
    let transObj = { synced: null, plain: null };
    if (S.lyrics.synced && S.lyrics.synced.length) {
      const full = S.lyrics.synced.map(l => l.text).join('\n');
      const tr = await call('ytm:translate', { text: full, targetLang: 'en' });
      if (tr) {
        const transLines = tr.split('\n');
        transObj.synced = S.lyrics.synced.map((l, i) => ({
          t: l.t,
          text: transLines[i] ? transLines[i].trim() : l.text
        }));
      }
    } else if (S.lyrics.plain) {
      const tr = await call('ytm:translate', { text: S.lyrics.plain, targetLang: 'en' });
      transObj.plain = tr || S.lyrics.plain;
    }
    S.translatedLyrics.set(t.id, transObj);
    S.showTranslated = true;
    renderLyricsHeader(t);
    renderLyricsContent(t);
    toast('Lyrics translated to English');
  } catch (e) {
    toast('Translation failed: ' + ((e && e.message) || e));
    renderLyricsHeader(t);
  }
}

async function loadLyrics(t) {
  S.lyricsId = t.id;
  S.showTranslated = false;
  renderLyricsHeader(t);
  const el = $('#lyricsBody');
  el.innerHTML = '<div class="ly-load">Loading lyrics…</div>';
  try {
    const r = await call('ytm:lyrics', { track: t });
    if (S.lyricsId !== t.id || !S.lyricsOpen) return;
    S.lyrics = r;
    renderLyricsHeader(t);
    renderLyricsContent(t);
  } catch {
    if (S.lyricsId === t.id) {
      S.lyrics = null;
      renderLyricsHeader(t);
      el.innerHTML = '<div class="ly-load">Lyrics unavailable.</div>';
    }
  }
}

function highlightLyric(time) {
  const lines = $$('#lyricsBody .ly-line');
  if (!lines.length) return;
  const tTrack = curTrack();
  const offsetMs = (tTrack && S.store && S.store.lyricsOffsets && S.store.lyricsOffsets[tTrack.id]) || 0;
  const adjustedTime = time + (offsetMs / 1000);
  let active = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = parseFloat(lines[i].dataset.t);
    if (!isNaN(t) && t <= adjustedTime + 0.3) active = i;
  }
  lines.forEach((el, i) => el.classList.toggle('on', i === active));
  if (active >= 0 && active !== S._lastLy) {
    S._lastLy = active;
    lines[active].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ---------- context menu ----------
const menuEl = $('#ctxmenu');
function openMenu(x, y, track, extra = {}) {
  S.menuTrack = track;
  S.menuExtra = extra;
  const fav = isFav(track);
  const pls = S.store.playlists;
  menuEl.innerHTML = `
    <button data-m="play">${icon('play')} Play</button>
    <button data-m="play-next">${icon('next')} Play next</button>
    <button data-m="fav">${icon('heart', fav ? 'filled' : '')} ${fav ? 'Remove from Liked' : 'Add to Liked'}</button>
    <div class="m-sep"></div>
    ${pls.map(p => `<button data-m="pl:${esc(p.id)}">${icon('plus')} ${esc(p.name)}</button>`).join('')}
    <button data-m="pl:new">${icon('plus')} New playlist…</button>
    <div class="m-sep"></div>
    ${track.albumId ? `<button data-m="album">${icon('music')} Go to album</button>` : ''}
    ${track.artistId ? `<button data-m="artist">${icon('music')} Go to artist</button>` : ''}
    <button data-m="download">${icon('download')} Download offline</button>
    ${extra.plId ? `<button data-m="pl-remove" style="color:#ff6b6b">${icon('trash')} Remove from this playlist</button>` : ''}`;
  menuEl.classList.remove('hidden');
  const r = menuEl.getBoundingClientRect();
  menuEl.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
  menuEl.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
}
function closeMenu() { menuEl.classList.add('hidden'); S.menuTrack = null; }

async function menuAction(m) {
  const t = S.menuTrack;
  closeMenu();
  if (!t || !m) return;
  if (m === 'play') {
    S.queue = [t];
    S.order = [0]; S.oi = 0;
    playIndex(0);
  } else if (m === 'play-next') {
    const qi = S.order[S.oi] != null ? S.order[S.oi] : -1;
    S.queue.splice(qi + 1, 0, t);
    S.order = S.order.map(x => (x > qi ? x + 1 : x));
    S.order.splice(S.oi + 1, 0, qi + 1);
    renderQueuePanel();
    saveLastQueue();
    toast('Playing next: ' + t.title);
  } else if (m === 'fav') {
    toggleFav(t);
  } else if (m === 'download') {
    toast('Downloading "' + t.title + '"…');
    call('download:start', { track: t }).then(() => {
      toast('Downloaded "' + t.title + '" to Music/My Music');
      if (S.view === 'downloads') rerenderKeepScroll();
    }).catch(err => {
      toast('Download failed: ' + (err && err.message ? err.message : err));
    });
  } else if (m === 'pl:new') {
    menuPrompt('Playlist name', async (name) => {
      const st = await mutate({ type: 'playlist.create', name });
      const pl = st.playlists[0];
      await mutate({ type: 'playlist.add', id: pl.id, track: t });
      toast('Added to "' + pl.name + '"');
      renderSidebarPlaylists();
    });
    return; // menu reopened as prompt
  } else if (m.startsWith('pl:')) {
    const plId = m.slice(3);
    await mutate({ type: 'playlist.add', id: plId, track: t });
    const pl = S.store.playlists.find(p => p.id === plId);
    toast('Added to "' + (pl ? pl.name : 'playlist') + '"');
  } else if (m === 'album') {
    go('album', { id: t.albumId });
  } else if (m === 'artist') {
    go('artist', { id: t.artistId });
  } else if (m === 'pl-remove') {
    await mutate({ type: 'playlist.remove', id: S.menuExtra.plId, track: t });
    rerenderKeepScroll();
    toast('Removed from playlist');
  }
}

// tiny prompt inside the context menu position
function menuPrompt(label, cb) {
  menuEl.innerHTML = `<input type="text" placeholder="${esc(label)}" spellcheck="false">`;
  menuEl.classList.remove('hidden');
  const input = menuEl.querySelector('input');
  input.focus();
  const done = async (ok) => {
    const v = input.value.trim();
    closeMenu();
    if (ok && v) await cb(v);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') done(true);
    if (e.key === 'Escape') done(false);
  });
  input.addEventListener('blur', () => setTimeout(() => closeMenu(), 100));
}

// ---------- toast + modal ----------
let toastT;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 2600);
}

function modal({ title, message, input, value = '', confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-box">
      <h3>${esc(title)}</h3>
      ${message ? `<p>${esc(message)}</p>` : ''}
      ${input ? `<input id="modalInput" type="text" value="${esc(value)}" spellcheck="false">` : ''}
      <div class="modal-btns">
        <button data-mm="cancel">Cancel</button>
        <button data-mm="ok" class="primary" ${danger ? 'style="background:#d94848"' : ''}>${esc(confirmText)}</button>
      </div>
    </div>`;
    m.classList.remove('hidden');
    const inp = $('#modalInput');
    if (inp) { inp.focus(); inp.select(); }
    m.onclick = (e) => {
      const b = e.target.closest('[data-mm]');
      if (!b && e.target !== m) return;
      const val = inp ? inp.value.trim() : true;
      m.classList.add('hidden');
      resolve(b && b.dataset.mm === 'ok' ? val : null);
    };
    if (inp) inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const val = inp.value.trim(); m.classList.add('hidden'); resolve(val); }
      if (e.key === 'Escape') { m.classList.add('hidden'); resolve(null); }
    });
  });
}

// ---------- misc UI ----------
function updateVolFill() {
  const v = $('#vol');
  v.style.setProperty('--fill', (audio.volume * 100) + '%');
  $('#pb-vol').innerHTML = icon(audio.volume === 0 ? 'volmute' : 'vol');
}

function setVolume(v) {
  audio.volume = Math.min(1, Math.max(0, v));
  updateVolFill();
  saveSettings();
}

// ---------- event wiring ----------
function bindShellEvents() {
  // suggestions & search input
  const input = $('#searchInput');
  const sugg = $('#sugg');
  const doSuggestions = debounce(async () => {
    const q = input.value.trim();
    if (!q) { sugg.classList.remove('open'); return; }
    try {
      const list = await call('ytm:suggestions', { query: q });
      if (!list.length) { sugg.classList.remove('open'); return; }
      sugg.innerHTML = list.map(s => `<button data-sugg="${esc(s)}">${esc(s)}</button>`).join('');
      sugg.classList.add('open');
    } catch { sugg.classList.remove('open'); }
  }, 200);

  const doLiveSearch = debounce(() => {
    const q = input.value.trim();
    if (S.view === 'search' && q && q !== S.search.q) {
      doSearch(q);
    }
  }, 450);

  input.addEventListener('input', () => {
    doSuggestions();
    doLiveSearch();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doSearch(input.value); }
    if (e.key === 'Escape') { sugg.classList.remove('open'); input.blur(); }
  });
  sugg.addEventListener('mousedown', (e) => {
    const b = e.target.closest('[data-sugg]');
    if (b) { e.preventDefault(); doSearch(b.dataset.sugg); }
  });
  const searchBtn = $('#searchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => doSearch(input.value));
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#searchWrap')) sugg.classList.remove('open');
  });

  // player controls
  $('#pb-play').addEventListener('click', togglePlay);
  $('#pb-next').addEventListener('click', () => next());
  $('#pb-prev').addEventListener('click', prev);
  $('#pb-shuffle').addEventListener('click', () => setShuffle(!settings().shuffle));
  $('#pb-repeat').addEventListener('click', () => {
    const order = ['off', 'all', 'one'];
    setRepeat(order[(order.indexOf(settings().repeat) + 1) % 3]);
  });
  $('#pb-radio')?.addEventListener('click', () => setRadio(!settings().radio));
  $('#pb-fav').addEventListener('click', () => { const t = curTrack(); if (t) toggleFav(t); });
  $('#pb-queue').addEventListener('click', () => {
    $('#queuePanel').classList.toggle('hidden');
    $('#pb-queue').classList.toggle('on', !$('#queuePanel').classList.contains('hidden'));
    renderQueuePanel();
  });
  $('#pb-lyrics').addEventListener('click', () => toggleLyrics());
  $('#pb-viz').addEventListener('click', cycleViz);
  $('#pb-mini')?.addEventListener('click', toggleMiniMode);
  $('#pb-vol').addEventListener('click', () => {
    if (audio.volume > 0) { S.lastVol = audio.volume; setVolume(0); }
    else setVolume(S.lastVol || 0.8);
  });
  $('#vol').addEventListener('input', (e) => setVolume(parseFloat(e.target.value)));

  const seek = $('#seek');
  seek.addEventListener('input', (e) => { S.seeking = true; $('#t-cur').textContent = fmtDur((parseFloat(e.target.value) / 100) * (audio.duration || 0)); });
  seek.addEventListener('change', (e) => {
    audio.currentTime = (parseFloat(e.target.value) / 100) * (audio.duration || 0);
    S.seeking = false;
    syncPresence();
  });

  // delegated clicks (nav, actions)
  document.addEventListener('click', onClick);

  // right-click on rows opens the same menu
  document.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.trow');
    if (!row) return;
    e.preventDefault();
    const t = (S.lists[row.dataset.list] || [])[+row.dataset.idx];
    if (t) openMenu(e.clientX, e.clientY, t, { plId: S.view === 'localpl' ? S.params.id : null });
  });

  // keyboard
  document.addEventListener('keydown', (e) => {
    const typing = e.target.matches('input, textarea');
    if (e.key === '/' && !typing) { e.preventDefault(); input.focus(); input.select(); }
    else if (e.code === 'Space' && !typing && !e.target.closest('button')) { e.preventDefault(); togglePlay(); }
    else if (!typing && e.key === 'ArrowRight' && audio.duration) audio.currentTime += 5;
    else if (!typing && e.key === 'ArrowLeft' && audio.duration) audio.currentTime -= 5;
    else if (e.key === 'Escape') { closeMenu(); sugg.classList.remove('open'); }
  });

  // hide broken thumbnails
  document.addEventListener('error', (e) => {
    if (e.target && e.target.tagName === 'IMG') e.target.style.opacity = '0';
  }, true);
}

function doSearch(q) {
  q = (q || '').trim();
  if (!q) return;
  const input = $('#searchInput');
  if (input) input.value = q;
  const sugg = $('#sugg');
  if (sugg) sugg.classList.remove('open');
  if (S.search.q !== q) {
    S.search = { q, filter: S.search.filter || 'songs', results: {}, tok: S.search.tok };
  }
  if (S.view !== 'search' || S.params.q !== q) {
    go('search', { q });
  } else {
    loadSearch(S.search.filter || 'songs');
  }
}

function onClick(e) {
  const menuBtn = e.target.closest('#ctxmenu [data-m]');
  if (menuBtn) { menuAction(menuBtn.dataset.m); return; }
  if (!e.target.closest('#ctxmenu')) closeMenu();

  const qbtn = e.target.closest('.qrow');
  if (qbtn && qbtn.dataset.q != null) {
    const rm = e.target.closest('[data-action="q-remove"]');
    if (rm) { removeQueue(+rm.dataset.i); return; }
    jumpQueue(+qbtn.dataset.q);
    return;
  }

  const nav = e.target.closest('[data-nav]');
  if (nav) {
    const v = nav.dataset.nav;
    if (v === 'search') {
      $('#searchInput').focus();
      if (S.search.q) {
        $('#searchInput').value = S.search.q;
        go('search', { q: S.search.q });
      } else {
        go('search', {});
      }
      return;
    }
    go(v, {});
    return;
  }

  const ly = e.target.closest('.ly-line');
  if (ly && ly.dataset.t) {
    const t = parseFloat(ly.dataset.t);
    const tTrack = curTrack();
    const offsetMs = (tTrack && S.store && S.store.lyricsOffsets && S.store.lyricsOffsets[tTrack.id]) || 0;
    if (!isNaN(t)) {
      audio.currentTime = Math.max(0, t - (offsetMs / 1000));
      syncPresence();
      return;
    }
  }

  const row = e.target.closest('.trow');
  if (row) {
    const nonPlayInteractive = e.target.closest('.rheart, .rmenu, [data-action="row-fav"], [data-action="row-menu"], a[data-action="artist"], a[data-action="album"]');
    if (!nonPlayInteractive) {
      const list = S.lists[row.dataset.list];
      if (list) playContext(list, +row.dataset.idx);
      return;
    }
  }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  switch (action) {
    case 'pb-eq':
    case 'open-eq': openEqModal(); break;
    case 'pl-import': openImportModal(); break;
    case 'dl-open-folder': call('download:reveal', {}).catch(() => {}); break;
    case 'dl-reveal': {
      const item = S.lists['downloads'] && S.lists['downloads'][+el.dataset.idx];
      if (item && item.localPath) call('download:reveal', { path: item.localPath });
      break;
    }
    case 'set-wallpaper': {
      settings().wallpaper = el.dataset.url;
      applyWallpaper();
      mutate({ type: 'settings.set', patch: { wallpaper: el.dataset.url } });
      renderSettings();
      break;
    }
    case 'set-accent': {
      const hue = el.dataset.hue === 'auto' ? 'auto' : +el.dataset.hue;
      settings().accentHue = hue;
      if (hue === 'auto') {
        const cur = curTrack();
        applyAccent(cur ? cur.thumb : null);
      } else {
        setHue(hue);
      }
      mutate({ type: 'settings.set', patch: { accentHue: hue } });
      renderSettings();
      break;
    }
    case 'stats-play': {
      const t = S.lists['top_stats'] && S.lists['top_stats'][+el.dataset.idx];
      if (t) {
        S.queue = [t]; S.order = [0]; S.oi = 0;
        playIndex(0);
      }
      break;
    }
    case 'toggle-radio': setRadio(!settings().radio); break;
    case 'search-submit': doSearch($('#searchInput').value); break;
    case 'history-back': navBack(); break;
    case 'history-fwd': navFwd(); break;
    case 'tab': loadSearch(el.dataset.tab); break;
    case 'row-play': {
      const row = el.closest('.trow');
      const list = S.lists[row.dataset.list];
      if (list) playContext(list, +row.dataset.idx);
      break;
    }
    case 'row-fav': {
      const row = el.closest('.trow');
      const t = (S.lists[row.dataset.list] || [])[+row.dataset.idx];
      if (t) toggleFav(t);
      break;
    }
    case 'row-menu': {
      const row = el.closest('.trow');
      const t = (S.lists[row.dataset.list] || [])[+row.dataset.idx];
      if (t) {
        const r = el.getBoundingClientRect();
        openMenu(r.left, r.bottom + 4, t, { plId: S.view === 'localpl' ? S.params.id : null });
      }
      break;
    }
    case 'ctx-play': {
      const list = S.lists[el.dataset.list];
      if (list) playContext(list, 0);
      break;
    }
    case 'album': go('album', { id: el.dataset.id }); break;
    case 'artist': go('artist', { id: el.dataset.id }); break;
    case 'ytplaylist': go('ytplaylist', { id: el.dataset.id }); break;
    case 'local-pl': go('localpl', { id: el.dataset.id }); break;
    case 'panel-close': {
      const p = document.getElementById(el.dataset.panel);
      if (p) p.classList.add('hidden');
      $('#pb-queue').classList.toggle('on', !$('#queuePanel').classList.contains('hidden'));
      if (el.dataset.panel === 'lyricsPanel') toggleLyrics(false);
      break;
    }
    case 'pl-create': {
      modal({ title: 'New playlist', input: true, value: 'My Playlist', confirmText: 'Create' }).then(async (name) => {
        if (!name) return;
        await mutate({ type: 'playlist.create', name });
        renderSidebarPlaylists();
        const pl = S.store.playlists[0];
        go('localpl', { id: pl.id });
      });
      break;
    }
    case 'pl-rename': {
      const pl = S.store.playlists.find(p => p.id === S.params.id);
      if (!pl) break;
      modal({ title: 'Rename playlist', input: true, value: pl.name, confirmText: 'Rename' }).then(async (name) => {
        if (!name) return;
        await mutate({ type: 'playlist.rename', id: pl.id, name });
        rerenderKeepScroll();
        renderSidebarPlaylists();
      });
      break;
    }
    case 'pl-delete': {
      const pl = S.store.playlists.find(p => p.id === S.params.id);
      if (!pl) break;
      modal({ title: 'Delete playlist?', message: `"${pl.name}" will be removed. The songs themselves are not deleted from YouTube Music.`, confirmText: 'Delete', danger: true }).then(async (ok) => {
        if (ok == null) return;
        await mutate({ type: 'playlist.delete', id: pl.id });
        renderSidebarPlaylists();
        go('home', {});
        toast('Playlist deleted');
      });
      break;
    }
  }
}


// ==========================================================================
// Hidara Feature Implementations: Equalizer DSP, Importer, Stats, Downloads, Wallpaper
// ==========================================================================

const EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_PRESETS = {
  flat: { name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  bass: { name: 'Bass Boost', gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
  bass_reduce: { name: 'Bass Reducer', gains: [-6, -5, -4, -2, 0, 0, 0, 0, 0, 0] },
  rock: { name: 'Rock', gains: [4, 3, 1, 0, -1, -1, 1, 2, 3, 4] },
  pop: { name: 'Pop', gains: [-1, 1, 3, 4, 3, 1, -1, -1, 1, 2] },
  vocal: { name: 'Vocal', gains: [1, -1, -2, 1, 3, 4, 3, 1, 0, -1] },
  acoustic: { name: 'Acoustic', gains: [3, 2, 1, 1, 1, 1, 2, 2, 3, 3] },
  electronic: { name: 'Electronic', gains: [5, 4, 2, 0, -1, 2, 1, 3, 4, 4] },
  club: { name: 'Club', gains: [2, 3, 4, 2, 2, 2, 0, 0, 0, 0] },
  classical: { name: 'Classical', gains: [4, 3, 2, 2, -1, -1, 0, 2, 3, 3] }
};

let dspCtx = null;
let dspSource = null;
let dspFilters = [];
let dspActive = false;

function ensureDspGraph() {
  if (dspActive) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    dspCtx = new AC();
    audio.crossOrigin = 'anonymous';
    dspSource = dspCtx.createMediaElementSource(audio);

    dspFilters = EQ_FREQS.map((freq, i) => {
      const f = dspCtx.createBiquadFilter();
      if (i === 0) f.type = 'lowshelf';
      else if (i === EQ_FREQS.length - 1) f.type = 'highshelf';
      else { f.type = 'peaking'; f.Q.value = 1.4; }
      f.frequency.value = freq;
      const g = (settings().eq && settings().eq[i]) || 0;
      f.gain.value = g;
      return f;
    });

    let prevNode = dspSource;
    for (const f of dspFilters) {
      prevNode.connect(f);
      prevNode = f;
    }
    prevNode.connect(dspCtx.destination);
    dspActive = true;
    console.log('[dsp] Web Audio equalizer graph connected');
  } catch (e) {
    console.log('[dsp] Web Audio graph skipped (direct output):', (e && e.message) || e);
  }
}

function applyEqGains(gains) {
  ensureDspGraph();
  if (dspFilters && dspFilters.length) {
    for (let i = 0; i < dspFilters.length; i++) {
      if (dspFilters[i] && dspFilters[i].gain) {
        dspFilters[i].gain.value = gains[i] != null ? gains[i] : 0;
      }
    }
  }
}

function applySpeedAndPitch() {
  const spd = settings().speed || 1.0;
  const pitchLock = settings().pitchLock !== false;
  audio.playbackRate = spd;
  audio.preservesPitch = pitchLock;
}

function openEqModal() {
  const modalEl = $('#eqModal');
  if (!modalEl) return;
  ensureDspGraph();

  const curPreset = settings().eqPreset || 'flat';
  const curEq = settings().eq || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const curSpeed = settings().speed || 1.0;
  const curPitchLock = settings().pitchLock !== false;

  const presetHtml = Object.entries(EQ_PRESETS).map(([id, p]) =>
    `<button class="eq-preset-btn ${curPreset === id ? 'active' : ''}" data-eq-preset="${id}">${esc(p.name)}</button>`
  ).join('');

  const freqLabels = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
  const slidersHtml = curEq.map((g, i) => `
    <div class="eq-band">
      <div class="eq-gain" id="eq-gain-${i}">${g > 0 ? '+' : ''}${g} dB</div>
      <div class="eq-slider-wrap">
        <input type="range" class="eq-slider" min="-12" max="12" step="0.5" value="${g}" data-band="${i}">
      </div>
      <div class="eq-freq">${freqLabels[i]}</div>
    </div>
  `).join('');

  modalEl.innerHTML = `
    <div class="eq-box">
      <div class="eq-header">
        <h3>${icon('eq')} 10-Band Graphic Equalizer & DSP</h3>
        <button class="iconbtn" data-action="eq-close">${icon('close')}</button>
      </div>
      <div class="eq-presets">${presetHtml}</div>
      <div class="eq-sliders">${slidersHtml}</div>
      <div class="eq-dsp-row">
        <div class="eq-dsp-group">
          <span class="eq-dsp-label">Playback Speed</span>
          <input type="range" id="eqSpeedInput" class="eq-speed-slider" min="0.5" max="2.0" step="0.05" value="${curSpeed}">
          <span id="eqSpeedVal" class="eq-dsp-val">${curSpeed.toFixed(2)}x</span>
          <button id="eqSpeedReset" class="ghostbtn" style="padding:4px 8px;font-size:11px;">1.0x</button>
        </div>
        <label class="eq-checkbox-label">
          <input type="checkbox" id="eqPitchLock" ${curPitchLock ? 'checked' : ''}>
          <span>Lock Pitch (Timestretch)</span>
        </label>
      </div>
      <div class="eq-footer">
        <button id="eqResetBtn" class="ghostbtn" style="padding:6px 14px;border-radius:999px;">Reset to Flat</button>
        <button class="primary" data-action="eq-close" style="padding:8px 20px;border-radius:999px;background:var(--accent);color:#fff;font-weight:600;">Done</button>
      </div>
    </div>
  `;
  modalEl.classList.remove('hidden');

  modalEl.querySelectorAll('.eq-slider').forEach(sl => {
    sl.addEventListener('input', (e) => {
      const idx = +e.target.dataset.band;
      const val = parseFloat(e.target.value);
      const gainLabel = $(`#eq-gain-${idx}`, modalEl);
      if (gainLabel) gainLabel.textContent = `${val > 0 ? '+' : ''}${val} dB`;
      const gains = [...(settings().eq || [0,0,0,0,0,0,0,0,0,0])];
      gains[idx] = val;
      settings().eq = gains;
      settings().eqPreset = 'custom';
      modalEl.querySelectorAll('.eq-preset-btn').forEach(b => b.classList.remove('active'));
      applyEqGains(gains);
      mutate({ type: 'settings.set', patch: { eq: gains, eqPreset: 'custom' } });
    });
  });

  modalEl.querySelectorAll('.eq-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pId = btn.dataset.eqPreset;
      const preset = EQ_PRESETS[pId];
      if (!preset) return;
      modalEl.querySelectorAll('.eq-preset-btn').forEach(b => b.classList.toggle('active', b === btn));
      const gains = [...preset.gains];
      settings().eq = gains;
      settings().eqPreset = pId;
      modalEl.querySelectorAll('.eq-slider').forEach((sl, i) => {
        sl.value = gains[i];
        const gainLabel = $(`#eq-gain-${i}`, modalEl);
        if (gainLabel) gainLabel.textContent = `${gains[i] > 0 ? '+' : ''}${gains[i]} dB`;
      });
      applyEqGains(gains);
      mutate({ type: 'settings.set', patch: { eq: gains, eqPreset: pId } });
    });
  });

  const spdInput = $('#eqSpeedInput', modalEl);
  const spdVal = $('#eqSpeedVal', modalEl);
  if (spdInput && spdVal) {
    spdInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      spdVal.textContent = val.toFixed(2) + 'x';
      settings().speed = val;
      applySpeedAndPitch();
      mutate({ type: 'settings.set', patch: { speed: val } });
    });
  }
  const spdReset = $('#eqSpeedReset', modalEl);
  if (spdReset && spdInput && spdVal) {
    spdReset.addEventListener('click', () => {
      spdInput.value = 1.0;
      spdVal.textContent = '1.00x';
      settings().speed = 1.0;
      applySpeedAndPitch();
      mutate({ type: 'settings.set', patch: { speed: 1.0 } });
    });
  }

  const pLock = $('#eqPitchLock', modalEl);
  if (pLock) {
    pLock.addEventListener('change', (e) => {
      settings().pitchLock = !!e.target.checked;
      applySpeedAndPitch();
      mutate({ type: 'settings.set', patch: { pitchLock: settings().pitchLock } });
    });
  }

  const rstBtn = $('#eqResetBtn', modalEl);
  if (rstBtn) {
    rstBtn.addEventListener('click', () => {
      const flatBtn = modalEl.querySelector('[data-eq-preset="flat"]');
      if (flatBtn) flatBtn.click();
    });
  }

  modalEl.onclick = (e) => {
    if (e.target === modalEl || e.target.closest('[data-action="eq-close"]')) {
      modalEl.classList.add('hidden');
    }
  };
}

function openImportModal() {
  const modalEl = $('#importModal');
  if (!modalEl) return;
  modalEl.innerHTML = `
    <div class="import-box">
      <div class="eq-header">
        <h3>${icon('import')} Import Playlist</h3>
        <button class="iconbtn" data-action="import-close">${icon('close')}</button>
      </div>
      <div class="import-tabs">
        <button class="import-tab active" data-tab="url">YouTube / Spotify URL</button>
        <button class="import-tab" data-tab="csv">CSV / Text List</button>
      </div>
      <div id="importUrlTab" class="import-tab-content">
        <p style="margin:0;font-size:13px;color:var(--muted)">Paste any public YouTube Music, YouTube, or Spotify playlist link to extract and match its tracks.</p>
        <input type="text" id="importUrlInput" placeholder="https://www.youtube.com/playlist?list=... or Spotify link" spellcheck="false">
        <div id="importUrlStatus" class="import-status"></div>
        <div class="modal-btns">
          <button data-action="import-close">Cancel</button>
          <button id="importUrlSubmit" class="primary" style="background:var(--accent);color:#fff;font-weight:600">Resolve & Import</button>
        </div>
      </div>
      <div id="importCsvTab" class="import-tab-content hidden">
        <p style="margin:0;font-size:13px;color:var(--muted)">Paste CSV tracks (Title, Artist) or track names one per line.</p>
        <input type="text" id="importCsvName" placeholder="Playlist Name (e.g. My Imported Mix)" spellcheck="false">
        <textarea id="importCsvInput" placeholder="Blinding Lights, The Weeknd&#10;Starboy, The Weeknd&#10;As It Was, Harry Styles"></textarea>
        <div id="importCsvStatus" class="import-status"></div>
        <div class="modal-btns">
          <button data-action="import-close">Cancel</button>
          <button id="importCsvSubmit" class="primary" style="background:var(--accent);color:#fff;font-weight:600">Match & Create Playlist</button>
        </div>
      </div>
    </div>
  `;
  modalEl.classList.remove('hidden');

  modalEl.querySelectorAll('.import-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      modalEl.querySelectorAll('.import-tab').forEach(t => t.classList.toggle('active', t === tab));
      const isUrl = tab.dataset.tab === 'url';
      $('#importUrlTab', modalEl).classList.toggle('hidden', !isUrl);
      $('#importCsvTab', modalEl).classList.toggle('hidden', isUrl);
    });
  });

  const urlSubmit = $('#importUrlSubmit', modalEl);
  if (urlSubmit) {
    urlSubmit.addEventListener('click', async () => {
      const url = $('#importUrlInput', modalEl).value.trim();
      if (!url) { toast('Please enter a URL'); return; }
      const statusEl = $('#importUrlStatus', modalEl);
      statusEl.textContent = 'Resolving playlist via yt-dlp…';
      urlSubmit.disabled = true;
      try {
        const res = await call('import:url', { url });
        if (!res || !res.tracks || !res.tracks.length) {
          statusEl.textContent = 'No tracks found in URL.';
          urlSubmit.disabled = false;
          return;
        }
        statusEl.textContent = `Found "${res.title}" with ${res.tracks.length} tracks. Creating playlist…`;
        const st = await mutate({ type: 'playlist.create', name: res.title || 'Imported Playlist' });
        const newPl = st.playlists[0];
        let added = 0;
        for (const t of res.tracks) {
          if (t && t.id) {
            await mutate({ type: 'playlist.add', id: newPl.id, track: t });
            added++;
          }
        }
        statusEl.textContent = `Successfully imported ${added} tracks into "${newPl.name}"!`;
        renderSidebarPlaylists();
        setTimeout(() => {
          modalEl.classList.add('hidden');
          go('localpl', { id: newPl.id });
          toast(`Imported ${added} tracks`);
        }, 800);
      } catch (err) {
        statusEl.textContent = `Import failed: ${err.message}`;
        urlSubmit.disabled = false;
      }
    });
  }

  const csvSubmit = $('#importCsvSubmit', modalEl);
  if (csvSubmit) {
    csvSubmit.addEventListener('click', async () => {
      const text = $('#importCsvInput', modalEl).value.trim();
      const name = $('#importCsvName', modalEl).value.trim() || 'Imported CSV';
      if (!text) { toast('Please enter track lines'); return; }
      const statusEl = $('#importCsvStatus', modalEl);
      statusEl.textContent = 'Parsing and matching tracks…';
      csvSubmit.disabled = true;
      try {
        const parsed = await call('import:csv', { text });
        if (!parsed.length) {
          statusEl.textContent = 'No valid rows found in text.';
          csvSubmit.disabled = false;
          return;
        }
        statusEl.textContent = `Matching ${parsed.length} items with YouTube Music…`;
        const matched = await call('import:match', { rows: parsed });
        if (!matched.length) {
          statusEl.textContent = 'No matching tracks found.';
          csvSubmit.disabled = false;
          return;
        }
        const st = await mutate({ type: 'playlist.create', name });
        const newPl = st.playlists[0];
        for (const t of matched) {
          await mutate({ type: 'playlist.add', id: newPl.id, track: t });
        }
        statusEl.textContent = `Added ${matched.length} matched tracks into "${newPl.name}"!`;
        renderSidebarPlaylists();
        setTimeout(() => {
          modalEl.classList.add('hidden');
          go('localpl', { id: newPl.id });
          toast(`Imported ${matched.length} tracks`);
        }, 800);
      } catch (err) {
        statusEl.textContent = `Import failed: ${err.message}`;
        csvSubmit.disabled = false;
      }
    });
  }

  modalEl.onclick = (e) => {
    if (e.target === modalEl || e.target.closest('[data-action="import-close"]')) {
      modalEl.classList.add('hidden');
    }
  };
}

async function renderDownloads(tok) {
  set(`<div class="skeleton" style="height:320px"></div>`);
  try {
    const list = await call('download:list');
    if (tok !== S.viewTok) return;

    if (!list || !list.length) {
      set(`
        <div class="downloads-view">
          <div class="downloads-header">
            <div>
              <h1 class="vh-title" style="margin:0 0 4px">Downloads</h1>
              <p class="vh-sub" style="margin:0">Offline tracks saved to Music/My Music</p>
            </div>
            <button class="dl-folder-btn" data-action="dl-open-folder">${icon('folder')} Open Downloads Folder</button>
          </div>
          <div class="q-empty" style="margin-top:40px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;">
            <div style="width:52px;height:52px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;color:var(--muted)">
              ${icon('download')}
            </div>
            <div style="font-size:16px;font-weight:600">No offline downloads yet</div>
            <div style="font-size:13px;color:var(--muted);max-width:400px;line-height:1.5">
              Right-click any song or click the (⋯) menu and choose "Download offline" to save high-quality audio files for offline playback.
            </div>
          </div>
        </div>
      `);
      return;
    }

    S.lists['downloads'] = list;
    const rows = list.map((t, i) => {
      const cur = curTrack();
      const playing = cur && cur.id === t.id && (audio.src || S.playing);
      return `
        <div class="trow ${playing ? 'playing' : ''}" data-list="downloads" data-idx="${i}" data-tid="${esc(t.id)}">
          <button class="rownum" data-action="row-play" title="Play">${i + 1}</button>
          <img class="rthumb" src="${esc(t.thumb)}" alt="">
          <div class="rmeta">
            <div class="rtitle">${esc(t.title)} <span class="dl-tag">Offline</span></div>
            <div class="rartist">${esc(t.artist)}</div>
          </div>
          <div class="ralbum">${esc(t.album || 'Downloaded')}</div>
          <span class="rdur">${t.duration ? fmtDur(t.duration) : ''}</span>
          <button class="iconbtn" data-action="dl-reveal" data-idx="${i}" title="Show in File Explorer">${icon('folder')}</button>
          <button class="rmenu" data-action="row-menu" title="More">${icon('dots')}</button>
        </div>
      `;
    }).join('');

    set(`
      <div class="downloads-view">
        <div class="downloads-header">
          <div>
            <h1 class="vh-title" style="margin:0 0 4px">Downloads</h1>
            <p class="vh-sub" style="margin:0">${list.length} offline tracks ready to play without internet</p>
          </div>
          <button class="dl-folder-btn" data-action="dl-open-folder">${icon('folder')} Open Downloads Folder</button>
        </div>
        <div class="trows" style="margin-top:12px">${rows}</div>
      </div>
    `);
  } catch (err) {
    if (tok !== S.viewTok) return;
    set(`<div class="err-box">Failed to load downloads: ${esc(err.message)}</div>`);
  }
}

function recordListening(t, seconds = 30) {
  if (!t || !t.id) return;
  const key = `${t.id}:${Math.floor(Date.now() / 60000)}`;
  if (S.recorded.has(key)) return;
  S.recorded.add(key);
  mutate({
    type: 'stats.record',
    track: { id: t.id, title: t.title, artist: t.artist, thumb: t.thumb, duration: t.duration },
    seconds: Math.round(seconds)
  }).catch(() => {});
}

function renderStats(tok) {
  const stats = (S.store && S.store.playStats) || {
    totalPlays: 0,
    totalSeconds: 0,
    tracks: {},
    artists: {}
  };

  const totalHours = (stats.totalSeconds / 3600).toFixed(1);
  const totalMins = Math.round(stats.totalSeconds / 60);
  const timeDisplay = totalHours >= 1 ? `${totalHours} Hours` : `${totalMins} Mins`;

  const topTracksList = Object.entries(stats.tracks || {})
    .sort((a, b) => (b[1].plays || 0) - (a[1].plays || 0))
    .slice(0, 10);

  const topArtistsList = Object.entries(stats.artists || {})
    .sort((a, b) => (b[1].plays || 0) - (a[1].plays || 0))
    .slice(0, 10);

  const topArtistName = topArtistsList[0] ? topArtistsList[0][0] : 'None yet';
  const topTrackTitle = topTracksList[0] ? topTracksList[0][1].title : 'None yet';

  S.lists['top_stats'] = topTracksList.map(([id, t]) => ({
    id,
    title: t.title,
    artist: t.artist,
    thumb: t.thumb,
    duration: t.duration
  }));

  const topTracksHtml = topTracksList.length ? topTracksList.map(([id, t], i) => `
    <div class="top-item">
      <div class="top-rank rank-${i + 1}">${i + 1}</div>
      <img class="top-thumb" src="${esc(t.thumb)}" alt="">
      <div class="top-meta">
        <div class="top-title">${esc(t.title)}</div>
        <div class="top-sub">${esc(t.artist)}</div>
      </div>
      <div class="top-count">${t.plays} plays</div>
      <button class="iconbtn" data-action="stats-play" data-idx="${i}" title="Play">${icon('play')}</button>
    </div>
  `).join('') : '<div class="q-empty" style="padding:16px 0">Play some songs to build your top tracks list!</div>';

  const topArtistsHtml = topArtistsList.length ? topArtistsList.map(([artist, a], i) => `
    <div class="top-item">
      <div class="top-rank rank-${i + 1}">${i + 1}</div>
      <div class="top-meta">
        <div class="top-title">${esc(artist)}</div>
        <div class="top-sub">${Math.round(a.seconds / 60)} minutes listened</div>
      </div>
      <div class="top-count">${a.plays} plays</div>
    </div>
  `).join('') : '<div class="q-empty" style="padding:16px 0">Listen to music to see your top artists!</div>';

  set(`
    <div class="stats-view">
      <div>
        <h1 class="vh-title" style="margin:0 0 4px">Listening Analytics</h1>
        <p class="vh-sub" style="margin:0">Your listening history, mini-wrapped trends, and favorite music</p>
      </div>

      <div class="stat-cards">
        <div class="stat-card">
          <div class="stat-card-title">Listening Time</div>
          <div class="stat-card-val">${timeDisplay}</div>
          <div class="stat-card-sub">${totalMins} total minutes</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-title">Total Tracks Played</div>
          <div class="stat-card-val">${stats.totalPlays || 0}</div>
          <div class="stat-card-sub">${Object.keys(stats.tracks || {}).length} unique songs</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-title">Top Artist</div>
          <div class="stat-card-val" style="font-size:20px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap">${esc(topArtistName)}</div>
          <div class="stat-card-sub">${topArtistsList[0] ? topArtistsList[0][1].plays + ' plays' : '—'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-title">Top Song</div>
          <div class="stat-card-val" style="font-size:20px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap">${esc(topTrackTitle)}</div>
          <div class="stat-card-sub">${topTracksList[0] ? topTracksList[0][1].plays + ' plays' : '—'}</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-section">
          <h3>Top Songs</h3>
          <div class="top-list">${topTracksHtml}</div>
        </div>
        <div class="stat-section">
          <h3>Top Artists</h3>
          <div class="top-list">${topArtistsHtml}</div>
        </div>
      </div>
    </div>
  `);
}

const WALLPAPER_PRESETS = [
  { id: 'none', name: 'None (Default)', url: '' },
  { id: 'dark_studio', name: 'Dark Studio', url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1600' },
  { id: 'cyber_neon', name: 'Cyber Neon', url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=1600' },
  { id: 'sunset_waves', name: 'Sunset Waves', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1600' },
  { id: 'vinyl_lounge', name: 'Vinyl Lounge', url: 'https://images.unsplash.com/photo-1539185441755-769473a23570?q=80&w=1600' }
];

const ACCENT_PRESETS = [
  { id: 'auto', name: 'Album Dynamic', hue: 'auto', color: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
  { id: 'violet', name: 'Violet', hue: 258, color: '#8b5cf6' },
  { id: 'cyan', name: 'Cyber Cyan', hue: 190, color: '#06b6d4' },
  { id: 'emerald', name: 'Emerald', hue: 155, color: '#10b981' },
  { id: 'orange', name: 'Sunset Orange', hue: 25, color: '#f97316' },
  { id: 'rose', name: 'Rose', hue: 340, color: '#f43f5e' }
];

function applyWallpaper() {
  const s = settings();
  const wp = $('#wallpaperBackdrop');
  if (!wp) return;
  if (s && s.wallpaper) {
    wp.style.backgroundImage = `url("${s.wallpaper}")`;
    wp.style.opacity = '1';
    const dim = (s.wallpaperDim != null ? s.wallpaperDim : 60) / 100;
    wp.style.filter = `brightness(${Math.max(0.05, 1 - dim)})`;
  } else {
    wp.style.backgroundImage = 'none';
    wp.style.opacity = '0';
  }
}

function renderSettings(tok) {
  const s = settings();
  const curWp = s.wallpaper || '';
  const curDim = s.wallpaperDim != null ? s.wallpaperDim : 60;
  const curHue = s.accentHue != null ? s.accentHue : 'auto';
  const closeToTray = !!s.closeToTray;

  const wpCards = WALLPAPER_PRESETS.map(p => `
    <div class="wallpaper-thumb-card ${curWp === p.url ? 'active' : ''}"
         data-action="set-wallpaper" data-url="${esc(p.url)}"
         style="${p.url ? `background-image:url('${p.url}')` : 'background:#131722'}">
      <div class="wallpaper-thumb-label">${esc(p.name)}</div>
    </div>
  `).join('');

  const accentChips = ACCENT_PRESETS.map(a => `
    <div class="accent-chip ${String(curHue) === String(a.hue) ? 'active' : ''}"
         data-action="set-accent" data-hue="${a.hue}" title="${esc(a.name)}"
         style="background:${a.color}"></div>
  `).join('');

  set(`
    <div class="settings-view">
      <div>
        <h1 class="vh-title" style="margin:0 0 4px">Settings & Customization</h1>
        <p class="vh-sub" style="margin:0">Personalize your themes, audio processing, and Windows system preferences</p>
      </div>

      <div class="settings-card">
        <h3>${icon('palette')} Custom Appearance & Wallpaper</h3>
        <div class="settings-row">
          <div class="settings-label">
            <span class="settings-title">Accent Color</span>
            <span class="settings-desc">Choose a vibrant accent color or match automatically from album artwork</span>
          </div>
          <div class="accent-palette">${accentChips}</div>
        </div>
        <div style="height:1px;background:var(--line);margin:4px 0"></div>
        <div class="settings-label">
          <span class="settings-title">Wallpaper Backdrop</span>
          <span class="settings-desc">Select a backdrop aesthetic behind the player</span>
        </div>
        <div class="wallpaper-presets">${wpCards}</div>
        <div class="settings-row" style="margin-top:8px">
          <div class="settings-label" style="flex:1">
            <span class="settings-title">Custom Wallpaper URL</span>
            <span class="settings-desc">Paste an online image URL or local image file path</span>
          </div>
          <div style="display:flex;gap:8px;width:340px">
            <input type="text" id="customWpInput" value="${esc(curWp)}" placeholder="https://... or C:\\images\\bg.jpg" spellcheck="false" style="padding:6px 10px;border-radius:6px;background:var(--bg3);border:1px solid var(--line);flex:1">
            <button id="customWpBtn" class="primary" style="padding:6px 14px;border-radius:6px;background:var(--accent);color:#fff;font-weight:600">Apply</button>
          </div>
        </div>
        <div class="settings-row" style="margin-top:8px">
          <div class="settings-label">
            <span class="settings-title">Backdrop Dimming</span>
            <span class="settings-desc">Adjust overlay opacity to keep text clear and readable</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <input type="range" id="wpDimInput" min="0" max="90" step="5" value="${curDim}" style="accent-color:var(--accent);width:140px">
            <span id="wpDimVal" style="font-size:12px;font-weight:700;color:var(--accent);min-width:35px">${curDim}%</span>
          </div>
        </div>
      </div>

      <div class="settings-card">
        <h3>${icon('eq')} Audio DSP & Equalizer</h3>
        <div class="settings-row">
          <div class="settings-label">
            <span class="settings-title">10-Band Graphic Equalizer</span>
            <span class="settings-desc">Hardware-accelerated frequency tuning, bass boost, and presets</span>
          </div>
          <button class="ghostbtn" data-action="open-eq" style="padding:8px 16px;border-radius:8px;display:flex;align-items:center;gap:8px">
            ${icon('eq')} Configure EQ
          </button>
        </div>
      </div>

      <div class="settings-card">
        <h3>${icon('music')} Windows Integration</h3>
        <div class="settings-row">
          <div class="settings-label">
            <span class="settings-title">Close to System Tray</span>
            <span class="settings-desc">Keep music playing in the background when clicking the window close (X) button</span>
          </div>
          <label class="eq-checkbox-label">
            <input type="checkbox" id="settingCloseToTray" ${closeToTray ? 'checked' : ''}>
            <span style="font-weight:600">Enabled</span>
          </label>
        </div>
        <div style="height:1px;background:var(--line);margin:4px 0"></div>
        <div class="settings-row">
          <div class="settings-label">
            <span class="settings-title">Taskbar Thumbnail Controls</span>
            <span class="settings-desc">Previous, Play/Pause, and Next buttons active in Windows taskbar preview</span>
          </div>
          <span style="font-size:12px;color:#34d399;font-weight:700">Active</span>
        </div>
      </div>

      <div class="settings-card">
        <h3>${icon('download')} Storage & Offline Music</h3>
        <div class="settings-row">
          <div class="settings-label">
            <span class="settings-title">Offline Music Folder</span>
            <span class="settings-desc">Downloaded tracks are stored in high-fidelity format with artwork in Music/My Music</span>
          </div>
          <button class="dl-folder-btn" data-action="dl-open-folder">${icon('folder')} Open Folder</button>
        </div>
      </div>
    </div>
  `);

  const customWpBtn = $('#customWpBtn');
  if (customWpBtn) {
    customWpBtn.addEventListener('click', () => {
      const url = $('#customWpInput').value.trim();
      settings().wallpaper = url;
      applyWallpaper();
      mutate({ type: 'settings.set', patch: { wallpaper: url } });
      toast('Wallpaper applied');
    });
  }

  const wpDimInput = $('#wpDimInput');
  const wpDimVal = $('#wpDimVal');
  if (wpDimInput && wpDimVal) {
    wpDimInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      wpDimVal.textContent = val + '%';
      settings().wallpaperDim = val;
      applyWallpaper();
      mutate({ type: 'settings.set', patch: { wallpaperDim: val } });
    });
  }

  const trayCheck = $('#settingCloseToTray');
  if (trayCheck) {
    trayCheck.addEventListener('change', (e) => {
      settings().closeToTray = !!e.target.checked;
      mutate({ type: 'settings.set', patch: { closeToTray: settings().closeToTray } });
      toast('Close to tray ' + (settings().closeToTray ? 'enabled' : 'disabled'));
    });
  }
}

function syncTaskbarTray() {
  const t = curTrack();
  call('player:status', {
    playing: S.playing && !audio.paused,
    title: t ? t.title : '',
    artist: t ? t.artist : ''
  }).catch(() => {});
}
