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
  radio: '<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5m-8.4 0c-2.3-2.3-2.3-6.1 0-8.5m11.3-2.8c4 4 4 10.3 0 14.2m-14.2 0c-4-4-4-10.3 0-14.2"/>',
  automix: '<path d="M3 17h4l4-10h6M17 4l4 3-4 3M3 7h4l1.5 3.5M14.5 13.5L16 17h5M17 14l4 3-4 3"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  contract: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>'
};
const FILLED = new Set(['play', 'pause', 'next', 'prev']);
const icon = (n, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="${FILLED.has(n) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n] || ''}</svg>`;

// ---------- dual-deck audio state ----------
const deckA = $('#audio');
const deckB = $('#audioB');
let curAudio = deckA;
let standbyAudio = deckB;
let audio = curAudio;

const automixS = {
  mixing: false,
  preloadedPos: -1,
  preloadedId: null,
  preloading: false,
  raf: 0,
  startTime: 0,
  duration: 6,
  progress: 0,
  swappedMeta: false,
  quick: false,
  curMeta: null,
  preloadedMeta: null,
  preloadedLyrics: null
};

let autoMixEngine = null;
let autoMixAnalyzer = null;

function initAutoMixEngine() {
  if (typeof AutoMix === 'undefined') return;
  if (!autoMixEngine) {
    autoMixAnalyzer = new AutoMix.AutoMixAnalyzer();
    autoMixEngine = new AutoMix.AutoMixEngine(deckA, deckB, {
      enabled: settings().automix !== false,
      defaultDurationSec: settings().crossfadeDuration || 6,
      bassCutFrequencyHz: 200,
      bassCutMaxDb: -24,
      preferWebAudio: true
    });
    const analyserNode = autoMixEngine.getAnalyser();
    if (analyserNode && typeof SonaraEngine !== 'undefined') {
      SonaraEngine.setAudioSource(analyserNode);
    }
  }
}

let lastQueueSave = 0, lastPresenceSave = 0;

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
  homePersonalTok: 0,
  viewTok: 0,
  seeking: false,
  lists: {},           // listKey -> track array (for row buttons)
  renderCtx: null,     // { listKey } of the main list in current view
  menuTrack: null, menuExtra: null,
  lastVol: null,
  fsOpen: false,
  fsTab: 'stage',
  fsSeeking: false,
  _lastFsLy: -1
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
        wallpaper: '', wallpaperDim: 60, accentHue: 'auto', closeToTray: false, ambientColors: true,
        lyricsStyle: 'random'
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
    if (settings().ambientColors !== false && (settings().accentHue == null || settings().accentHue === 0)) {
      settings().accentHue = 'auto';
    }
    const initHue = settings().accentHue !== 'auto' && settings().accentHue != null
      ? settings().accentHue : ACC_DEFAULT_HUE;
    setHue(initHue === 'auto' ? ACC_DEFAULT_HUE : initHue);

    if (window.api && window.api.on) {
      window.api.on('cmd:toggle', () => togglePlay());
      window.api.on('cmd:next', () => next());
      window.api.on('cmd:prev', () => prev());
      window.api.on('updates:available', (info) => showUpdatePrompt(info));
      window.api.on('updates:progress', (info) => updateProgress(info));
      window.api.on('updates:error', (info) => showUpdateError(info));
      window.api.on('updates:not-available', () => toast('You’re up to date'));
    }

    const lq = S.store.lastQueue;
    if (lq && Array.isArray(lq.tracks) && lq.tracks.length) {
      S.queue = lq.tracks;
      S.order = S.queue.map((_, i) => i);
      S.oi = Math.max(0, Math.min(lq.index | 0, S.queue.length - 1));
      const t = S.queue[S.oi];
      if (t) {
        setNowPlaying(t, true);
        // Restore audio position without auto-playing (crash recovery)
        (async () => {
          try {
            if (t.localPath) {
              curAudio.src = 'file:///' + t.localPath.replace(/\\/g, '/');
            } else {
              const r = await call('ytm:stream', { id: t.id });
              if (!r || !r.urls || !r.urls.length) return;
              curAudio.src = r.urls[0];
            }
            curAudio.addEventListener('loadedmetadata', function onMeta() {
              curAudio.removeEventListener('loadedmetadata', onMeta);
              try { curAudio.currentTime = Math.max(0, Number(lq.time) || 0); } catch {}
            }, { once: true });
          } catch { /* non-fatal */ }
        })();
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
    <canvas id="pb-liquid-canvas" class="pb-liquid-canvas"></canvas>
    <div class="pb-left">
      <div class="np-thumb-wrap">
        <img id="np-thumb" src="" alt="">
        <div id="np-mixing-badge" class="np-mixing-badge hidden" title="AutoMix: Blending into next track">
          <span class="mixing-dot"></span> MIXING
        </div>
      </div>
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
        <button id="pb-automix" class="iconbtn ${settings().automix ? 'on' : ''}" data-action="pb-automix" title="AutoMix (Apple Music Transitions)">${icon('automix')}</button>
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
        <button id="q-automix-toggle" class="ghostbtn ${settings().automix ? 'on' : ''}" data-action="toggle-automix" title="Apple Music-style AutoMix transitions" style="padding:4px 10px;font-size:12px;display:flex;align-items:center;gap:5px;">
          ${icon('automix')} AutoMix
        </button>
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

  const npOverlay = $('#nowPlayingOverlay');
  if (npOverlay) {
    npOverlay.innerHTML = `
      <div class="fs-backdrop-gradient"></div>
      <canvas id="fsCanvas"></canvas>
      <div class="fs-container">
        <header class="fs-header">
          <div class="fs-header-left">
            <button id="fs-collapse" class="fs-circle-btn" title="Collapse (Esc)">
              ${icon('chevronDown')}
            </button>
            <div class="fs-context-info">
              <span class="fs-context-eyebrow">PLAYING FROM</span>
              <span id="fs-context-title" class="fs-context-title">Queue</span>
            </div>
          </div>
          
          <div class="fs-view-tabs">
            <button class="fs-tab-btn active" data-tab="stage">Now Playing</button>
            <button class="fs-tab-btn" data-tab="lyrics">Lyrics</button>
            <button class="fs-tab-btn" data-tab="queue">Up Next</button>
          </div>

          <div class="fs-header-right">
            <div class="fs-viz-picker">
              <span class="fs-viz-label">${icon('viz')}</span>
              <select id="fs-viz-select" class="fs-select" title="Background Visualizer">
                <option value="bokeh" ${settings().fsViz === 'bokeh' ? 'selected' : ''}>Petals &amp; Bokeh</option>
                <option value="stardust" ${settings().fsViz === 'stardust' ? 'selected' : ''}>Stardust &amp; Aurora</option>
                <option value="bubbles" ${settings().fsViz === 'bubbles' ? 'selected' : ''}>Floating Bubbles</option>
                <option value="waves" ${settings().fsViz === 'waves' ? 'selected' : ''}>Ambient Waves</option>
                <option value="off" ${settings().fsViz === 'off' ? 'selected' : ''}>Visualizer Off</option>
              </select>
            </div>
            <button id="fs-fullscreen-btn" class="fs-circle-btn" title="Toggle Fullscreen">
              ${icon('expand')}
            </button>
          </div>
        </header>

        <main class="fs-center-stage">
          <section id="fs-view-stage" class="fs-tab-view active">
            <div class="fs-stage-card">
              <div class="fs-artwork-wrap">
                <img id="fs-thumb" src="" alt="Artwork" class="fs-artwork">
                <div id="fs-mixing-badge" class="np-mixing-badge hidden" title="AutoMix: Blending into next track">
                  <span class="mixing-dot"></span> MIXING
                </div>
              </div>
              <div class="fs-stage-meta">
                <div id="fs-title" class="fs-track-title">My Music</div>
                <div id="fs-artist" class="fs-track-artist">Select a song to start playing</div>
              </div>
              <div id="fs-lyrics-card" class="fs-lyrics-preview-card" title="Click to view full lyrics">
                <div class="fs-ly-preview-tag">${icon('lyrics')} LYRICS PREVIEW</div>
                <div id="fs-ly-preview-text" class="fs-ly-preview-text">No lyrics for this one yet</div>
              </div>
            </div>
          </section>

          <section id="fs-view-lyrics" class="fs-tab-view">
            <div class="fs-lyrics-container">
              <div class="fs-lyrics-actions">
                <div class="fs-lyrics-left-actions">
                  <div class="fs-lyrics-style-picker" title="Select lyrics presentation style">
                    <span class="fs-lyrics-style-label">${icon('lyrics')}</span>
                    <select id="fs-lyrics-style-select" class="fs-select" title="Lyrics Style">
                      <option value="random">🔀 Auto-Randomize per Song</option>
                      <option value="cinematic">✨ Cinematic Story (SONARA)</option>
                      <option value="apple-music">🎵 Apple Music Kinetic</option>
                      <option value="verci-visual">✨ Verci Visual (with Emojis)</option>
                      <option value="verci-chat">💬 Verci iMessage Chat</option>
                      <option value="verci-notifications">📱 Verci iOS Notifications</option>
                      <option value="verci-fisheye">👁️ Verci 3D Fisheye Lens</option>
                      <option value="verci-code">💻 Verci Code Terminal</option>
                      <option value="verci-constellation">🌌 Verci Constellation Nodes</option>
                      <option value="karaoke">🎤 Classic Karaoke</option>
                      <option value="minimal">📄 Minimalist Clean</option>
                    </select>
                  </div>
                  <div id="fs-cinematic-mood-badge" class="fs-mood-badge hidden" title="Detected Emotional Tone">
                    <span class="mood-dot"></span> <span id="fs-mood-text">Dreaming</span>
                  </div>
                </div>

                <div class="fs-lyrics-right-actions">
                  <div id="fs-lyrics-offset-bar" class="ly-offset-bar fs-ly-offset">
                    <span class="ly-off-label">Offset:</span>
                    <button class="ly-off-btn fs-off-btn" data-dir="-1" title="-500ms">-0.5s</button>
                    <span id="fs-ly-off-val" class="ly-off-val">0ms</span>
                    <button class="ly-off-btn fs-off-btn" data-dir="1" title="+500ms">+0.5s</button>
                    <button id="fs-ly-off-reset" class="ly-off-reset" title="Reset offset">Reset</button>
                  </div>
                  <button id="fs-lyrics-trans-btn" class="ghostbtn ly-trans-btn" title="Translate lyrics to English">
                    ${icon('translate')} <span>Translate</span>
                  </button>
                </div>
              </div>

              <!-- SONARA Cinematic Lyric Animation Canvas Stage -->
              <div id="fs-cinematic-stage" class="fs-cinematic-stage">
                <canvas id="fs-cinematic-canvas"></canvas>
                <div id="fs-cinematic-subtitles" class="fs-cinematic-subtitles">
                  <div id="fs-cine-prev" class="cine-sub-line cine-prev" title="Previous line"></div>
                  <div id="fs-cine-cur" class="cine-sub-line cine-cur" title="Current line">Listening to music…</div>
                  <div id="fs-cine-next" class="cine-sub-line cine-next" title="Next line"></div>
                </div>
              </div>

              <!-- Scrollable Lyrics Container for Apple Music, Karaoke, and Minimal -->
              <div id="fs-lyrics-body" class="fs-lyrics-scroll-body hidden">
                <div class="fs-lyrics-empty">No lyrics loaded</div>
              </div>
            </div>
          </section>

          <section id="fs-view-queue" class="fs-tab-view">
            <div class="fs-queue-container">
              <div class="fs-queue-header">
                <h3>Upcoming Tracks</h3>
                <div class="fs-queue-actions">
                  <button id="fs-q-shuffle" class="ghostbtn" title="Shuffle remaining queue">${icon('shuffle')} Shuffle</button>
                </div>
              </div>
              <div id="fs-queue-body" class="fs-queue-scroll-body"></div>
            </div>
          </section>
        </main>

        <footer class="fs-transport">
          <div class="fs-seek-container">
            <span id="fs-t-cur" class="fs-time-cur">0:00</span>
            <input id="fs-seek" class="fs-seek-slider" type="range" min="0" max="100" step="0.1" value="0">
            <span id="fs-t-total" class="fs-time-total">0:00</span>
          </div>

          <div class="fs-controls-container">
            <div class="fs-ctrls-left">
              <button id="fs-fav" class="fs-icon-btn" title="Favorite">${icon('heart')}</button>
            </div>

            <div class="fs-ctrls-center">
              <button id="fs-shuffle" class="fs-icon-btn" title="Shuffle">${icon('shuffle')}</button>
              <button id="fs-prev" class="fs-icon-btn fs-skip-btn" title="Previous">${icon('prev')}</button>
              <button id="fs-play" class="fs-hero-play-btn" title="Play / Pause">${icon('play')}</button>
              <button id="fs-next" class="fs-icon-btn fs-skip-btn" title="Next">${icon('next')}</button>
              <button id="fs-repeat" class="fs-icon-btn" title="Repeat">${icon('repeat')}</button>
            </div>

            <div class="fs-ctrls-right">
              <button id="fs-automix" class="fs-icon-btn ${settings().automix ? 'on' : ''}" title="AutoMix (Apple Music Transitions)">
                ${icon('automix')}
              </button>
              <div class="fs-vol-group">
                <button id="fs-vol-btn" class="fs-icon-btn" title="Mute">${icon('vol')}</button>
                <input id="fs-vol" class="fs-vol-slider" type="range" min="0" max="1" step="0.01" value="${audio.volume}">
              </div>
            </div>
          </div>
        </footer>
      </div>
    `;
    fsVizInit();
    bindNowPlayingOverlayEvents();
  }

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
    if (input && document.activeElement !== input) input.value = S.params.q;
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
    if (input && document.activeElement !== input) input.value = S.params.q;
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
    <img class="rthumb" src="${esc(t.thumb)}" alt="" loading="lazy" decoding="async">
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
    <div class="card-thumb"><img src="${esc(item.thumb)}" alt="" loading="lazy" decoding="async"></div>
    <div class="card-title">${esc(label)}</div>
    <div class="card-sub">${esc(sub)}</div>
  </button>`;
}

const cardsBlock = (items, action, round = false) => `<div class="grid">${items.map(it => card(it, action, round)).join('')}</div>`;

function ctxHeader({ type, title, meta, thumb, round = false, listKey, extraActions = '' }) {
  return `<div class="ctx-head">
    ${thumb ? `<img class="ctximg ${round ? 'round' : ''}" src="${esc(thumb)}" alt="" loading="lazy" decoding="async">` : ''}
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

  const stats = (S.store && S.store.playStats) || {};
  const topArtists = Object.entries(stats.artists || {})
    .sort((a, b) => (b[1].plays || 0) - (a[1].plays || 0))
    .slice(0, 6);
  const topTracks = Object.entries(stats.tracks || {})
    .sort((a, b) => (b[1].plays || 0) - (a[1].plays || 0))
    .slice(0, 6);

  let html = `<h1 class="page-title">Home</h1>`;
  if (topArtists.length) {
    const name = topArtists[0][0];
    html += `<div class="home-hero">
      <div class="home-hero-eyebrow">Made for you</div>
      <div class="home-hero-title">Welcome back</div>
      <div class="home-hero-sub">Your top artist is <b>${esc(name)}</b> — here are mixes, recommendations and more to keep the music going.</div>
    </div>`;
  } else if (!rec.length && !fav.length) {
    html += `<div class="empty-hero"><b>Welcome to My Music</b><br>Type in the search bar above to find any song, album, artist or playlist from YouTube Music.</div>`;
  }
  if (rec.length) {
    S.lists['home-recent'] = S.store.recent;
    html += `<div class="sechead"><h2>Recently played</h2><button class="seeall" data-nav="recent">Show all</button></div>` + rowsBlock(rec, 'home-recent');
  }
  if (fav.length) {
    S.lists['home-liked'] = S.store.favorites;
    html += `<div class="sechead"><h2>Liked songs</h2><button class="seeall" data-nav="liked">Show all</button></div>` + rowsBlock(fav, 'home-liked');
  }
  if (topTracks.length) {
    S.lists['home-top'] = topTracks.map(([id, t]) => ({ id, title: t.title, artist: t.artist, thumb: t.thumb, duration: t.duration }));
    html += `<div class="sechead"><h2>Your top tracks</h2><button class="seeall" data-nav="stats">See stats</button></div>` + rowsBlock(S.lists['home-top'], 'home-top');
  }
  if (topArtists.length) {
    html += `<div class="sechead"><h2>Your top artists</h2></div>`;
    html += `<div class="grid">${topArtists.map(([name, a]) => {
      const thumb = a.thumb || (S.artistThumbs && S.artistThumbs[name]);
      const thumbHtml = thumb
        ? `<img class="artist-img" src="${esc(thumb)}" alt="${esc(name)}">`
        : `<div class="artist-avatar">${esc(name.slice(0,1).toUpperCase())}</div>`;
      return `<button class="card round artist-chip" data-action="${a.id ? 'artist' : 'home-artist-search'}" data-id="${esc(a.id || '')}" data-query="${esc(name)}">
        <div class="card-thumb" data-artist-thumb-home="${esc(name)}">${thumbHtml}</div>
        <div class="card-title">${esc(name)}</div>
        <div class="card-sub">${a.plays} plays</div>
      </button>`;
    }).join('')}</div>`;
  }
  html += `<div id="homePersonal"></div>`;
  html += `<div id="homeFeed"><div class="home-skeleton">${[0,1,2,3].map(()=>'<div class="skel-row"></div>').join('')}</div></div>`;
  set(html);
  loadTopArtistThumbs(topArtists);
  loadPersonalizedFeed();
  loadHomeFeed();
}

function findArtistId(name) {
  if (!name || !S.store) return null;
  const match = (t) => t && t.artist === name && t.artistId;
  const fromRec = (S.store.recent || []).find(match);
  if (fromRec) return fromRec.artistId;
  const fromFav = (S.store.favorites || []).find(match);
  if (fromFav) return fromFav.artistId;
  const tracks = Object.values((S.store.playStats && S.store.playStats.tracks) || {});
  const fromTracks = tracks.find(match);
  if (fromTracks) return fromTracks.artistId;
  return null;
}

if (!S.artistThumbs) S.artistThumbs = {};

function updateArtistThumbInDom(name, thumb, id) {
  document.querySelectorAll('[data-artist-thumb-home]').forEach(el => {
    if (el.dataset.artistThumbHome === name) {
      el.innerHTML = `<img class="artist-img" src="${esc(thumb)}" alt="${esc(name)}">`;
      const btn = el.closest('button.artist-chip');
      if (btn && id) {
        btn.dataset.action = 'artist';
        btn.dataset.id = id;
      }
    }
  });
  document.querySelectorAll('[data-artist-thumb-stat]').forEach(el => {
    if (el.dataset.artistThumbStat === name) {
      el.innerHTML = `<img class="top-thumb round" src="${esc(thumb)}" alt="${esc(name)}">`;
      const item = el.closest('.top-item');
      if (item && id) {
        item.dataset.action = 'artist';
        item.dataset.id = id;
      }
    }
  });
}

async function loadTopArtistThumbs(artistsList) {
  if (!artistsList || !artistsList.length) return;
  for (const [name, a] of artistsList) {
    if (a.thumb) {
      S.artistThumbs[name] = a.thumb;
      continue;
    }
    if (S.artistThumbs[name]) {
      a.thumb = S.artistThumbs[name];
      updateArtistThumbInDom(name, S.artistThumbs[name], a.id);
      continue;
    }
    const knownId = a.id || findArtistId(name);
    call('ytm:artist-thumb', { name, artistId: knownId }).then((res) => {
      if (!res || !res.thumb) return;
      const thumb = res.thumb;
      const id = res.id || knownId;
      S.artistThumbs[name] = thumb;
      a.thumb = thumb;
      if (id && !a.id) a.id = id;
      mutate({ type: 'stats.artistUpdate', artist: name, thumb, id: a.id }).catch(() => {});
      updateArtistThumbInDom(name, thumb, a.id);
    }).catch(() => {});
  }
}

async function loadPersonalizedFeed() {
  const tok = ++S.homePersonalTok;
  const el = null;
  // build personalized shelves from top artists
  const stats = (S.store && S.store.playStats) || {};
  const topArtists = Object.entries(stats.artists || {})
    .sort((a, b) => (b[1].plays || 0) - (a[1].plays || 0))
    .slice(0, 3)
    .map(([name]) => name);
  const recentTracks = (S.store.recent || []).slice(0, 3);
  const queries = [];
  // "More from your top artist"
  if (topArtists[0]) queries.push({ title: `More from ${topArtists[0]}`, q: topArtists[0] });
  // "Because you listened to X"
  if (recentTracks[0]) queries.push({ title: `Because you played ${recentTracks[0].title}`, q: recentTracks[0].artist || recentTracks[0].title });
  // "Recommended for you" from second top artist
  if (topArtists[1]) queries.push({ title: `You might also like ${topArtists[1]}`, q: topArtists[1] });

  if (queries.length > 2) queries.length = 2;

  if (!queries.length) return;

  const container = $('#homePersonal');
  if (!container) return;
  container.innerHTML = `<div class="home-skeleton">${[0,1,2].map(()=>'<div class="skel-row"></div>').join('')}</div>`;

  // Fire all searches in parallel to cut load time
  const results = await Promise.all(queries.map(async ({ title, q }, qi) => {
    try {
      const res = await call('ytm:search', { query: q, filter: 'songs' });
      if (tok !== S.homePersonalTok || S.view !== 'home') return null;
      const songs = (res && res.songs ? res.songs : []).slice(0, 6);
      if (!songs.length) return null;
      const key = 'home-personal-' + qi;
      S.lists[key] = songs;
      return `<div class="sechead"><h2>${esc(title)}</h2></div>` + rowsBlock(songs, key);
    } catch { return null; }
  }));

  const c2 = $('#homePersonal');
  if (c2 && tok === S.homePersonalTok) {
    const html = results.filter(Boolean).join('');
    c2.innerHTML = html || '';
  }
}

// home-artist-search action handled in click delegation below (search by name)
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
  if (input && q && input.value !== q && document.activeElement !== input) input.value = q;
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
  if (S.search.q === q) {
    S.search.results[filter] = r;
  }
  if (tok !== S.search.tok || S.search.q !== q) return;
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

// ---------- AutoMix & Song Transitions Engine (Apple Music Style) ----------

function getAutomixDuration(trackDuration) {
  const durSetting = settings().automixDuration;
  // User custom duration selection (1s - 15s)
  if (durSetting && durSetting !== 'auto' && !isNaN(Number(durSetting))) {
    const customSecs = Math.max(1, Math.min(15, Number(durSetting)));
    if (trackDuration && trackDuration > 10) {
      return Math.min(customSecs, Math.max(2, Math.floor(trackDuration * 0.28)));
    }
    return customSecs;
  }

  // Fallback to manual crossfade duration if specifically configured
  if (settings().automixMode === 'crossfade') {
    return Math.max(1, Math.min(15, Number(settings().crossfadeDuration) || 6));
  }

  // Default Best Mix (Apple Music Smart Dynamic Adaptation):
  // Intelligently analyzes track length and tempo dynamics for the optimal blend
  if (!trackDuration || trackDuration < 90) return 4.0;  // Quick energetic blend for short tracks (<1.5m)
  if (trackDuration < 240) return 6.0;                   // Canonical 6.0s Apple Music sweet spot
  return 8.5;                                           // Deep extended blend for 4+ min tracks
}

function cancelAutoMix() {
  if (!automixS.mixing) return;
  if (automixS.raf) cancelAnimationFrame(automixS.raf);
  automixS.mixing = false;
  try {
    standbyAudio.pause();
    standbyAudio.src = '';
    standbyAudio.volume = 0;
  } catch {}
  if (autoMixEngine) autoMixEngine.resetDeckDsp();
  automixS.preloadedMeta = null;
  automixS.preloadedLyrics = null;

  const mVol = Math.min(1, Math.max(0, settings().volume ?? 0.8));
  curAudio.volume = mVol;
  const badge = $('#np-mixing-badge');
  if (badge) badge.classList.add('hidden');
  const fsBadge = $('#fs-mixing-badge');
  if (fsBadge) fsBadge.classList.add('hidden');
  const mixBtn = $('#pb-automix');
  if (mixBtn) mixBtn.classList.remove('mixing-glow');
  const fsMixBtn = $('#fs-automix');
  if (fsMixBtn) fsMixBtn.classList.remove('mixing-glow');
}

async function preloadNextTrack(nextPos) {
  if (automixS.preloading || automixS.mixing) return;
  const nextIdx = S.order[nextPos];
  if (nextIdx == null || !S.queue[nextIdx]) return;
  const t = S.queue[nextIdx];
  if (automixS.preloadedPos === nextPos && automixS.preloadedId === t.id && standbyAudio.src) return;

  automixS.preloading = true;
  try {
    let url = null;
    if (t.localPath) {
      url = 'file:///' + t.localPath.replace(/\\/g, '/');
    } else {
      const r = await call('ytm:stream', { id: t.id });
      if (r && r.urls && r.urls.length) url = r.urls[0];
    }
    if (url) {
      standbyAudio.src = url;
      standbyAudio.preload = 'auto';
      standbyAudio.volume = 0;
      standbyAudio.load();
      automixS.preloadedPos = nextPos;
      automixS.preloadedId = t.id;
      console.log('[automix] pre-buffered next track on standby deck:', t.title);

      // Pre-analyze DSP & pre-fetch lyrics in memory
      if (typeof AutoMix !== 'undefined') {
        initAutoMixEngine();
        autoMixAnalyzer.analyze({ id: t.id, title: t.title, artist: t.artist, streamUrl: url, localPath: t.localPath, durationSec: t.duration || 180 })
          .then(meta => { automixS.preloadedMeta = meta; })
          .catch(() => {});
        call('ytm:lyrics', { track: t })
          .then(res => {
            if (res && (res.synced || res.plain)) {
              automixS.preloadedLyrics = res;
            }
          })
          .catch(() => {});
      }
    }
  } catch (err) {
    console.log('[automix] preload error:', (err && err.message) || err);
  } finally {
    automixS.preloading = false;
  }
}

async function startAutoMix(nextPos, isQuick = false) {
  if (automixS.mixing) return;
  const nextIdx = S.order[nextPos];
  if (nextIdx == null || !S.queue[nextIdx]) return;
  const nextTrack = S.queue[nextIdx];
  const curT = curTrack();

  initAutoMixEngine();

  // If standbyAudio doesn't have the next track preloaded, load it now
  if (automixS.preloadedPos !== nextPos || !standbyAudio.src) {
    try {
      let url = null;
      if (nextTrack.localPath) {
        url = 'file:///' + nextTrack.localPath.replace(/\\/g, '/');
      } else {
        const r = await call('ytm:stream', { id: nextTrack.id });
        if (r && r.urls && r.urls.length) url = r.urls[0];
      }
      if (!url) {
        playIndex(nextPos);
        return;
      }
      standbyAudio.src = url;
      automixS.preloadedPos = nextPos;
      automixS.preloadedId = nextTrack.id;
    } catch {
      playIndex(nextPos);
      return;
    }
  }

  // Determine mix decision: sequential album vs beat-match vs equal-power crossfade
  const isSequential = !!(curT && nextTrack && curT.album && nextTrack.album &&
    curT.album.toLowerCase() === nextTrack.album.toLowerCase() &&
    curT.albumIndex != null && nextTrack.albumIndex != null &&
    nextTrack.albumIndex === curT.albumIndex + 1);

  let decision = null;
  if (autoMixEngine && !isQuick) {
    decision = autoMixEngine.makeMixDecision(
      curT ? { id: curT.id, title: curT.title, artist: curT.artist, album: curT.album, durationSec: curAudio.duration || 180 } : null,
      { id: nextTrack.id, title: nextTrack.title, artist: nextTrack.artist, album: nextTrack.album, durationSec: nextTrack.duration || 180 },
      automixS.curMeta || null,
      automixS.preloadedMeta || null,
      isSequential
    );
  }

  const duration = isQuick ? 1.5 : (decision ? decision.durationSec : getAutomixDuration(curAudio.duration));

  automixS.mixing = true;
  automixS.startTime = performance.now();
  automixS.duration = duration;
  automixS.progress = 0;
  automixS.swappedMeta = false;
  automixS.quick = isQuick;

  // Apply speed, pitch lock and cue in
  const targetRate = (decision && decision.tempoRatio) ? decision.tempoRatio : (curAudio.playbackRate || 1.0);
  standbyAudio.playbackRate = targetRate;
  standbyAudio.preservesPitch = true;
  standbyAudio.currentTime = (decision && decision.cueInSec) ? decision.cueInSec : 0;
  standbyAudio.volume = 0;

  try {
    await standbyAudio.play();
  } catch (err) {
    console.log('[automix] standby play failed, falling back:', err);
    automixS.mixing = false;
    playIndex(nextPos);
    return;
  }

  // Visual cues: "MIXING" badge on playerbar thumbnail + pulsing glow on automix button
  const badge = $('#np-mixing-badge');
  if (badge) badge.classList.remove('hidden');
  const fsBadge = $('#fs-mixing-badge');
  if (fsBadge) fsBadge.classList.remove('hidden');
  const mixBtn = $('#pb-automix');
  if (mixBtn) mixBtn.classList.add('mixing-glow');
  const fsMixBtn = $('#fs-automix');
  if (fsMixBtn) fsMixBtn.classList.add('mixing-glow');

  if (automixS.raf) cancelAnimationFrame(automixS.raf);

  const mVol = Math.min(1, Math.max(0, settings().volume ?? 0.8));

  function mixStep(now) {
    if (!automixS.mixing) return;
    const elapsed = (now - automixS.startTime) / 1000;
    const p = Math.min(1, Math.max(0, elapsed / automixS.duration));
    automixS.progress = p;

    // Apply DSP transition step (bass swap, equal-power curve, tempo normalization)
    const curDeckId = (curAudio === deckA) ? 'deckA' : 'deckB';
    const standbyDeckId = (standbyAudio === deckA) ? 'deckA' : 'deckB';

    if (autoMixEngine && decision) {
      autoMixEngine.applyTransitionStep(curDeckId, standbyDeckId, p, decision, mVol);
    } else {
      const outCurve = Math.pow(Math.cos(p * (Math.PI * 0.5)), 0.78);
      const inCurve = Math.pow(Math.sin(p * (Math.PI * 0.5)), 1.22);
      const energyBoost = 1.0 + 0.06 * Math.sin(p * Math.PI);
      curAudio.volume = Math.max(0, Math.min(1, mVol * outCurve * energyBoost));
      standbyAudio.volume = Math.max(0, Math.min(1, mVol * inCurve * energyBoost));
    }

    // Cross-dissolve artwork, title, and swap lyrics model at midpoint (t = 0.5)
    if (p >= 0.5 && !automixS.swappedMeta) {
      automixS.swappedMeta = true;
      S.curTrack = nextTrack;
      setNowPlaying(nextTrack);
      renderQueuePanel();

      const npThumb = $('#np-thumb');
      if (npThumb) {
        npThumb.classList.add('mixing-dissolve');
        setTimeout(() => npThumb.classList.remove('mixing-dissolve'), 550);
      }
      const fsThumb = $('#fs-thumb');
      if (fsThumb) {
        fsThumb.classList.add('mixing-dissolve');
        setTimeout(() => fsThumb.classList.remove('mixing-dissolve'), 550);
      }

      // Midpoint lyrics swap: swap active lyrics to nextTrack preloaded lyrics
      if (automixS.preloadedLyrics) {
        S.lyrics = automixS.preloadedLyrics;
        S.lyricsId = nextTrack.id;
        if (S.fsOpen && S.fsTab === 'lyrics') renderFsLyrics(nextTrack);
        if (S.lyricsOpen) renderLyricsContent(nextTrack);
      }
    }

    if (p < 1 && !curAudio.paused && !standbyAudio.paused) {
      automixS.raf = requestAnimationFrame(mixStep);
    } else {
      finishAutoMix(nextPos, nextTrack);
    }
  }

  automixS.raf = requestAnimationFrame(mixStep);
}

function finishAutoMix(nextPos, nextTrack) {
  if (automixS.raf) cancelAnimationFrame(automixS.raf);
  automixS.mixing = false;

  const mVol = Math.min(1, Math.max(0, settings().volume ?? 0.8));

  // Stop and clean the outgoing deck
  try {
    curAudio.pause();
    curAudio.src = '';
    curAudio.volume = 0;
  } catch {}

  // Swap decks: standbyAudio becomes curAudio
  const oldActive = curAudio;
  curAudio = standbyAudio;
  standbyAudio = oldActive;
  audio = curAudio;

  // Ensure incoming deck is at full master volume and neutral DSP
  curAudio.volume = mVol;
  if (autoMixEngine) {
    autoMixEngine.resetDeckDsp();
  }

  // Update playback state
  S.oi = nextPos;
  S.curTrack = nextTrack;
  S.playToken++;
  saveLastQueue();
  recordListening(nextTrack, curAudio.duration || 0);

  // If metadata wasn't swapped yet, swap now
  if (!automixS.swappedMeta) {
    setNowPlaying(nextTrack);
    renderQueuePanel();
  }

  // Hide mixing UI indicators
  const badge = $('#np-mixing-badge');
  if (badge) badge.classList.add('hidden');
  const fsBadge = $('#fs-mixing-badge');
  if (fsBadge) fsBadge.classList.add('hidden');
  const mixBtn = $('#pb-automix');
  if (mixBtn) mixBtn.classList.remove('mixing-glow');
  const fsMixBtn = $('#fs-automix');
  if (fsMixBtn) fsMixBtn.classList.remove('mixing-glow');

  // Re-tap spectrum tap for visualizers on the new active deck
  ensureTap();

  // Reset preload state for the next track
  automixS.curMeta = automixS.preloadedMeta;
  automixS.preloadedPos = -1;
  automixS.preloadedId = null;
  automixS.preloadedMeta = null;
  automixS.preloadedLyrics = null;

  // If nearing the end of the queue, prefetch radio
  if (settings().repeat === 'off' && settings().radio && S.oi >= S.order.length - 1 && radioFailStreak < 3) {
    fetchRadioTracks(nextTrack).catch(() => {});
  }
}

function handleAutomixTimeupdate(ct, d) {
  if (!settings().automix || d <= 10 || S.seeking) return;
  const remain = d - ct;
  if (remain <= 0) return;

  let nextPos = S.oi + 1;
  if (nextPos >= S.order.length) {
    if (settings().repeat === 'all') nextPos = 0;
    else if (settings().radio && radioFailStreak < 3) return;
    else return;
  }

  // 1. Lookahead pre-buffering (20s before track end for zero latency)
  if (remain <= 20 && !automixS.mixing && !automixS.preloading && automixS.preloadedPos !== nextPos) {
    preloadNextTrack(nextPos);
  }

  // 2. Trigger AutoMix transition
  if (!automixS.mixing && remain > 0.4) {
    const targetPos = settings().repeat === 'one' ? S.oi : nextPos;
    const mixDur = getAutomixDuration(d);
    // Smart Outro compensation: account for common trailing silence on longer songs
    const silenceTrim = (d > 120) ? 0.7 : 0.2;
    if (remain <= (mixDur + silenceTrim)) {
      console.log(`[automix] track nearing end (${remain.toFixed(1)}s remain, trim ${silenceTrim}s), starting ${mixDur}s Apple Music transition`);
      startAutoMix(targetPos, false);
    }
  }
}

function setAutomix(on) {
  settings().automix = !!on;
  updateShuffleRepeatBtns();
  saveSettings();
  mutate({ type: 'settings.set', patch: { automix: !!on } });
  const durLabel = (!settings().automixDuration || settings().automixDuration === 'auto') ? 'Auto (Best Mix)' : `${settings().automixDuration}s`;
  toast('AutoMix ' + (settings().automix ? `enabled (Apple Music ${durLabel})` : 'disabled'));
}

async function playIndex(pos) {
  cancelAutoMix();
  S._prewarmedId = null;
  const idx = S.order[pos];
  if (idx == null || !S.queue[idx]) return;
  S.oi = pos;
  const t = S.queue[idx];
  const token = ++S.playToken;
  S.curUrls = null; S.curUrlIdx = 0; S.curTrack = t;

  setNowPlaying(t);
  renderQueuePanel();
  saveLastQueue();

  if (typeof AutoMix !== 'undefined') {
    initAutoMixEngine();
    autoMixAnalyzer.analyze({ id: t.id, title: t.title, artist: t.artist, localPath: t.localPath, durationSec: t.duration || 180 })
      .then(meta => { automixS.curMeta = meta; })
      .catch(() => {});
  }

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
  curAudio.src = S.curUrls[i];
  curAudio.volume = Math.min(1, Math.max(0, settings().volume ?? 0.8));
  curAudio.play().catch(() => { /* error event handles fallback */ });
}

function togglePlay() {
  if (!S.queue.length) return;
  if (!curAudio.src) { playIndex(S.oi < 0 ? 0 : S.oi); return; }
  if (curAudio.paused) {
    curAudio.play().catch(() => {});
    if (automixS.mixing && standbyAudio.src && standbyAudio.paused) {
      standbyAudio.play().catch(() => {});
    }
  } else {
    curAudio.pause();
    if (automixS.mixing && standbyAudio.src && !standbyAudio.paused) {
      standbyAudio.pause();
    }
  }
}

async function next(auto = false) {
  if (!S.order.length) return;
  if (auto && settings().repeat === 'one') {
    if (settings().automix) {
      startAutoMix(S.oi, false);
      return;
    }
    curAudio.currentTime = 0;
    curAudio.play().catch(() => {});
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
        if (settings().automix && !auto && S.playing && curAudio.currentTime > 2) {
          startAutoMix(pos, true);
        } else {
          cancelAutoMix();
          playIndex(pos);
        }
        return;
      } else {
        cancelAutoMix();
        curAudio.pause();
        curAudio.currentTime = curAudio.duration || 0;
        return;
      }
    } else {
      cancelAutoMix();
      curAudio.pause();
      curAudio.currentTime = curAudio.duration || 0;
      return;
    }
  }

  // Smooth Next Track transition when AutoMix is enabled
  if (!auto && settings().automix && S.playing && curAudio.currentTime > 2) {
    startAutoMix(pos, true);
  } else {
    cancelAutoMix();
    playIndex(pos);
  }
}

function prev() {
  cancelAutoMix();
  if (!S.order.length) return;
  if (curAudio.currentTime > 3) { curAudio.currentTime = 0; return; }
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

  const durLabel = (!settings().automixDuration || settings().automixDuration === 'auto')
    ? 'Auto (Best Mix)'
    : `${settings().automixDuration}s`;

  const mixBtn = $('#pb-automix');
  if (mixBtn) {
    const on = !!settings().automix;
    mixBtn.classList.toggle('on', on);
    mixBtn.title = 'AutoMix: ' + (on ? `Apple Music (${durLabel})` : 'Off');
  }
  const qMix = $('#q-automix-toggle');
  if (qMix) {
    const on = !!settings().automix;
    qMix.classList.toggle('on', on);
    const shortLabel = (!settings().automixDuration || settings().automixDuration === 'auto') ? 'Auto' : `${settings().automixDuration}s`;
    qMix.innerHTML = `${icon('automix')} AutoMix <span class="q-automix-dur-tag">${on ? shortLabel : 'Off'}</span>`;
  }

  const fsShuffle = $('#fs-shuffle');
  if (fsShuffle) fsShuffle.classList.toggle('on', !!settings().shuffle);
  const fsRepeat = $('#fs-repeat');
  if (fsRepeat) {
    fsRepeat.classList.toggle('on', r !== 'off');
    fsRepeat.title = 'Repeat: ' + r;
    fsRepeat.innerHTML = icon('repeat') + (r === 'one' ? '<span class="rep1">1</span>' : '');
  }
  const fsMix = $('#fs-automix');
  if (fsMix) {
    const on = !!settings().automix;
    fsMix.classList.toggle('on', on);
    fsMix.title = 'AutoMix: ' + (on ? `Apple Music (${durLabel})` : 'Off');
  }
}

function updatePlayBtn() {
  $('#pb-play').innerHTML = icon(S.playing ? 'pause' : 'play');
  const fsPlay = $('#fs-play');
  if (fsPlay) fsPlay.innerHTML = icon(S.playing ? 'pause' : 'play');
}

function upgradeThumbUrl(url, highRes = true) {
  if (!url || typeof url !== 'string') return '';
  // 1. Google User Content & GGPHT (YouTube Music album art, artist portraits, playlists)
  if (/googleusercontent\.com|ggpht\.com/i.test(url)) {
    if (/=w\d+-h\d+/i.test(url)) {
      return url.replace(/=w\d+-h\d+[^?]*/i, highRes ? '=w1024-h1024-l90-rj' : '=w544-h544-l90-rj');
    }
    if (/=s\d+/i.test(url)) {
      return url.replace(/=s\d+[^?]*/i, highRes ? '=s1024-l90-rj' : '=s544-l90-rj');
    }
    return url;
  }
  // 2. YouTube video thumbnails (i.ytimg.com / img.youtube.com)
  if (/ytimg\.com|youtube\.com\/vi/i.test(url)) {
    const clean = url.split('?')[0];
    if (clean.includes('/default.jpg') || clean.includes('/mqdefault.jpg')) {
      return clean.replace(/\/(?:default|mqdefault)\.jpg$/i, '/hqdefault.jpg');
    }
    return clean;
  }
  return url;
}

function getFullscreenThumbUrl(url) {
  if (!url || typeof url !== 'string') return '';
  // Google User Content (YTM album art): upgrade to maximum 1200x1200
  if (/googleusercontent\.com|ggpht\.com/i.test(url)) {
    if (/=w\d+-h\d+/i.test(url)) return url.replace(/=w\d+-h\d+[^?]*/i, '=w1200-h1200-l90-rj');
    if (/=s\d+/i.test(url)) return url.replace(/=s\d+[^?]*/i, '=s1200-l90-rj');
  }
  // YouTube video thumb: try 1280x720 / 1080p maxresdefault
  if (/ytimg\.com|youtube\.com\/vi/i.test(url)) {
    const clean = url.split('?')[0];
    const match = clean.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
    if (match && match[1]) {
      return `https://i.ytimg.com/vi/${match[1]}/maxresdefault.jpg`;
    }
  }
  return upgradeThumbUrl(url, true);
}

function setNowPlaying(t, restoreOnly = false) {
  if (!t) return;
  if (t.thumb) t.thumb = upgradeThumbUrl(t.thumb, true);

  const isTrackChange = S.lyricsId !== t.id;
  if (isTrackChange) {
    S.lyrics = null;
    S.lyricsId = t.id;
    S.showTranslated = false;
    S._lastLy = -1;
    S._lastFsLy = -1;

    if (typeof SonaraEngine !== 'undefined') {
      SonaraEngine.clear();
      SonaraEngine.statusText = 'Loading lyrics…';
    }

    const cineCur = $('#fs-cine-cur');
    if (cineCur) { cineCur.textContent = 'Loading lyrics…'; cineCur.dataset.t = ''; }
    const cinePrev = $('#fs-cine-prev');
    if (cinePrev) { cinePrev.textContent = ''; cinePrev.dataset.t = ''; }
    const cineNext = $('#fs-cine-next');
    if (cineNext) { cineNext.textContent = ''; cineNext.dataset.t = ''; }

    const prevText = $('#fs-ly-preview-text');
    if (prevText) prevText.textContent = 'Loading lyrics…';

    const moodBadge = $('#fs-cinematic-mood-badge');
    if (moodBadge) moodBadge.classList.add('hidden');

    const lyBody = $('#lyricsBody');
    if (lyBody) lyBody.innerHTML = '<div class="ly-load">Loading lyrics…</div>';

    const fsBody = $('#fs-lyrics-body');
    if (fsBody) fsBody.innerHTML = '<div class="fs-lyrics-empty">Loading lyrics…</div>';
  }

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
  updateFsNowPlaying(t);

  // highlight the row in any visible list
  $$('#content .trow').forEach(row => row.classList.toggle('playing', row.dataset.tid === t.id));
  if ((S.lyricsOpen || S.fsOpen) && !restoreOnly) loadLyrics(t);
  syncPresence();
  syncTaskbarTray();
}

function updateFavBtn() {
  const t = curTrack();
  const liked = t ? isFav(t) : false;
  const btn = $('#pb-fav');
  if (btn) {
    btn.classList.toggle('liked', liked);
    btn.innerHTML = icon('heart', liked ? 'filled' : '');
  }
  const fsFav = $('#fs-fav');
  if (fsFav) {
    fsFav.classList.toggle('liked', liked);
    fsFav.innerHTML = icon('heart', liked ? 'filled' : '');
  }
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
const VIZ_MODES = ['liquid', 'orbit', 'bars', 'wave', 'silk', 'off'];
const vizCanvas = $('#viz');
const vctx = vizCanvas.getContext('2d');
const vizS = {
  mode: 'liquid', raf: 0, sim: false,
  actx: null, analyser: null, freq: null, stream: null,
  zeroFrames: 0, idleFrames: 0, w: 0, h: 0,
  prev: new Float32Array(72), N: 72,
  hue: 258, hueSecondary: 298,
  targetHue: 258, targetHueSecondary: 298,
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
  if (vizS.mode === 'off') {
    vctx.clearRect(0, 0, vizS.w, vizS.h);
  } else {
    vizResize();
    vizStart();
  }
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
  pbVizResize();
  if (S.fsOpen) fsVizResize();
}
window.addEventListener('resize', vizResize);

let pbVizCanvas = null;
let pbVizCtx = null;
let pbVizW = 0, pbVizH = 0;
const pbDroplets = [];

function pbVizResize() {
  if (!pbVizCanvas) pbVizCanvas = $('#pb-liquid-canvas');
  if (!pbVizCanvas) return;
  if (!pbVizCtx) pbVizCtx = pbVizCanvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  pbVizW = pbVizCanvas.clientWidth || window.innerWidth;
  pbVizH = pbVizCanvas.clientHeight || 88;
  pbVizCanvas.width = Math.max(1, Math.round(pbVizW * dpr));
  pbVizCanvas.height = Math.max(1, Math.round(pbVizH * dpr));
  pbVizCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

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
  if (vizS.raf) return;
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
  if (pbVizCtx && pbVizCanvas) {
    pbVizCtx.clearRect(0, 0, pbVizW, pbVizH);
  }
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
  for (let i = 0; i < N; i++) prev[i] += (bands[i] - prev[i]) * (bands[i] > prev[i] ? 0.6 : 0.12);

  let bass = 0;
  for (let i = 0; i < 10; i++) bass += prev[i];
  bass /= 10;
  document.documentElement.style.setProperty('--bass', bass.toFixed(3));

  // Smoothly interpolate visualizer palette towards song theme hues
  if (vizS.targetHue != null) {
    let diff = (vizS.targetHue - vizS.hue) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    vizS.hue = (vizS.hue + diff * 0.05 + 360) % 360;
  }
  if (vizS.targetHueSecondary != null) {
    let diff2 = (vizS.targetHueSecondary - vizS.hueSecondary) % 360;
    if (diff2 > 180) diff2 -= 360;
    if (diff2 < -180) diff2 += 360;
    vizS.hueSecondary = (vizS.hueSecondary + diff2 * 0.05 + 360) % 360;
  }

  if (!playing) { if (++vizS.idleFrames > 90) { vizStop(); return; } }
  else vizS.idleFrames = 0;

  const w = vizS.w, h = vizS.h;
  if (vizS.mode !== 'off') {
    vctx.clearRect(0, 0, w, h);
    if (vizS.mode === 'liquid') drawLiquid(w, h, t, bass);
    else if (vizS.mode === 'orbit') drawOrbit(w, h, t, bass);
    else if (vizS.mode === 'bars') drawBars(w, h);
    else if (vizS.mode === 'wave') drawWave(w, h, t);
    else if (vizS.mode === 'silk') drawSilk(w, h, t, bass);
  } else {
    vctx.clearRect(0, 0, w, h);
  }

  drawPlayerbarLiquid(t, bass, playing);
}

function drawPlayerbarLiquid(t, bass, playing) {
  if (!pbVizCanvas) pbVizCanvas = $('#pb-liquid-canvas');
  if (!pbVizCanvas) return;
  if (!pbVizCtx) pbVizCtx = pbVizCanvas.getContext('2d');

  if (pbVizCanvas.clientWidth !== pbVizW || pbVizCanvas.clientHeight !== pbVizH) {
    pbVizResize();
  }

  const w = pbVizW, h = pbVizH;
  if (w <= 0 || h <= 0) return;

  pbVizCtx.clearRect(0, 0, w, h);

  const N = vizS.N || 72;
  const prev = vizS.prev;
  const h1 = vizS.hue != null ? vizS.hue : ACC_DEFAULT_HUE;
  const h2 = vizS.hueSecondary != null ? vizS.hueSecondary : (h1 + 40);

  // Layer 1: Ambient back wave (secondary hue, slower, wider undulating flow)
  pbVizCtx.beginPath();
  pbVizCtx.moveTo(0, h);
  const steps1 = 32;
  for (let i = 0; i <= steps1; i++) {
    const f = i / steps1;
    const bandIdx = Math.floor(f * N * 0.65);
    const band = playing ? (prev[bandIdx] || 0) : 0;
    const x = f * w;
    const waveSin = Math.sin(t * 1.6 + f * 5.2);
    const y = h * 0.58 - band * h * 0.38 - waveSin * (playing ? 6 * (1 + bass * 0.5) : 3.5);
    pbVizCtx.lineTo(x, y);
  }
  pbVizCtx.lineTo(w, h);
  pbVizCtx.closePath();

  const gradBack = pbVizCtx.createLinearGradient(0, h * 0.25, 0, h);
  gradBack.addColorStop(0, `hsla(${h2}, 85%, 58%, 0.18)`);
  gradBack.addColorStop(0.5, `hsla(${h2}, 75%, 45%, 0.09)`);
  gradBack.addColorStop(1, `hsla(${h1}, 70%, 25%, 0.02)`);
  pbVizCtx.fillStyle = gradBack;
  pbVizCtx.fill();

  // Layer 2: Dynamic front liquid wave (primary hue, sharp reactive crest)
  pbVizCtx.beginPath();
  pbVizCtx.moveTo(0, h);
  const steps2 = 48;
  const pts = [];
  for (let i = 0; i <= steps2; i++) {
    const f = i / steps2;
    const bandIdx = Math.floor(f * N * 0.9);
    const band = playing ? (prev[bandIdx] || 0) : 0;
    const x = f * w;
    const waveSin = Math.sin(t * 2.4 + f * 7.5 + 1.2);
    const waveCos = Math.cos(t * 1.3 - f * 3.8);
    const y = h * 0.66 - band * h * 0.46 - (waveSin * 7 + waveCos * 4) * (playing ? (1 + bass * 0.8) : 0.4);
    pts.push({ x, y, band });
    pbVizCtx.lineTo(x, y);
  }
  pbVizCtx.lineTo(w, h);
  pbVizCtx.closePath();

  const gradFront = pbVizCtx.createLinearGradient(0, h * 0.2, 0, h);
  gradFront.addColorStop(0, `hsla(${h1}, 90%, 65%, 0.28)`);
  gradFront.addColorStop(0.4, `hsla(${h1}, 80%, 50%, 0.14)`);
  gradFront.addColorStop(1, `hsla(${h2}, 75%, 35%, 0.03)`);
  pbVizCtx.fillStyle = gradFront;
  pbVizCtx.fill();

  // Layer 3: Illuminated neon liquid crest with smooth quadratic curve & glow
  if (pts.length > 1) {
    pbVizCtx.beginPath();
    pbVizCtx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const prevPt = pts[i - 1], curPt = pts[i];
      const mx = (prevPt.x + curPt.x) / 2, my = (prevPt.y + curPt.y) / 2;
      pbVizCtx.quadraticCurveTo(prevPt.x, prevPt.y, mx, my);
    }
    pbVizCtx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

    const crestGrad = pbVizCtx.createLinearGradient(0, 0, w, 0);
    crestGrad.addColorStop(0, `hsla(${h1}, 95%, 72%, 0.75)`);
    crestGrad.addColorStop(0.5, `hsla(${h2}, 95%, 76%, 0.9)`);
    crestGrad.addColorStop(1, `hsla(${h1}, 95%, 72%, 0.75)`);

    pbVizCtx.strokeStyle = crestGrad;
    pbVizCtx.lineWidth = 2.0;
    pbVizCtx.shadowColor = `hsla(${h1}, 95%, 68%, 0.8)`;
    pbVizCtx.shadowBlur = playing ? (10 + bass * 12) : 6;
    pbVizCtx.stroke();
    pbVizCtx.shadowBlur = 0;
  }

  // Layer 4: Rising liquid luminous bubbles / droplets on beats
  if (playing && bass > 0.18 && Math.random() < 0.4 && pbDroplets.length < 24) {
    const randPt = pts[Math.floor(Math.random() * (pts.length - 4)) + 2];
    pbDroplets.push({
      x: randPt.x + (Math.random() - 0.5) * 12,
      y: randPt.y - 2,
      vx: (Math.random() - 0.5) * 1.4,
      vy: -(1.5 + Math.random() * 2.5 * (1 + bass)),
      r: 1.5 + Math.random() * 2.5,
      life: 1.0,
      decay: 0.02 + Math.random() * 0.03,
      hue: Math.random() > 0.5 ? h1 : h2
    });
  }

  for (let i = pbDroplets.length - 1; i >= 0; i--) {
    const d = pbDroplets[i];
    d.x += d.vx;
    d.y += d.vy;
    d.life -= d.decay;
    if (d.life <= 0 || d.y < 0) {
      pbDroplets.splice(i, 1);
      continue;
    }
    pbVizCtx.beginPath();
    pbVizCtx.arc(d.x, d.y, d.r * d.life, 0, Math.PI * 2);
    pbVizCtx.fillStyle = `hsla(${d.hue}, 95%, 75%, ${d.life * 0.65})`;
    pbVizCtx.shadowColor = `hsla(${d.hue}, 95%, 70%, ${d.life * 0.8})`;
    pbVizCtx.shadowBlur = 8;
    pbVizCtx.fill();
    pbVizCtx.shadowBlur = 0;
  }
}

const col = (a = 1, light = 62, dh = 0) => `hsla(${(vizS.hue + dh + 360) % 360}, 80%, ${light}%, ${a})`;
const col2 = (a = 1, light = 58, dh = 0) => {
  const h2 = vizS.hueSecondary != null ? vizS.hueSecondary : (vizS.hue + 40);
  return `hsla(${(h2 + dh + 360) % 360}, 78%, ${light}%, ${a})`;
};

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
  g1.addColorStop(0, col2(0.32, 54, 0));
  g1.addColorStop(1, col(0.04, 45, 0));
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
  g2.addColorStop(0, col(0.44, 66, -10));
  g2.addColorStop(0.5, col(0.2, 58, 0));
  g2.addColorStop(1, col2(0.03, 50, 0));
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
  const strokeGrad = vctx.createLinearGradient(0, 0, w, 0);
  strokeGrad.addColorStop(0, col(0.95, 78, 0));
  strokeGrad.addColorStop(0.5, col2(0.95, 74, 0));
  strokeGrad.addColorStop(1, col(0.95, 78, 0));
  vctx.strokeStyle = strokeGrad;
  vctx.lineWidth = 2.4;
  vctx.shadowColor = col(0.8, 68);
  vctx.shadowBlur = 14;
  vctx.stroke();
  vctx.shadowBlur = 0;

  if (bass > 0.22 && Math.random() < 0.45 && vizS.droplets.length < 32) {
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
    dg.addColorStop(1, col2(d.life * 0.4, 55));
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

  const RAY_COUNT = 64;
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
    vctx.strokeStyle = (i % 2 === 0 ? col : col2)(0.7 + band * 0.3, 62 + band * 14, 0);
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
      vctx.fillStyle = (pass === 0 ? col : col2)(0.75, 76, 0);
      vctx.fill();
    }
  }
}

function drawBars(w, h) {
  const N = vizS.N, prev = vizS.prev, caps = vizS.caps;
  const bw = w / N;
  vctx.lineCap = 'round';
  vctx.lineWidth = Math.max(3, bw * 0.68);

  for (let i = 0; i < N; i++) {
    const v = prev[i];
    const bh = Math.max(4, v * (h - 16));
    const x = i * bw + bw / 2;

    const g = vctx.createLinearGradient(0, h, 0, h - bh);
    g.addColorStop(0, col2(0.95, 52, 0));
    g.addColorStop(1, col(0.95, 70, 0));
    vctx.strokeStyle = g;
    vctx.shadowColor = col(0.5, 64);
    vctx.shadowBlur = 10;
    vctx.beginPath();
    vctx.moveTo(x, h - 2);
    vctx.lineTo(x, h - 2 - bh);
    vctx.stroke();

    if (v >= caps[i]) caps[i] = v;
    else caps[i] = Math.max(0, caps[i] - 0.010);
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
    { c: col(0.92, 70), lw: 3, sb: 16, ph: 0 },
    { c: col2(0.72, 64), lw: 1.8, sb: 8, ph: 2.4 },
    { c: col(0.48, 58, 60), lw: 1.4, sb: 4, ph: 4.8 }
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
    { colFn: col, dh: -15, lw: 2.6, yBase: 0.62, speed: 1.4, amp: 0.42 },
    { colFn: col2, dh: 10, lw: 3.2, yBase: 0.52, speed: 2.0, amp: 0.5 },
    { colFn: col, dh: 35, lw: 2.2, yBase: 0.44, speed: 2.7, amp: 0.38 },
    { colFn: col2, dh: -35, lw: 2.0, yBase: 0.70, speed: 1.1, amp: 0.34 }
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
    vctx.strokeStyle = r.colFn(0.85, 68, r.dh);
    vctx.lineWidth = r.lw;
    vctx.shadowColor = r.colFn(0.6, 62, r.dh);
    vctx.shadowBlur = 12;
    vctx.stroke();
  }
  vctx.shadowBlur = 0;
}

// ---------- Full-Screen Now Playing Visualizer Engine ----------
const fsVizS = {
  raf: 0,
  mode: 'bokeh',
  w: 0,
  h: 0,
  particles: [],
  stars: [],
  bubbles: [],
  petals: []
};

function fsVizInit() {
  const c = $('#fsCanvas');
  if (!c) return;
  fsVizResize();
  const w = fsVizS.w || 1200;
  const h = fsVizS.h || 800;

  fsVizS.particles = Array.from({ length: 35 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    baseR: 24 + Math.random() * 60,
    alpha: 0.15 + Math.random() * 0.28,
    vx: (Math.random() - 0.5) * 0.35,
    vy: -0.25 - Math.random() * 0.45,
    phase: Math.random() * Math.PI * 2,
    dh: (Math.random() - 0.5) * 45
  }));

  fsVizS.petals = Array.from({ length: 28 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    size: 10 + Math.random() * 12,
    angle: Math.random() * Math.PI * 2,
    vAngle: (Math.random() - 0.5) * 0.025,
    vx: (Math.random() - 0.5) * 0.4,
    vy: 0.35 + Math.random() * 0.65,
    swayPhase: Math.random() * Math.PI * 2,
    swaySpeed: 0.8 + Math.random() * 1.2,
    alpha: 0.3 + Math.random() * 0.4,
    dh: (Math.random() - 0.5) * 35
  }));

  fsVizS.stars = Array.from({ length: 90 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    size: 1.2 + Math.random() * 2.5,
    baseAlpha: 0.25 + Math.random() * 0.5,
    twinkleSpeed: 1.5 + Math.random() * 3,
    twinklePhase: Math.random() * Math.PI * 2
  }));

  fsVizS.bubbles = Array.from({ length: 36 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    baseR: 12 + Math.random() * 30,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -0.3 - Math.random() * 0.55,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleSpeed: 1.2 + Math.random() * 2,
    alpha: 0.2 + Math.random() * 0.3,
    dh: (Math.random() - 0.5) * 35
  }));
}

function fsVizResize() {
  const c = $('#fsCanvas');
  if (!c) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  fsVizS.w = c.clientWidth || window.innerWidth;
  fsVizS.h = c.clientHeight || window.innerHeight;
  c.width = Math.max(1, Math.round(fsVizS.w * dpr));
  c.height = Math.max(1, Math.round(fsVizS.h * dpr));
  const ctx = c.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function fsVizStart() {
  if (!S.fsOpen || fsVizS.mode === 'off') return;
  vizStart();
  if (fsVizS.raf) return;
  fsVizResize();
  fsVizS.raf = requestAnimationFrame(fsVizFrame);
}

function fsVizStop() {
  if (fsVizS.raf) cancelAnimationFrame(fsVizS.raf);
  fsVizS.raf = 0;
  const c = $('#fsCanvas');
  if (c) {
    const ctx = c.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, fsVizS.w, fsVizS.h);
  }
}

function fsVizFrame(ts) {
  if (!S.fsOpen || fsVizS.mode === 'off') {
    fsVizS.raf = 0;
    return;
  }
  fsVizS.raf = requestAnimationFrame(fsVizFrame);
  const c = $('#fsCanvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;

  if (c.clientWidth !== fsVizS.w || c.clientHeight !== fsVizS.h) {
    fsVizResize();
  }

  const w = fsVizS.w || c.clientWidth;
  const h = fsVizS.h || c.clientHeight;
  const t = ts / 1000;
  const prev = vizS.prev || [];

  // Energy measurements
  let bass = 0;
  for (let i = 0; i < 10 && i < prev.length; i++) bass += prev[i];
  bass = bass / 10;

  let mid = 0;
  for (let i = 15; i < 35 && i < prev.length; i++) mid += prev[i];
  mid = mid / 20;

  let treble = 0;
  for (let i = 40; i < 60 && i < prev.length; i++) treble += prev[i];
  treble = treble / 20;

  ctx.clearRect(0, 0, w, h);
  const hue = (vizS.hue != null ? vizS.hue : 265);
  const hue2 = (vizS.hueSecondary != null ? vizS.hueSecondary : (hue + 42) % 360);

  if (fsVizS.mode === 'bokeh') {
    // 1. Bokeh Orbs
    for (let i = 0; i < fsVizS.particles.length; i++) {
      const p = fsVizS.particles[i];
      p.y += p.vy * (1 + bass * 0.9);
      p.x += p.vx + Math.sin(t + p.phase) * 0.35;
      if (p.y < -p.baseR * 2) { p.y = h + p.baseR; p.x = Math.random() * w; }
      if (p.x < -p.baseR * 2) p.x = w + p.baseR;
      else if (p.x > w + p.baseR * 2) p.x = -p.baseR;

      const curR = p.baseR * (1 + bass * 0.45);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, curR);
      const baseH = (i % 2 === 0 ? hue : hue2);
      const hColor = (baseH + p.dh + 360) % 360;
      g.addColorStop(0, `hsla(${hColor}, 85%, 68%, ${p.alpha * (0.6 + bass * 0.5)})`);
      g.addColorStop(0.6, `hsla(${hColor}, 80%, 55%, ${p.alpha * 0.25})`);
      g.addColorStop(1, `hsla(${hColor}, 80%, 50%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, curR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Sakura / Drift Petals
    for (let i = 0; i < fsVizS.petals.length; i++) {
      const p = fsVizS.petals[i];
      p.y += p.vy * (1 + bass * 0.6);
      p.x += Math.sin(t * p.swaySpeed + p.swayPhase) * (1.2 + mid * 1.5) + p.vx;
      p.angle += p.vAngle * (1 + bass * 0.8);
      if (p.y > h + 30) { p.y = -30; p.x = Math.random() * w; }
      if (p.x < -30) p.x = w + 20;
      else if (p.x > w + 30) p.x = -20;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      const petalBaseH = (i % 2 === 0 ? hue : hue2);
      const petalHColor = (petalBaseH + p.dh + 330) % 360;
      ctx.fillStyle = `hsla(${petalHColor}, 78%, 74%, ${p.alpha * (0.7 + mid * 0.4)})`;
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.bezierCurveTo(p.size * 0.7, -p.size * 0.5, p.size * 0.8, p.size * 0.6, 0, p.size);
      ctx.bezierCurveTo(-p.size * 0.8, p.size * 0.6, -p.size * 0.7, -p.size * 0.5, 0, -p.size);
      ctx.fill();
      ctx.restore();
    }
  } else if (fsVizS.mode === 'stardust') {
    // 1. Aurora waves
    const ribbons = [
      { hBase: hue, dh: -15, alpha: 0.16 + bass * 0.18, yBase: 0.35, speed: 0.9, amp: 55 },
      { hBase: hue2, dh: 20, alpha: 0.14 + mid * 0.15, yBase: 0.50, speed: 1.3, amp: 70 },
      { hBase: hue, dh: 45, alpha: 0.12 + bass * 0.14, yBase: 0.65, speed: 1.8, amp: 45 }
    ];
    for (let r = 0; r < ribbons.length; r++) {
      const rb = ribbons[r];
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 40) {
        const f = x / w;
        const wave = Math.sin(t * rb.speed + f * 5.2 + r * 1.5) * rb.amp * (1 + bass * 0.6);
        const y = h * rb.yBase + wave;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, h * rb.yBase - 80, 0, h);
      const rHue = (rb.hBase + rb.dh + 360) % 360;
      grad.addColorStop(0, `hsla(${rHue}, 85%, 65%, ${rb.alpha})`);
      grad.addColorStop(1, `hsla(${rHue}, 85%, 65%, 0)`);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // 2. Stardust Particles
    for (let i = 0; i < fsVizS.stars.length; i++) {
      const s = fsVizS.stars[i];
      const twinkle = s.baseAlpha * (0.3 + 0.7 * Math.sin(t * s.twinkleSpeed + s.twinklePhase) + treble * 0.5);
      if (twinkle <= 0.05) continue;
      const sR = s.size * (1 + treble * 0.8);
      const starBaseH = (i % 2 === 0 ? hue : hue2);
      ctx.fillStyle = `hsla(${(starBaseH + 30) % 360}, 90%, 85%, ${Math.min(1, twinkle)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, sR, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (fsVizS.mode === 'bubbles') {
    for (let i = 0; i < fsVizS.bubbles.length; i++) {
      const b = fsVizS.bubbles[i];
      b.y += b.vy * (1 + bass * 0.8);
      b.x += b.vx + Math.sin(t * b.wobbleSpeed + b.wobblePhase) * (0.4 + mid * 0.6);
      if (b.y < -b.baseR * 2) { b.y = h + b.baseR; b.x = Math.random() * w; }
      if (b.x < -b.baseR) b.x = w + b.baseR;
      else if (b.x > w + b.baseR) b.x = -b.baseR;

      const r = b.baseR * (1 + bass * 0.35) + Math.sin(t * b.wobbleSpeed + b.wobblePhase) * 2;
      const bBaseH = (i % 2 === 0 ? hue : hue2);
      const bHue = (bBaseH + b.dh + 360) % 360;
      ctx.strokeStyle = `hsla(${bHue}, 75%, 75%, ${b.alpha * (0.6 + bass * 0.4)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `hsla(${bHue}, 75%, 70%, ${b.alpha * 0.15})`;
      ctx.fill();

      // Specular highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(b.x - r * 0.35, b.y - r * 0.35, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (fsVizS.mode === 'waves') {
    const waveLayers = [
      { hBase: hue, dh: -20, speed: 1.2, yBase: 0.72, amp: 38, alpha: 0.22 + bass * 0.15 },
      { hBase: hue2, dh: 10, speed: 1.7, yBase: 0.78, amp: 48, alpha: 0.26 + mid * 0.18 },
      { hBase: hue, dh: 30, speed: 2.3, yBase: 0.84, amp: 32, alpha: 0.32 + bass * 0.2 }
    ];
    for (let r = 0; r < waveLayers.length; r++) {
      const wl = waveLayers[r];
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 30) {
        const f = x / w;
        const wave = Math.sin(t * wl.speed + f * 6.5 + r * 2) * wl.amp * (1 + bass * 0.75);
        ctx.lineTo(x, h * wl.yBase + wave);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const wGrad = ctx.createLinearGradient(0, h * wl.yBase - 50, 0, h);
      const wHue = (wl.hBase + wl.dh + 360) % 360;
      wGrad.addColorStop(0, `hsla(${wHue}, 80%, 62%, ${wl.alpha})`);
      wGrad.addColorStop(1, `hsla(${wHue}, 80%, 55%, 0.05)`);
      ctx.fillStyle = wGrad;
      ctx.fill();
    }
  }
}

// ---------- Full-Screen Overlay View & Controls Logic ----------

function getContextTitle() {
  if (S.view === 'localpl' && S.params.id) {
    const pl = S.store && S.store.playlists && S.store.playlists.find(p => p.id === S.params.id);
    if (pl) return pl.name;
  }
  if (S.view === 'liked') return 'Liked Songs';
  if (S.view === 'album' && S.params.id) return S.params.title || 'Album';
  if (S.view === 'artist' && S.params.id) return S.params.name || 'Artist';
  if (S.view === 'recent') return 'Recently Played';
  if (S.view === 'downloads') return 'Downloads';
  return 'Queue';
}

function updateFsNowPlaying(t) {
  if (!t) return;
  const thumb = $('#fs-thumb');
  if (thumb) {
    const rawThumb = t.thumb || '';
    const fsThumb = getFullscreenThumbUrl(rawThumb);
    thumb.onerror = () => {
      // If 1080p/720p maxresdefault 404s for an older video, smoothly fall back to hqdefault (uncompressed 480x360)
      if (thumb.src && thumb.src.includes('maxresdefault.jpg')) {
        thumb.src = thumb.src.replace('maxresdefault.jpg', 'hqdefault.jpg');
      } else if (thumb.src !== rawThumb) {
        thumb.src = rawThumb;
      }
    };
    thumb.src = fsThumb;
  }
  const title = $('#fs-title');
  if (title) title.textContent = t.title || 'My Music';
  const a = $('#fs-artist');
  if (a) a.textContent = t.artist || '';
  const ctxTitle = $('#fs-context-title');
  if (ctxTitle) ctxTitle.textContent = getContextTitle();
  updateFavBtn();
  updateFsLyricsPreview(t);
  if (S.fsTab === 'lyrics') renderFsLyrics(t);
  if (S.fsTab === 'queue') renderFsQueue();
}

function updateFsLyricsPreview(t) {
  const prevText = $('#fs-ly-preview-text');
  if (!prevText) return;
  if (S.lyrics && S.lyrics.synced && S.lyrics.synced.length) {
    const lines = $$('#fs-lyrics-body .fs-ly-row');
    const onLine = lines.find(l => l.classList.contains('on'));
    if (onLine) prevText.textContent = onLine.textContent;
    else prevText.textContent = S.lyrics.synced[0].text || '…';
  } else if (S.lyrics && S.lyrics.plain) {
    prevText.textContent = S.lyrics.plain.split('\n')[0] || '…';
  } else if (S.lyrics === null) {
    prevText.textContent = 'Loading lyrics…';
  } else {
    prevText.textContent = 'No lyrics for this one yet';
  }
}

const LYRIC_ICONS = {
  heart: '❤️', hearts: '💕', love: '💖', baby: '👶', kiss: '💋', lips: '💋',
  sun: '☀️', sunshine: '☀️', morning: '🌅', day: '☀️', light: '💡', lights: '💡',
  night: '🌙', midnight: '🌙', dark: '🌑', moon: '🌕',
  star: '⭐', stars: '✨', sky: '🌌', space: '🪐',
  rain: '🌧️', rainy: '🌧️', tear: '💧', tears: '💧', cry: '😢', crying: '😭', ocean: '🌊', sea: '🌊',
  fire: '🔥', flame: '🔥', burn: '🔥', burning: '🔥', hot: '🔥', smoke: '💨',
  car: '🚗', drive: '🏎️', driving: '🚘', ride: '🚗', road: '🛣️', fast: '⚡',
  money: '💵', cash: '💰', rich: '💎', diamond: '💎', gold: '🏆', dollar: '💵',
  phone: '📱', call: '📞', calling: '📞', ring: '💍',
  time: '⏳', clock: '⏰', hours: '⌛', forever: '♾️', wait: '⏳',
  eye: '👁️', eyes: '👀', see: '👁️', look: '👀', watch: '👀',
  home: '🏠', house: '🏡', city: '🏙️', town: '🏘️', street: '🛣️',
  music: '🎵', song: '🎶', dance: '💃', dancing: '🕺', sing: '🎤', sound: '🔊',
  alone: '🥀', lonely: '🥀', rose: '🌹', flower: '🌸', dead: '💀', die: '💀', death: '💀',
  dream: '💭', dreaming: '💭', sleep: '💤', wake: '⏰', bed: '🛏️',
  friend: '🤝', friends: '🤝', girl: '👧', boy: '👦', man: '👨',
  mind: '🧠', head: '👤', thought: '💭', thoughts: '💭', soul: '✨',
  run: '🏃', running: '🏃', fly: '🕊️', flying: '✈️', fall: '🍂', falling: '🍂',
  king: '👑', queen: '👑', crown: '👑', angel: '👼', devil: '😈', god: '✨'
};

function formatLyricWords(text) {
  return esc(text).split(/(\s+)/).map(w => {
    if (!w.trim()) return w;
    const clean = w.toLowerCase().replace(/[^a-z]/g, '');
    const icon = LYRIC_ICONS[clean];
    const iconHtml = icon ? `<span class="ly-float-icon">${icon}</span>` : '';
    return `<span class="ly-w ${icon ? 'has-icon' : ''}" data-word="${clean}">${w}${iconHtml}</span>`;
  }).join('');
}

const LYRIC_STYLE_POOL = [
  'cinematic',
  'apple-music',
  'verci-visual',
  'verci-chat',
  'verci-notifications',
  'verci-fisheye',
  'verci-code',
  'verci-constellation'
];

const LYRIC_STYLE_LABELS = {
  'random': 'Auto-Randomize per Song',
  'cinematic': 'Cinematic Story (SONARA)',
  'apple-music': 'Apple Music Kinetic Blur',
  'verci-visual': 'Verci Visual (Animated Emojis)',
  'verci-chat': 'Verci iMessage Conversation',
  'verci-notifications': 'Verci iOS Lock-Screen Notifications',
  'verci-fisheye': 'Verci 3D Fisheye Lens Stack',
  'verci-code': 'Verci Code Terminal & Cursor',
  'verci-constellation': 'Verci Constellation Star Nodes',
  'karaoke': 'Classic Karaoke',
  'minimal': 'Minimalist Clean'
};

function getEffectiveLyricsStyle(t) {
  const pref = (settings().lyricsStyle) || 'random';
  if (pref === 'random') {
    if (!S.trackLyricStyles) S.trackLyricStyles = new Map();
    const trackId = (t && t.id) || (curTrack() && curTrack().id) || 'curr';
    if (!S.trackLyricStyles.has(trackId)) {
      const pool = LYRIC_STYLE_POOL.filter(s => s !== S._lastRandomLyricStyle);
      const chosen = pool[Math.floor(Math.random() * pool.length)] || LYRIC_STYLE_POOL[0];
      S._lastRandomLyricStyle = chosen;
      S.trackLyricStyles.set(trackId, chosen);
      if (S.trackLyricStyles.size > 100) {
        const firstKey = S.trackLyricStyles.keys().next().value;
        S.trackLyricStyles.delete(firstKey);
      }
    }
    return S.trackLyricStyles.get(trackId);
  }
  return pref;
}

function renderFsLyrics(t) {
  t = t || curTrack();
  S._lastFsLy = -1;
  const body = $('#fs-lyrics-body');
  if (!body) return;

  if (!body._scrollBound) {
    body._scrollBound = true;
    body.addEventListener('wheel', () => { body._userScrolling = Date.now(); }, { passive: true });
    body.addEventListener('touchstart', () => { body._userScrolling = Date.now(); }, { passive: true });
  }

  const r = (S.showTranslated && t && S.translatedLyrics.get(t.id)) ? S.translatedLyrics.get(t.id) : S.lyrics;
  const offVal = $('#fs-ly-off-val');
  const curOff = (t && S.store && S.store.lyricsOffsets && S.store.lyricsOffsets[t.id]) || 0;
  if (offVal) offVal.textContent = (curOff > 0 ? '+' : '') + curOff + 'ms';

  const isRandom = (settings().lyricsStyle || 'random') === 'random';
  const curStyle = getEffectiveLyricsStyle(t);
  const styleSel = $('#fs-lyrics-style-select');
  if (styleSel) {
    const randomOpt = styleSel.querySelector('option[value="random"]');
    if (randomOpt) {
      const activeLabel = LYRIC_STYLE_LABELS[curStyle] || curStyle;
      randomOpt.textContent = isRandom ? `🔀 Auto-Randomize (${activeLabel})` : '🔀 Auto-Randomize per Song';
    }
    styleSel.value = isRandom ? 'random' : curStyle;
  }

  const hasLyrics = !!(r && ((r.synced && r.synced.length) || (r.plain && typeof r.plain === 'string' && r.plain.trim().length > 0)));

  // Feed SONARA Engine
  if (typeof SonaraEngine !== 'undefined') {
    if (hasLyrics) {
      SonaraEngine.setLyrics(r, t ? t.id : '');
    } else {
      SonaraEngine.clear();
      SonaraEngine.statusText = r === null ? 'Loading lyrics…' : 'No lyrics found for this track';
    }
    const mood = SonaraEngine.getMood();
    const moodBadge = $('#fs-cinematic-mood-badge');
    if (moodBadge) {
      moodBadge.classList.toggle('hidden', !hasLyrics);
      const moodText = $('#fs-mood-text');
      if (moodText) moodText.textContent = `${mood.icon} ${mood.name}`;
      moodBadge.style.color = mood.accent;
      moodBadge.style.borderColor = mood.accent;
    }
  }

  if (r === null) {
    body.innerHTML = '<div class="fs-lyrics-empty">Loading lyrics…</div>';
    S._fsLines = [];
  } else if (hasLyrics && r.synced && r.synced.length) {
    body.innerHTML = r.synced.map((l, idx) => {
      const words = formatLyricWords(l.text);
      const lineNum = String(idx + 1).padStart(2, '0');
      const isAlt = idx % 2 === 1;
      return `<div class="fs-ly-row ${isAlt ? 'bubble-out' : 'bubble-in'}" data-t="${l.t != null ? l.t : ''}" data-idx="${idx}"><span class="verci-code-prefix"><span class="code-ln">${lineNum}</span> <span class="code-kw">const</span> <span class="code-fn">verse_${lineNum}</span> = </span><span class="ly-text-content">${words}</span><span class="code-cursor">█</span><div class="verci-chat-tail"></div></div>`;
    }).join('');
    S._fsLines = Array.from(body.querySelectorAll('.fs-ly-row')).map(row => ({
      el: row,
      t: parseFloat(row.dataset.t) || 0,
      words: Array.from(row.querySelectorAll('.ly-w')),
      lastLit: -1
    }));
  } else if (hasLyrics && r.plain) {
    body.innerHTML = `<div class="fs-lyrics-plain" style="font-size:22px;line-height:1.8;white-space:pre-wrap;color:rgba(255,255,255,0.85);">${esc(r.plain)}</div>`;
    S._fsLines = [];
  } else {
    body.innerHTML = '<div class="fs-lyrics-empty">No lyrics found for this track</div>';
    S._fsLines = [];
  }

  // Seeking on lyric click
  (S._fsLines || []).forEach(item => {
    item.el.addEventListener('click', () => {
      if (!isNaN(item.t)) {
        curAudio.currentTime = Math.max(0, item.t - (curOff / 1000));
        syncPresence();
        highlightLyric(curAudio.currentTime);
      }
    });
  });

  const cineStage = $('#fs-cinematic-stage');
  if (curStyle === 'cinematic') {
    cineStage?.classList.remove('hidden');
    body.classList.add('hidden');
    fsVizStop();
    if (typeof SonaraEngine !== 'undefined') {
      const c = $('#fs-cinematic-canvas');
      if (c && (!SonaraEngine.canvas || SonaraEngine.canvas !== c)) {
        SonaraEngine.init(c);
        ensureTap();
        if (vizS.analyser) SonaraEngine.setAudioSource(vizS.analyser);
      }
      SonaraEngine.resize();
      SonaraEngine.start();
    }
  } else {
    cineStage?.classList.add('hidden');
    body.classList.remove('hidden');
    if (typeof SonaraEngine !== 'undefined') SonaraEngine.stop();
    body.className = `fs-lyrics-scroll-body lyrics-style-${curStyle}`;
    if (S.fsOpen && fsVizS.mode !== 'off') {
      fsVizStart();
    }
  }

  highlightLyric(audio.currentTime);
}

function renderFsQueue() {
  const body = $('#fs-queue-body');
  if (!body) return;
  const cur = curTrack();
  const upcoming = S.order.slice(S.oi + 1).map((orderIdx, offset) => ({
    track: S.queue[orderIdx],
    index: offset
  })).filter(x => x.track);

  let html = '';
  if (cur) {
    html += `
      <div style="font-size:11px;font-weight:700;color:var(--accent);letter-spacing:1px;margin-bottom:8px;text-transform:uppercase;">Now Playing</div>
      <div class="fs-queue-row playing" data-action="fs-q-jump" data-idx="-1">
        <img class="fs-queue-thumb" src="${esc(cur.thumb || '')}" alt="" loading="lazy" decoding="async">
        <div class="fs-queue-meta">
          <div class="fs-queue-title">${esc(cur.title)}</div>
          <div class="fs-queue-artist">${esc(cur.artist || 'Unknown')}</div>
        </div>
        <div class="fs-queue-dur">${fmtDur(cur.duration)}</div>
      </div>
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:1px;margin:20px 0 8px;text-transform:uppercase;">Next Up (${upcoming.length})</div>
    `;
  }
  if (upcoming.length) {
    html += upcoming.map(item => `
      <div class="fs-queue-row" data-action="fs-q-jump" data-idx="${item.index}">
        <img class="fs-queue-thumb" src="${esc(item.track.thumb || '')}" alt="" loading="lazy" decoding="async">
        <div class="fs-queue-meta">
          <div class="fs-queue-title">${esc(item.track.title)}</div>
          <div class="fs-queue-artist">${esc(item.track.artist || 'Unknown')}</div>
        </div>
        <div class="fs-queue-dur">${fmtDur(item.track.duration)}</div>
      </div>
    `).join('');
  } else {
    html += '<div class="fs-lyrics-empty" style="padding-top:40px;">No more tracks in queue</div>';
  }
  body.innerHTML = html;
}

function shuffleRemaining() {
  if (S.oi >= S.order.length - 1) return;
  const cur = S.order.slice(0, S.oi + 1);
  const remaining = S.order.slice(S.oi + 1);
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  S.order = cur.concat(remaining);
  renderQueuePanel();
}

function openNowPlayingOverlay() {
  const overlay = $('#nowPlayingOverlay');
  if (!overlay) return;
  S.fsOpen = true;
  overlay.classList.remove('hidden');
  overlay.classList.add('fs-entering');
  setTimeout(() => overlay.classList.remove('fs-entering'), 400);

  const t = curTrack();
  if (t) {
    if (S.lyricsId !== t.id) {
      S.lyrics = null;
      S.lyricsId = t.id;
      if (typeof SonaraEngine !== 'undefined') SonaraEngine.clear();
    }
    updateFsNowPlaying(t);
    if (!S.lyrics || S.lyricsId !== t.id) {
      loadLyrics(t);
    }
  }

  fsVizResize();
  fsVizStart();
  checkLyricsLoop();
}

function closeNowPlayingOverlay() {
  const overlay = $('#nowPlayingOverlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  S.fsOpen = false;
  checkLyricsLoop();
  overlay.classList.add('fs-leaving');
  setTimeout(() => {
    overlay.classList.remove('fs-leaving');
    overlay.classList.add('hidden');
    fsVizStop();
    if (typeof SonaraEngine !== 'undefined') SonaraEngine.stop();
  }, 280);
}

function switchFsTab(tabName) {
  S.fsTab = tabName;
  $$('.fs-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  $$('.fs-tab-view').forEach(v => v.classList.toggle('active', v.id === `fs-view-${tabName}`));
  const t = curTrack();
  if (tabName === 'lyrics') {
    renderFsLyrics(t);
  } else {
    if (typeof SonaraEngine !== 'undefined') SonaraEngine.stop();
    if (fsVizS.mode !== 'off') {
      fsVizStart();
    }
  }
  if (tabName === 'queue') renderFsQueue();
  checkLyricsLoop();
}

function bindNowPlayingOverlayEvents() {
  $('#fs-collapse')?.addEventListener('click', closeNowPlayingOverlay);

  // Tab switching
  $$('.fs-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchFsTab(btn.dataset.tab);
    });
  });

  // Lyrics card click switches to lyrics tab
  $('#fs-lyrics-card')?.addEventListener('click', () => {
    switchFsTab('lyrics');
  });

  // Lyrics style selector
  $('#fs-lyrics-style-select')?.addEventListener('change', (e) => {
    setLyricsStyle(e.target.value);
  });

  // Subtitle seeking in cinematic mode
  $('#fs-cinematic-subtitles')?.addEventListener('click', (e) => {
    const sub = e.target.closest('.cine-sub-line');
    if (!sub || !sub.dataset.t) return;
    const ts = parseFloat(sub.dataset.t);
    const tTrack = curTrack();
    const curOff = (tTrack && S.store && S.store.lyricsOffsets && S.store.lyricsOffsets[tTrack.id]) || 0;
    if (!isNaN(ts)) {
      audio.currentTime = Math.max(0, ts - (curOff / 1000));
      syncPresence();
      highlightLyric(audio.currentTime);
    }
  });

  // Visualizer select
  const vizSel = $('#fs-viz-select');
  if (vizSel) {
    vizSel.value = settings().fsViz || 'bokeh';
    fsVizS.mode = vizSel.value;
    vizSel.addEventListener('change', (e) => {
      fsVizS.mode = e.target.value;
      mutate({ type: 'settings.set', patch: { fsViz: fsVizS.mode } });
      if (fsVizS.mode !== 'off') {
        fsVizResize();
        fsVizStart();
      } else {
        fsVizStop();
      }
      toast('Visualizer: ' + vizSel.options[vizSel.selectedIndex].text);
    });
  }

  // Fullscreen button
  $('#fs-fullscreen-btn')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const fsBtn = $('#fs-fullscreen-btn');
    if (fsBtn) fsBtn.innerHTML = icon(document.fullscreenElement ? 'contract' : 'expand');
  });

  // Transport controls
  $('#fs-play')?.addEventListener('click', () => togglePlay());
  $('#fs-prev')?.addEventListener('click', () => prev());
  $('#fs-next')?.addEventListener('click', () => next());
  $('#fs-shuffle')?.addEventListener('click', () => setShuffle(!settings().shuffle));
  $('#fs-repeat')?.addEventListener('click', () => {
    const next = { off: 'all', all: 'one', one: 'off' }[settings().repeat] || 'off';
    setRepeat(next);
  });
  $('#fs-fav')?.addEventListener('click', () => {
    const t = curTrack();
    if (t) toggleFav(t);
  });
  $('#fs-automix')?.addEventListener('click', () => setAutomix(!settings().automix));

  // Volume
  $('#fs-vol-btn')?.addEventListener('click', () => {
    if (audio.volume > 0) { S.lastVol = audio.volume; setVolume(0); }
    else setVolume(S.lastVol || 0.8);
  });
  $('#fs-vol')?.addEventListener('input', (e) => setVolume(parseFloat(e.target.value)));

  // Seek
  const fsSeek = $('#fs-seek');
  if (fsSeek) {
    fsSeek.addEventListener('input', (e) => {
      S.fsSeeking = true;
      const pct = parseFloat(e.target.value);
      fsSeek.style.setProperty('--fill', pct + '%');
      $('#fs-t-cur').textContent = fmtDur((pct / 100) * (audio.duration || 0));
    });
    fsSeek.addEventListener('change', (e) => {
      audio.currentTime = (parseFloat(e.target.value) / 100) * (audio.duration || 0);
      S.fsSeeking = false;
      syncPresence();
    });
  }

  // Lyrics Offset controls
  $$('#fs-lyrics-offset-bar .fs-off-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = curTrack();
      if (!t) return;
      const dir = parseInt(btn.dataset.dir, 10);
      adjustLyricsOffset(t, dir * 500);
      renderFsLyrics(t);
    });
  });
  $('#fs-ly-off-reset')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const t = curTrack();
    if (!t) return;
    resetLyricsOffset(t);
    renderFsLyrics(t);
  });

  // Lyrics translate
  $('#fs-lyrics-trans-btn')?.addEventListener('click', async () => {
    const t = curTrack();
    if (t) {
      await toggleTranslateLyrics(t);
      renderFsLyrics(t);
    }
  });

  // Queue row click
  $('#fs-queue-body')?.addEventListener('click', (e) => {
    const row = e.target.closest('.fs-queue-row');
    if (!row) return;
    const idx = parseInt(row.dataset.idx, 10);
    if (!isNaN(idx)) jumpQueue(idx);
  });
  $('#fs-q-shuffle')?.addEventListener('click', () => {
    shuffleRemaining();
    renderFsQueue();
    toast('Queue shuffled');
  });
}

// ---------- album-art accent ----------
function extractHueFromPixels(data) {
  const bins = new Array(24).fill(0);
  let satWeight = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    const sat = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1) || 1);
    // catch dark-but-colorful and vibrant pixels
    if (sat < 0.16 || l < 0.04 || l > 0.95) continue;
    let hh;
    if (mx === r) hh = ((g - b) / (mx - mn)) * 60;
    else if (mx === g) hh = 120 + ((b - r) / (mx - mn)) * 60;
    else hh = 240 + ((r - g) / (mx - mn)) * 60;
    if (hh < 0) hh += 360;
    bins[Math.min(23, Math.floor(hh / 15))] += sat * sat * sat;
    satWeight += sat;
    count++;
  }
  let bi = -1, bv = 0;
  bins.forEach((v, i) => { if (v > bv) { bv = v; bi = i; } });
  if (bi < 0 || satWeight <= 0) return null;
  const primaryHue = Math.round(bi * 15 + 7.5);

  let bi2 = -1, bv2 = 0;
  bins.forEach((v, i) => {
    const dist = Math.min(Math.abs(i - bi), 24 - Math.abs(i - bi));
    if (dist >= 2 && v > bv2) {
      bv2 = v;
      bi2 = i;
    }
  });

  const secondaryHue = (bi2 >= 0 && bv2 >= bv * 0.06)
    ? Math.round(bi2 * 15 + 7.5)
    : Math.round((primaryHue + 38) % 360);

  const avgSat = count > 0 ? (satWeight / count) : 0.75;

  return {
    hue: primaryHue,
    hueSecondary: secondaryHue,
    sat: avgSat
  };
}

async function extractPaletteFromUrl(url) {
  // Method 1: fetch + createImageBitmap (bypasses DOM CORS taint, fastest & cleanest in Electron)
  try {
    const resp = await fetch(url);
    if (resp.ok) {
      const blob = await resp.blob();
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      const ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0, 32, 32);
      if (typeof bmp.close === 'function') bmp.close();
      const d = ctx.getImageData(0, 0, 32, 32).data;
      const pal = extractHueFromPixels(d);
      if (pal) return pal;
    }
  } catch {}

  // Method 2: Image element with crossOrigin anonymous fallback
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 32; c.height = 32;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0, 32, 32);
        const d = x.getImageData(0, 0, 32, 32).data;
        resolve(extractHueFromPixels(d));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function applyAccent(thumb) {
  if (settings().ambientColors === false) {
    const fixedHue = settings().accentHue !== 'auto' && settings().accentHue != null
      ? settings().accentHue : ACC_DEFAULT_HUE;
    setHue(fixedHue === 'auto' ? ACC_DEFAULT_HUE : fixedHue);
    return;
  }
  // When ambientColors is on (default), we ALWAYS extract palette from the playing track's artwork
  if (!thumb) {
    curAccThumb = null;
    const fallbackHue = settings().accentHue !== 'auto' && settings().accentHue != null
      ? settings().accentHue : ACC_DEFAULT_HUE;
    setHue(fallbackHue);
    return;
  }
  curAccThumb = thumb;
  if (accCache.has(thumb)) {
    const cached = accCache.get(thumb);
    setHue(cached ?? ACC_DEFAULT_HUE);
    return;
  }

  (async () => {
    const captured = thumb;
    let palette = await extractPaletteFromUrl(thumb);
    if (!palette && captured === curAccThumb) {
      const bust = thumb + (thumb.includes('?') ? '&' : '?') + '_cb=' + Date.now();
      palette = await extractPaletteFromUrl(bust);
    }
    accCache.set(thumb, palette);
    if (curAccThumb === captured) {
      setHue(palette ?? ACC_DEFAULT_HUE);
    }
  })();
}

function setHue(input, secHue) {
  let h, h2;
  if (typeof input === 'object' && input !== null) {
    h = input.hue;
    h2 = input.hueSecondary;
  } else {
    h = input;
    h2 = secHue;
  }
  if (h == null) h = ACC_DEFAULT_HUE;
  if (h2 == null) h2 = (h + 38) % 360;

  vizS.targetHue = h;
  vizS.targetHueSecondary = h2;
  if (!vizS.raf) {
    vizS.hue = h;
    vizS.hueSecondary = h2;
  }

  const s = document.documentElement.style;
  const isAmbient = settings().ambientColors !== false;

  s.setProperty('--hue', h);
  s.setProperty('--accent-hue', h);
  s.setProperty('--hue-2', h2);
  s.setProperty('--accent', `hsl(${h}, 78%, 62%)`);
  s.setProperty('--accent-2', `hsl(${h2}, 72%, 52%)`);
  s.setProperty('--accent-3', `hsl(${(h + 120) % 360}, 80%, 58%)`);
  s.setProperty('--playing', `hsl(${h}, 85%, 72%)`);
  s.setProperty('--accent-soft', `hsla(${h}, 85%, 60%, 0.28)`);
  s.setProperty('--accent-glow', `hsla(${h}, 90%, 62%, 0.52)`);
  s.setProperty('--glass-brd', `hsla(${h}, 50%, 80%, 0.12)`);
  s.setProperty('--glass-brd-hover', `hsla(${h}, 60%, 85%, 0.24)`);

  if (isAmbient) {
    // Dynamic background and surface theming derived from song cover art
    s.setProperty('--bg', `hsl(${h}, 30%, 5.5%)`);
    s.setProperty('--bg2', `hsl(${h}, 22%, 8.5%)`);
    s.setProperty('--bg3', `hsla(${h}, 30%, 85%, 0.08)`);
    s.setProperty('--panel', `hsla(${h}, 20%, 11%, 0.72)`);
    s.setProperty('--panel-card', `hsla(${h}, 22%, 10%, 0.54)`);
    s.setProperty('--panel-opaque', `hsla(${h}, 24%, 8%, 0.72)`);
    s.setProperty('--sidebar-bg', `hsla(${h}, 25%, 7%, 0.68)`);
    s.setProperty('--playerbar-bg', `hsla(${h}, 28%, 7%, 0.72)`);
    s.setProperty('--ambient-wash', `hsla(${h}, 70%, 25%, 0.35)`);
    s.setProperty('--ambient-wash-2', `hsla(${h2}, 65%, 20%, 0.25)`);
  } else {
    // Reset to neutral dark theme when ambient is off
    s.setProperty('--bg', '#07090e');
    s.setProperty('--bg2', '#0d1017');
    s.setProperty('--bg3', 'rgba(255, 255, 255, 0.075)');
    s.setProperty('--panel', 'rgba(14, 18, 28, 0.65)');
    s.setProperty('--panel-card', 'rgba(14, 18, 28, 0.52)');
    s.setProperty('--panel-opaque', 'rgba(11, 14, 22, 0.68)');
    s.setProperty('--sidebar-bg', 'rgba(11, 14, 22, 0.62)');
    s.setProperty('--playerbar-bg', 'rgba(10, 13, 20, 0.65)');
    s.removeProperty('--ambient-wash');
    s.removeProperty('--ambient-wash-2');
  }
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
function bindDeckEvents(deckEl) {
  deckEl.addEventListener('play', () => {
    if (deckEl !== curAudio && !automixS.mixing) return;
    S.playing = true;
    updatePlayBtn();
    ensureTap();
    ensureDspGraph();
    applySpeedAndPitch();
    vizStart();
    if (S.fsOpen && fsVizS.mode !== 'off') {
      const curStyle = getEffectiveLyricsStyle(curTrack());
      if (S.fsTab !== 'lyrics' || curStyle !== 'cinematic') {
        fsVizStart();
      }
    }
    syncPresence();
    syncTaskbarTray();
    checkLyricsLoop();
    const t = curTrack();
    if (t && !S.recorded.has(t.id)) {
      S.recorded.add(t.id);
      if (S.recorded.size > 300) S.recorded = new Set([...S.recorded].slice(-100));
      mutate({ type: 'recent.add', track: t }).then(() => { if (S.view === 'recent' || S.view === 'home') rerenderKeepScroll(); });
    }
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  });

  deckEl.addEventListener('pause', () => {
    if (deckEl !== curAudio && !automixS.mixing) return;
    if (curAudio.paused && (!automixS.mixing || standbyAudio.paused)) {
      S.playing = false;
      updatePlayBtn();
      syncPresence();
      syncTaskbarTray();
      checkLyricsLoop();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    }
  });

  deckEl.addEventListener('ended', () => {
    if (deckEl !== curAudio) return;
    checkLyricsLoop();
    const t = curTrack();
    if (t) recordListening(t, deckEl.duration || deckEl.currentTime);
    syncPresence();
    syncTaskbarTray();
    if (automixS.mixing) return;
    next(true);
  });

  deckEl.addEventListener('loadedmetadata', () => {
    if (deckEl === curAudio) {
      $('#t-total').textContent = fmtDur(deckEl.duration);
      syncPresence();
    }
  });

  deckEl.addEventListener('error', () => {
    if (deckEl !== curAudio) return;
    if (S.curUrls && S.curUrlIdx + 1 < S.curUrls.length) { startUrl(S.curUrlIdx + 1); return; }
    S.playing = false;
    updatePlayBtn();
    syncPresence();
    checkLyricsLoop();
    const token = S.playToken;
    const t = curTrack();
    if (t && S.order.length > 1 && ++S.errStreak <= 3) {
      toast('Could not play "' + t.title + '" — skipping');
      setTimeout(() => { if (token === S.playToken) next(true); }, 400);
    }
  });

  deckEl.addEventListener('playing', () => {
    if (deckEl === curAudio) {
      S.errStreak = 0;
      checkLyricsLoop();
    }
  });

  deckEl.addEventListener('seeked', () => {
    if (deckEl === curAudio) {
      highlightLyric(curAudio.currentTime);
      checkLyricsLoop();
    }
  });

  deckEl.addEventListener('timeupdate', () => {
    if (deckEl !== curAudio) return;
    if (S.seeking) return;
    const d = deckEl.duration || 0;
    const ct = deckEl.currentTime || 0;
    const pct = d ? (ct / d) * 100 : 0;
    const seek = $('#seek');
    if (seek) {
      seek.value = pct;
      seek.style.setProperty('--fill', pct + '%');
    }
    const tCur = $('#t-cur');
    if (tCur) tCur.textContent = fmtDur(ct);
    if (S.lyricsOpen || S.fsOpen) highlightLyric(ct);
    if (S.fsOpen && !S.fsSeeking) {
      const fsSeek = $('#fs-seek');
      if (fsSeek) {
        fsSeek.value = pct;
        fsSeek.style.setProperty('--fill', pct + '%');
      }
      const fsCur = $('#fs-t-cur');
      if (fsCur) fsCur.textContent = fmtDur(ct);
      const fsTot = $('#fs-t-total');
      if (fsTot) fsTot.textContent = fmtDur(d);
    }
    if (ct >= 30) {
      const t = curTrack();
      if (t) recordListening(t, ct);
    }
    const now = Date.now();
    if (now - lastQueueSave > 10000 && deckEl.src) { lastQueueSave = now; saveLastQueue(); }
    if (now - lastPresenceSave > 15000 && deckEl.src) { lastPresenceSave = now; syncPresence(); }

    // Pre-warm next track audio stream when within 30s of track completion
    if (d && (d - ct) <= 30 && S.order && S.oi < S.order.length - 1) {
      const nextIdx = S.order[S.oi + 1];
      const nextTrack = S.queue[nextIdx];
      if (nextTrack && nextTrack.id && !nextTrack.localPath && S._prewarmedId !== nextTrack.id) {
        S._prewarmedId = nextTrack.id;
        call('ytm:stream', { id: nextTrack.id }).catch(() => {});
      }
    }

    handleAutomixTimeupdate(ct, d);
  });
}

bindDeckEvents(deckA);
bindDeckEvents(deckB);

// Throttle visualizers and animations when window is minimized or hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (vizS.raf) { cancelAnimationFrame(vizS.raf); vizS.raf = 0; vizS._wasRunning = true; }
    if (fsVizS.raf) { cancelAnimationFrame(fsVizS.raf); fsVizS.raf = 0; fsVizS._wasRunning = true; }
    if (typeof SonaraEngine !== 'undefined' && SonaraEngine.running) {
      SonaraEngine.stop();
      SonaraEngine._wasRunning = true;
    }
  } else {
    if (vizS._wasRunning) { vizS._wasRunning = false; vizStart(); }
    if (fsVizS._wasRunning && S.fsOpen && fsVizS.mode !== 'off') {
      const curStyle = getEffectiveLyricsStyle(curTrack());
      if (S.fsTab !== 'lyrics' || curStyle !== 'cinematic') {
        fsVizS._wasRunning = false;
        fsVizStart();
      }
    }
    if (typeof SonaraEngine !== 'undefined' && SonaraEngine._wasRunning && S.fsOpen && S.fsTab === 'lyrics' && getEffectiveLyricsStyle(curTrack()) === 'cinematic') {
      SonaraEngine._wasRunning = false;
      SonaraEngine.start();
    }
  }
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
    <img src="${esc(t.thumb)}" alt="" loading="lazy" decoding="async">
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
  checkLyricsLoop();
}

function renderLyricsHeader(t) {
  const head = $('#lyricsPanel .panel-head');
  if (!head) return;
  const hasLyrics = S.lyrics && (S.lyrics.synced?.length || S.lyrics.plain);
  const mood = (typeof SonaraEngine !== 'undefined') ? SonaraEngine.getMood() : null;
  const moodHtml = (mood && hasLyrics) ? `<span class="ly-mood-badge" style="color:${mood.accent};border-color:${mood.accent};">${mood.icon} ${mood.name}</span>` : '';
  head.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <div class="ly-head-title">Lyrics</div>
      ${moodHtml}
    </div>
    <div class="ly-head-actions">
      ${hasLyrics ? `<button id="btnTransLyrics" class="ghostbtn ly-trans-btn" title="Translate lyrics to English">${icon('translate')} <span>${S.showTranslated ? 'Original' : 'Translate'}</span></button>` : ''}
      <button class="iconbtn" data-action="panel-close" data-panel="lyricsPanel">${icon('close')}</button>
    </div>`;
  $('#btnTransLyrics')?.addEventListener('click', () => toggleTranslateLyrics(t));
}

function renderLyricsContent(t) {
  S._lastLy = -1;
  const el = $('#lyricsBody');
  if (!el) return;
  if (!el._scrollBound) {
    el._scrollBound = true;
    el.addEventListener('wheel', () => { el._userScrolling = Date.now(); }, { passive: true });
    el.addEventListener('touchstart', () => { el._userScrolling = Date.now(); }, { passive: true });
  }
  const r = (S.showTranslated && S.translatedLyrics.get(t.id)) ? S.translatedLyrics.get(t.id) : S.lyrics;
  const curStyle = getEffectiveLyricsStyle(t);
  el.className = 'panel-body lyrics-style-' + curStyle;

  if (typeof SonaraEngine !== 'undefined' && r) {
    SonaraEngine.setLyrics(r, t ? t.id : '');
  }

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
    el.innerHTML = offsetBarHtml + r.synced.map((l, idx) => {
      const words = formatLyricWords(l.text);
      const lineNum = String(idx + 1).padStart(2, '0');
      const isAlt = idx % 2 === 1;
      return `<div class="ly-line ${isAlt ? 'bubble-out' : 'bubble-in'}" data-t="${l.t != null ? l.t : ''}" data-idx="${idx}"><span class="verci-code-prefix"><span class="code-ln">${lineNum}</span> </span><span class="ly-text-content">${words}</span><span class="code-cursor">█</span><div class="verci-chat-tail"></div></div>`;
    }).join('');
    S._spLines = Array.from(el.querySelectorAll('.ly-line')).map(row => ({
      el: row,
      t: parseFloat(row.dataset.t) || 0,
      words: Array.from(row.querySelectorAll('.ly-w')),
      lastLit: -1
    }));
  } else if (r.plain) {
    el.innerHTML = `<div class="ly-plain">${esc(r.plain)}</div>`;
    S._spLines = [];
  } else {
    el.innerHTML = '<div class="ly-load">No lyrics found for this track.</div>';
    S._spLines = [];
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
  if (el) el.innerHTML = '<div class="ly-load">Loading lyrics…</div>';
  try {
    const r = await call('ytm:lyrics', { track: t });
    if (S.lyricsId !== t.id) return;
    S.lyrics = r;
    renderLyricsHeader(t);
    renderLyricsContent(t);
    updateFsLyricsPreview(t);
    if (S.fsTab === 'lyrics') renderFsLyrics(t);
  } catch {
    if (S.lyricsId === t.id) {
      S.lyrics = { synced: null, plain: null };
      if (typeof SonaraEngine !== 'undefined') {
        SonaraEngine.clear();
        SonaraEngine.statusText = 'Lyrics unavailable';
      }
      renderLyricsHeader(t);
      if (el) el.innerHTML = '<div class="ly-load">Lyrics unavailable.</div>';
      updateFsLyricsPreview(t);
      if (S.fsTab === 'lyrics') renderFsLyrics(t);
    }
  }
}

function smoothScrollToCenter(container, targetEl, duration = 420) {
  if (!container || !targetEl) return;
  if (container._userScrolling && Date.now() - container._userScrolling < 2000) return;

  const cRect = container.getBoundingClientRect();
  const tRect = targetEl.getBoundingClientRect();
  const targetTop = container.scrollTop + (tRect.top - cRect.top) - (cRect.height / 2) + (tRect.height / 2);
  const startTop = container.scrollTop;
  const distance = targetTop - startTop;
  if (Math.abs(distance) < 2) return;

  if (container._scrollRaf) cancelAnimationFrame(container._scrollRaf);
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const p = Math.min(elapsed / duration, 1);
    // Smooth easeInOutSine for natural, fluid acceleration and deceleration
    const ease = 0.5 * (1 - Math.cos(Math.PI * p));
    container.scrollTop = startTop + (distance * ease);
    if (p < 1) {
      container._scrollRaf = requestAnimationFrame(step);
    } else {
      container._scrollRaf = null;
    }
  }
  container._scrollRaf = requestAnimationFrame(step);
}

let lyricsRafId = null;
function checkLyricsLoop() {
  const shouldRun = (S.lyricsOpen || S.fsOpen) && S.playing && curAudio && !curAudio.paused;
  if (shouldRun && !lyricsRafId) {
    function tick() {
      if ((S.lyricsOpen || S.fsOpen) && S.playing && curAudio && !curAudio.paused) {
        highlightLyric(curAudio.currentTime);
        lyricsRafId = requestAnimationFrame(tick);
      } else {
        lyricsRafId = null;
      }
    }
    lyricsRafId = requestAnimationFrame(tick);
  } else if (!shouldRun && lyricsRafId) {
    cancelAnimationFrame(lyricsRafId);
    lyricsRafId = null;
  }
}

function findActiveLyricIndex(cachedLines, adjustedTime) {
  if (!cachedLines || !cachedLines.length) return -1;
  let low = 0, high = cachedLines.length - 1, best = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cachedLines[mid].t <= adjustedTime) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

function updateWordHighlight(cachedLine, adjustedTime, nextTime) {
  if (!cachedLine || !cachedLine.words || !cachedLine.words.length) return;
  const words = cachedLine.words;
  const startT = cachedLine.t;
  const dur = Math.max(0.6, (nextTime != null && !isNaN(nextTime) ? nextTime : (startT + 3.2)) - startT);
  const elapsed = Math.max(0, adjustedTime - startT);
  const pct = Math.min(1, elapsed / dur);
  const count = words.length;
  const litIdx = Math.floor(pct * count);
  if (cachedLine.lastLit === litIdx) return;
  cachedLine.lastLit = litIdx;
  for (let i = 0; i < count; i++) {
    words[i].classList.toggle('lit', i <= litIdx);
  }
}

function highlightLyric(time) {
  const tTrack = curTrack();
  const offsetMs = (tTrack && S.store && S.store.lyricsOffsets && S.store.lyricsOffsets[tTrack.id]) || 0;
  const currentT = time != null ? time : (curAudio ? curAudio.currentTime : 0);
  const adjustedTime = currentT + (offsetMs / 1000);

  // Sync SONARA AI Engine
  if (typeof SonaraEngine !== 'undefined') {
    SonaraEngine.syncTime(adjustedTime);

    // Update subtitles in cinematic stage
    const cineCur = $('#fs-cine-cur');
    if (cineCur) {
      const cinePrev = $('#fs-cine-prev');
      const cineNext = $('#fs-cine-next');
      const lines = SonaraEngine.lineAnalysis;
      const idx = SonaraEngine.activeLineIdx;

      if (lines && lines.length && idx >= 0 && lines[idx]) {
        if (cinePrev) {
          cinePrev.textContent = idx > 0 ? (lines[idx - 1].raw || '') : '';
          cinePrev.dataset.t = idx > 0 ? lines[idx - 1].t : '';
        }
        cineCur.textContent = lines[idx].raw || '…';
        cineCur.dataset.t = lines[idx].t != null ? lines[idx].t : '';
        if (cineNext) {
          cineNext.textContent = idx < lines.length - 1 ? (lines[idx + 1].raw || '') : '';
          cineNext.dataset.t = idx < lines.length - 1 ? lines[idx + 1].t : '';
        }
      } else if (lines && lines.length && idx === -1) {
        if (cinePrev) { cinePrev.textContent = ''; cinePrev.dataset.t = ''; }
        cineCur.textContent = '…';
        cineCur.dataset.t = '';
        if (cineNext) {
          cineNext.textContent = lines[0] ? (lines[0].raw || '') : '';
          cineNext.dataset.t = lines[0] && lines[0].t != null ? lines[0].t : '';
        }
      } else {
        if (cinePrev) { cinePrev.textContent = ''; cinePrev.dataset.t = ''; }
        cineCur.textContent = S.lyrics === null ? 'Loading lyrics…' : '…';
        cineCur.dataset.t = '';
        if (cineNext) { cineNext.textContent = ''; cineNext.dataset.t = ''; }
      }
    }
  }

  // Sidepanel lyrics (high-performance cached loop)
  if (S.lyricsOpen && S._spLines && S._spLines.length) {
    const active = findActiveLyricIndex(S._spLines, adjustedTime);
    if (active !== S._lastLy) {
      if (S._lastLy >= 0 && S._spLines[S._lastLy]) S._spLines[S._lastLy].el.classList.remove('on');
      if (active >= 0 && S._spLines[active]) {
        S._spLines[active].el.classList.add('on');
        smoothScrollToCenter($('#lyricsBody'), S._spLines[active].el);
      }
      for (let i = 0; i < S._spLines.length; i++) {
        const item = S._spLines[i];
        const isPast = i < active;
        item.el.classList.toggle('ly-past', isPast);
        item.el.classList.toggle('ly-prev', i === active - 1);
        item.el.classList.toggle('ly-prev2', i === active - 2);
        item.el.classList.toggle('ly-next', i === active + 1);
        item.el.classList.toggle('ly-next2', i === active + 2);
        if (isPast && item.lastLit !== item.words.length) {
          item.lastLit = item.words.length;
          item.words.forEach(w => w.classList.add('lit'));
        } else if (i > active && item.lastLit !== -1) {
          item.lastLit = -1;
          item.words.forEach(w => w.classList.remove('lit'));
        }
      }
      S._lastLy = active;
    }
    if (active >= 0 && S._spLines[active]) {
      const nextT = (active < S._spLines.length - 1) ? S._spLines[active + 1].t : null;
      updateWordHighlight(S._spLines[active], adjustedTime, nextT);
    }
  }

  // Full-screen overlay lyrics (high-performance cached loop)
  let fsActive = -1;
  if (S.fsOpen && S._fsLines && S._fsLines.length) {
    fsActive = findActiveLyricIndex(S._fsLines, adjustedTime);
    if (fsActive !== S._lastFsLy) {
      if (S._lastFsLy >= 0 && S._fsLines[S._lastFsLy]) S._fsLines[S._lastFsLy].el.classList.remove('on');
      if (fsActive >= 0 && S._fsLines[fsActive]) {
        S._fsLines[fsActive].el.classList.add('on');
        smoothScrollToCenter($('#fs-lyrics-body'), S._fsLines[fsActive].el);
      }
      for (let i = 0; i < S._fsLines.length; i++) {
        const item = S._fsLines[i];
        const isPast = i < fsActive;
        item.el.classList.toggle('ly-past', isPast);
        item.el.classList.toggle('ly-prev', i === fsActive - 1);
        item.el.classList.toggle('ly-prev2', i === fsActive - 2);
        item.el.classList.toggle('ly-next', i === fsActive + 1);
        item.el.classList.toggle('ly-next2', i === fsActive + 2);
        if (isPast && item.lastLit !== item.words.length) {
          item.lastLit = item.words.length;
          item.words.forEach(w => w.classList.add('lit'));
        } else if (i > fsActive && item.lastLit !== -1) {
          item.lastLit = -1;
          item.words.forEach(w => w.classList.remove('lit'));
        }
      }
      // Update preview card text ONLY when active line changes
      const prevText = $('#fs-ly-preview-text');
      if (prevText && fsActive >= 0 && S._fsLines[fsActive]) {
        prevText.textContent = S._fsLines[fsActive].el.textContent;
      }
      S._lastFsLy = fsActive;
    }
    if (fsActive >= 0 && S._fsLines[fsActive]) {
      const nextT = (fsActive < S._fsLines.length - 1) ? S._fsLines[fsActive + 1].t : null;
      updateWordHighlight(S._fsLines[fsActive], adjustedTime, nextT);
    }
  }
}

function setLyricsStyle(style) {
  const validStyles = [
    'random', 'cinematic', 'apple-music', 'verci-visual', 'verci-chat', 'verci-notifications',
    'verci-fisheye', 'verci-code', 'verci-constellation', 'karaoke', 'minimal'
  ];
  if (!validStyles.includes(style)) return;
  settings().lyricsStyle = style;
  mutate({ type: 'settings.set', patch: { lyricsStyle: style } });

  const t = curTrack();
  if (style === 'random' && t && S.trackLyricStyles) {
    S.trackLyricStyles.delete(t.id);
  }
  const effective = getEffectiveLyricsStyle(t);

  const styleSel = $('#fs-lyrics-style-select');
  if (styleSel) {
    const randomOpt = styleSel.querySelector('option[value="random"]');
    if (randomOpt) {
      const activeLabel = LYRIC_STYLE_LABELS[effective] || effective;
      randomOpt.textContent = style === 'random' ? `🔀 Auto-Randomize (${activeLabel})` : '🔀 Auto-Randomize per Song';
    }
    styleSel.value = style;
  }
  const setSel = $('#settingLyricsStyle');
  if (setSel) setSel.value = style;

  if (S.fsOpen && S.fsTab === 'lyrics') renderFsLyrics(t);
  if (S.lyricsOpen && t) renderLyricsContent(t);

  const activeLabel = style === 'random' ? `Auto-Randomize (${LYRIC_STYLE_LABELS[effective] || effective})` : (LYRIC_STYLE_LABELS[style] || style);
  toast('Lyrics Style: ' + activeLabel);
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

function showUpdatePrompt(info) {
  const version = String(info && info.version || 'new version').slice(0, 32);
  const host = $('#updateModal');
  if (!host) return;
  host.innerHTML = `<div class="update-box" role="dialog" aria-modal="true" aria-labelledby="updateTitle">
    <div class="update-icon">${icon('download')}</div>
    <h3 id="updateTitle">A new version is available</h3>
    <p>My Music ${esc(version)} is ready. Would you like to download and install it now?</p>
    <div class="update-progress hidden" id="updateProgressTrack"><div id="updateProgressFill"></div></div>
    <div class="update-status" id="updateStatus">You can keep using My Music while the update downloads.</div>
    <div class="update-actions">
      <button id="updateLater">Later</button>
      <button id="updateNow" class="primary">Update now</button>
    </div>
  </div>`;
  host.classList.remove('hidden');
  $('#updateLater', host).addEventListener('click', async () => {
    host.classList.add('hidden');
    try { await call('updates:defer', { version }); } catch (e) { console.warn('Could not defer update:', e.message); }
  });
  $('#updateNow', host).addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Starting…';
    $('#updateLater', host).disabled = true;
    $('#updateStatus', host).textContent = 'Downloading the update. My Music will restart when installation is ready.';
    $('#updateProgressTrack', host).classList.remove('hidden');
    try {
      await call('updates:install');
    } catch (e) {
      button.disabled = false;
      button.textContent = 'Retry download';
      $('#updateLater', host).disabled = false;
      $('#updateStatus', host).textContent = 'The update could not start. Check your connection and try again.';
      toast(e.message || 'Could not start the update');
    }
  });
}

function updateProgress(info) {
  const host = $('#updateModal');
  if (!host || host.classList.contains('hidden')) return;
  const progress = Math.max(0, Math.min(100, Number(info && info.percent) || 0));
  const fill = $('#updateProgressFill', host);
  if (fill) fill.style.width = `${progress}%`;
  const status = $('#updateStatus', host);
  if (status) status.textContent = `Downloading update… ${Math.round(progress)}%`;
}

function showUpdateError(info) {
  if (info && info.manual) toast(info.message || 'Update check failed');
  const host = $('#updateModal');
  if (!host || host.classList.contains('hidden')) return;
  const status = $('#updateStatus', host);
  const now = $('#updateNow', host);
  const later = $('#updateLater', host);
  if (status) status.textContent = 'Download failed. Check your connection, then retry.';
  if (now) { now.disabled = false; now.textContent = 'Retry download'; }
  if (later) later.disabled = false;
}

// ---------- misc UI ----------
function updateVolFill() {
  const v = $('#vol');
  const mVol = Math.min(1, Math.max(0, settings().volume ?? 0.8));
  if (v) {
    v.value = mVol;
    v.style.setProperty('--fill', (mVol * 100) + '%');
  }
  const pbVol = $('#pb-vol');
  if (pbVol) pbVol.innerHTML = icon(mVol === 0 ? 'volmute' : 'vol');

  const fsVol = $('#fs-vol');
  if (fsVol) {
    fsVol.value = mVol;
    fsVol.style.setProperty('--fill', (mVol * 100) + '%');
  }
  const fsVolBtn = $('#fs-vol-btn');
  if (fsVolBtn) fsVolBtn.innerHTML = icon(mVol === 0 ? 'volmute' : 'vol');
}

function setVolume(v) {
  const mVol = Math.min(1, Math.max(0, v));
  settings().volume = mVol;
  if (automixS.mixing) {
    const theta = automixS.progress * (Math.PI / 2);
    curAudio.volume = Math.max(0, Math.min(1, mVol * Math.cos(theta)));
    standbyAudio.volume = Math.max(0, Math.min(1, mVol * Math.sin(theta)));
  } else {
    curAudio.volume = mVol;
    standbyAudio.volume = 0;
  }
  updateVolFill();
  saveSettings();
}

// ---------- event wiring ----------
function bindShellEvents() {
  // suggestions & search input
  const input = $('#searchInput');
  const sugg = $('#sugg');
  let suggIdx = -1;

  const doSuggestions = debounce(async () => {
    const q = input.value.trim();
    if (!q) { sugg.classList.remove('open'); suggIdx = -1; return; }
    try {
      const list = await call('ytm:suggestions', { query: q });
      if (!list.length || input.value.trim() !== q) { sugg.classList.remove('open'); return; }
      suggIdx = -1;
      sugg.innerHTML = list.map(s => `<button data-sugg="${esc(s)}">${esc(s)}</button>`).join('');
      sugg.classList.add('open');
    } catch { sugg.classList.remove('open'); }
  }, 180);

  const doLiveSearch = debounce(() => {
    const q = input.value.trim();
    if (q && q !== S.search.q) {
      doSearch(q, { live: true });
    }
  }, 350);

  input.addEventListener('input', () => {
    suggIdx = -1;
    doSuggestions();
    doLiveSearch();
  });
  input.addEventListener('keydown', (e) => {
    const items = $$('#sugg button');
    if (sugg.classList.contains('open') && items.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        suggIdx = (suggIdx + 1) % items.length;
        items.forEach((b, i) => b.classList.toggle('sel', i === suggIdx));
        if (items[suggIdx]) input.value = items[suggIdx].dataset.sugg;
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        suggIdx = (suggIdx - 1 + items.length) % items.length;
        items.forEach((b, i) => b.classList.toggle('sel', i === suggIdx));
        if (items[suggIdx]) input.value = items[suggIdx].dataset.sugg;
        return;
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      suggIdx = -1;
      sugg.classList.remove('open');
      doSearch(input.value);
    }
    if (e.key === 'Escape') {
      suggIdx = -1;
      sugg.classList.remove('open');
      input.blur();
    }
  });
  sugg.addEventListener('mousedown', (e) => {
    const b = e.target.closest('[data-sugg]');
    if (b) {
      e.preventDefault();
      const val = b.dataset.sugg;
      input.value = val;
      sugg.classList.remove('open');
      doSearch(val);
    }
  });
  const searchBtn = $('#searchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      sugg.classList.remove('open');
      doSearch(input.value);
    });
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#searchWrap')) sugg.classList.remove('open');
  });

  // expand full-screen now playing overlay when clicking bottom playerbar song info
  $('.pb-left')?.addEventListener('click', (e) => {
    if (e.target.closest('#pb-fav')) return;
    openNowPlayingOverlay();
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
  $('#pb-automix')?.addEventListener('click', () => setAutomix(!settings().automix));
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
    const typing = Boolean(e.target && typeof e.target.matches === 'function' && e.target.matches('input, textarea'));
    if (e.key === '/' && !typing) { e.preventDefault(); input.focus(); input.select(); }
    else if (e.code === 'Space' && !typing && !e.target.closest('button')) { e.preventDefault(); togglePlay(); }
    else if (!typing && e.key === 'ArrowRight' && audio.duration) audio.currentTime += 5;
    else if (!typing && e.key === 'ArrowLeft' && audio.duration) audio.currentTime -= 5;
    else if (e.key === 'Escape') {
      if (S.fsOpen) { closeNowPlayingOverlay(); return; }
      closeMenu();
      sugg.classList.remove('open');
    }
  });

  // hide broken thumbnails
  document.addEventListener('error', (e) => {
    if (e.target && e.target.tagName === 'IMG') e.target.style.opacity = '0';
  }, true);
}

function doSearch(q, opts = {}) {
  q = (q || '').trim();
  if (!q) return;
  const input = $('#searchInput');
  if (input && document.activeElement !== input) input.value = q;
  const sugg = $('#sugg');
  if (sugg) sugg.classList.remove('open');

  const queryChanged = S.search.q !== q;
  if (queryChanged) {
    S.search = { q, filter: S.search.filter || 'songs', results: {}, tok: S.search.tok };
  }

  // Live in-place search update when already on search view
  if (S.view === 'search' && opts.live) {
    S.params.q = q;
    const titleEl = $('#content .page-title');
    if (titleEl) titleEl.textContent = `Results for “${q}”`;
    loadSearch(S.search.filter || 'songs');
    return;
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
        if (document.activeElement !== $('#searchInput')) $('#searchInput').value = S.search.q;
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
        settings().ambientColors = true;
        accCache.clear(); // flush so new extractor runs fresh
        const cur = curTrack();
        applyAccent(cur ? cur.thumb : null);
        mutate({ type: 'settings.set', patch: { accentHue: 'auto', ambientColors: true } });
      } else {
        settings().ambientColors = false;
        setHue(hue);
        mutate({ type: 'settings.set', patch: { accentHue: hue, ambientColors: false } });
      }
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
    case 'toggle-automix':
    case 'pb-automix': setAutomix(!settings().automix); break;
    case 'toggle-radio': setRadio(!settings().radio); break;
    case 'search-submit': doSearch($('#searchInput').value); break;
    case 'history-back': navBack(); break;
    case 'history-fwd': navFwd(); break;
    case 'tab': loadSearch(el.dataset.tab); break;
     case 'home-artist-search': doSearch(el.dataset.query); break;
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
  const curAutomix = settings().automix !== false;
  const curAutomixMode = settings().automixMode || 'smart';
  const curCrossfadeDuration = settings().crossfadeDuration || 6;
  const curAutomixDuration = settings().automixDuration || 'auto';

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
      <div class="automix-section">
        <div class="automix-header">
          <div class="automix-title">
            ${icon('automix')} Song Transitions & AutoMix
            <span class="automix-badge">Apple Music Style</span>
          </div>
        </div>
        <div class="automix-modes">
          <button class="automix-mode-btn ${curAutomix && curAutomixMode === 'smart' ? 'active' : ''}" data-automix-mode="smart">
            AutoMix (Apple Music)
          </button>
          <button class="automix-mode-btn ${curAutomix && curAutomixMode === 'crossfade' ? 'active' : ''}" data-automix-mode="crossfade">
            Manual Crossfade
          </button>
          <button class="automix-mode-btn ${!curAutomix ? 'active' : ''}" data-automix-mode="off">
            Off (Gapless)
          </button>
        </div>
        <div class="automix-duration-row ${curAutomix ? '' : 'hidden'}" id="automixDurWrap">
          <span style="font-size:12px;font-weight:600;">Transition Duration</span>
          <select id="modalAutomixPreset" class="fs-select" style="padding:4px 8px;border-radius:6px;background:var(--bg3);border:1px solid var(--line);color:var(--text);font-size:11.5px;font-weight:600;color-scheme:dark;">
            <option value="auto" ${curAutomixDuration === 'auto' ? 'selected' : ''}>✨ Auto (Best Mix)</option>
            <option value="1" ${String(curAutomixDuration) === '1' ? 'selected' : ''}>1s (Instant)</option>
            <option value="3" ${String(curAutomixDuration) === '3' ? 'selected' : ''}>3s (Fast)</option>
            <option value="5" ${String(curAutomixDuration) === '5' ? 'selected' : ''}>5s (Quick Blend)</option>
            <option value="6" ${String(curAutomixDuration) === '6' ? 'selected' : ''}>6s (Apple Music)</option>
            <option value="8" ${String(curAutomixDuration) === '8' ? 'selected' : ''}>8s (Standard)</option>
            <option value="10" ${String(curAutomixDuration) === '10' ? 'selected' : ''}>10s (Extended)</option>
            <option value="12" ${String(curAutomixDuration) === '12' ? 'selected' : ''}>12s (Deep Mix)</option>
            <option value="15" ${String(curAutomixDuration) === '15' ? 'selected' : ''}>15s (Max)</option>
            <option value="custom" ${curAutomixDuration !== 'auto' && ![1,3,5,6,8,10,12,15].includes(Number(curAutomixDuration)) ? 'selected' : ''}>Custom</option>
          </select>
          <input type="range" id="automixDurInput" class="automix-duration-slider" min="1" max="15" step="1" value="${curAutomixDuration === 'auto' ? 6 : (Number(curAutomixDuration) || 6)}">
          <span id="automixDurVal" style="font-weight:700;color:var(--accent);min-width:38px;font-size:12px;">${curAutomixDuration === 'auto' ? 'Auto' : curAutomixDuration + 's'}</span>
        </div>
        <div class="automix-desc" id="automixDesc">
          ${!curAutomix ? 'Standard continuous playback with no track overlap or fading.' : (curAutomixDuration === 'auto' ? 'Dynamic Apple Music mix: intelligently analyzes track tempos, trims outro silence, and blends with asymmetric DJ curves (4s–8.5s).' : `Apple Music DJ transition: blends tracks using asymmetric DJ loudness curves over ${curAutomixDuration}s with zero dead-air.`)}
        </div>
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

  const durWrap = $('#automixDurWrap', modalEl);
  const durPreset = $('#modalAutomixPreset', modalEl);
  const durInput = $('#automixDurInput', modalEl);
  const durVal = $('#automixDurVal', modalEl);
  const descEl = $('#automixDesc', modalEl);

  function updateAutomixDesc() {
    if (!descEl) return;
    if (!settings().automix) {
      descEl.textContent = 'Standard continuous playback with no track overlap or fading.';
      return;
    }
    const dur = settings().automixDuration;
    if (!dur || dur === 'auto') {
      descEl.textContent = 'Dynamic Apple Music mix: intelligently analyzes track tempos, trims outro silence, and blends with asymmetric DJ curves (4s–8.5s).';
    } else {
      descEl.textContent = `Apple Music DJ transition: blends tracks using asymmetric DJ loudness curves over ${dur}s with zero dead-air.`;
    }
  }

  modalEl.querySelectorAll('.automix-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.automixMode;
      modalEl.querySelectorAll('.automix-mode-btn').forEach(b => b.classList.toggle('active', b === btn));
      if (mode === 'off') {
        settings().automix = false;
        if (durWrap) durWrap.classList.add('hidden');
        updateAutomixDesc();
        mutate({ type: 'settings.set', patch: { automix: false } });
      } else {
        settings().automix = true;
        settings().automixMode = mode;
        if (durWrap) durWrap.classList.remove('hidden');
        updateAutomixDesc();
        mutate({ type: 'settings.set', patch: { automix: true, automixMode: mode } });
      }
      updateShuffleRepeatBtns();
    });
  });

  if (durPreset) {
    durPreset.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'auto') {
        settings().automixDuration = 'auto';
        if (durVal) durVal.textContent = 'Auto';
        if (durInput) durInput.value = 6;
      } else if (val !== 'custom') {
        const secs = Math.max(1, Math.min(15, parseInt(val, 10) || 6));
        settings().automixDuration = secs;
        settings().crossfadeDuration = secs;
        if (durVal) durVal.textContent = secs + 's';
        if (durInput) durInput.value = secs;
      }
      updateAutomixDesc();
      mutate({ type: 'settings.set', patch: { automixDuration: settings().automixDuration, crossfadeDuration: settings().crossfadeDuration } });
      updateShuffleRepeatBtns();
    });
  }

  if (durInput && durVal) {
    durInput.addEventListener('input', (e) => {
      const secs = Math.round(parseFloat(e.target.value));
      durVal.textContent = secs + 's';
      settings().automixDuration = secs;
      settings().crossfadeDuration = secs;
      if (durPreset) {
        durPreset.value = [1, 3, 5, 6, 8, 10, 12, 15].includes(secs) ? String(secs) : 'custom';
      }
      updateAutomixDesc();
      mutate({ type: 'settings.set', patch: { automixDuration: secs, crossfadeDuration: secs } });
      updateShuffleRepeatBtns();
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
    track: { id: t.id, title: t.title, artist: t.artist, artistId: t.artistId, artistThumb: t.artistThumb, thumb: t.thumb, duration: t.duration },
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

  const topArtistsHtml = topArtistsList.length ? topArtistsList.map(([artist, a], i) => {
    const thumb = a.thumb || (S.artistThumbs && S.artistThumbs[artist]);
    const thumbHtml = thumb
      ? `<img class="top-thumb round" src="${esc(thumb)}" alt="${esc(artist)}">`
      : `<div class="top-thumb round artist-avatar" style="font-size:15px;width:40px;height:40px">${esc(artist.slice(0, 1).toUpperCase())}</div>`;
    return `
      <div class="top-item" data-action="${a.id ? 'artist' : 'home-artist-search'}" data-id="${esc(a.id || '')}" data-query="${esc(artist)}" style="cursor:pointer">
        <div class="top-rank rank-${i + 1}">${i + 1}</div>
        <div class="top-thumb-wrap" data-artist-thumb-stat="${esc(artist)}">${thumbHtml}</div>
        <div class="top-meta">
          <div class="top-title">${esc(artist)}</div>
          <div class="top-sub">${Math.round(a.seconds / 60)} minutes listened</div>
        </div>
        <div class="top-count">${a.plays} plays</div>
      </div>
    `;
  }).join('') : '<div class="q-empty" style="padding:16px 0">Listen to music to see your top artists!</div>';

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
  loadTopArtistThumbs(topArtistsList);
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
  const autoUpdate = s.autoUpdate !== false;
  const ambientColors = s.ambientColors !== false;

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
            <span class="settings-title">${icon('radio')} Ambient Colors</span>
            <span class="settings-desc">Theme and visualizer colors shift automatically to match each track's album art</span>
          </div>
          <label class="toggle-wrap" title="Ambient Colors">
            <input type="checkbox" id="ambientColorsToggle" ${ambientColors ? 'checked' : ''}>
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </label>
        </div>
        <div style="height:1px;background:var(--line);margin:4px 0"></div>
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
        <h3>${icon('automix')} AutoMix & Song Transitions</h3>
        <div class="settings-row">
          <div class="settings-label">
            <span class="settings-title">Apple Music AutoMix</span>
            <span class="settings-desc">Seamlessly blend songs with asymmetric DJ volume curves, dead-air trimming, and beat matching</span>
          </div>
          <label class="toggle-wrap" title="AutoMix">
            <input type="checkbox" id="settingAutomix" ${s.automix !== false ? 'checked' : ''}>
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </label>
        </div>
        <div style="height:1px;background:var(--line);margin:4px 0"></div>
        <div class="settings-row">
          <div class="settings-label">
            <span class="settings-title">Transition Duration</span>
            <span class="settings-desc">Keep default dynamic "Best Mix" or select a custom blend duration (1s–15s)</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <select id="settingAutomixDuration" class="fs-select" style="padding:6px 12px;border-radius:8px;background:var(--bg3);border:1px solid var(--line);color:var(--text);font-weight:600;font-size:12px">
              <option value="auto" ${(s.automixDuration || 'auto') === 'auto' ? 'selected' : ''}>✨ Auto (Best Mix)</option>
              <option value="1" ${String(s.automixDuration) === '1' ? 'selected' : ''}>1s (Instant Blend)</option>
              <option value="3" ${String(s.automixDuration) === '3' ? 'selected' : ''}>3s (Fast Transition)</option>
              <option value="5" ${String(s.automixDuration) === '5' ? 'selected' : ''}>5s (Quick Blend)</option>
              <option value="6" ${String(s.automixDuration) === '6' ? 'selected' : ''}>6s (Apple Music Standard)</option>
              <option value="8" ${String(s.automixDuration) === '8' ? 'selected' : ''}>8s (Standard DJ)</option>
              <option value="10" ${String(s.automixDuration) === '10' ? 'selected' : ''}>10s (Extended)</option>
              <option value="12" ${String(s.automixDuration) === '12' ? 'selected' : ''}>12s (Deep Blend)</option>
              <option value="15" ${String(s.automixDuration) === '15' ? 'selected' : ''}>15s (Max Extended)</option>
              <option value="custom" ${s.automixDuration !== 'auto' && ![1,3,5,6,8,10,12,15].includes(Number(s.automixDuration)) ? 'selected' : ''}>Custom</option>
            </select>
          </div>
        </div>
        <div class="settings-row" id="settingAutomixSliderRow" style="margin-top:6px;${s.automix === false ? 'opacity:0.5;pointer-events:none;' : ''}">
          <div class="settings-label">
            <span class="settings-title" style="font-size:12.5px">Fine-Tune Transition Time</span>
            <span class="settings-desc" id="settingAutomixHint">${(s.automixDuration || 'auto') === 'auto' ? 'Best Mix dynamically tunes transition duration between 4.0s and 8.5s based on track BPM and length' : `Transition length fixed at ${s.automixDuration}s`}</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <input type="range" id="settingAutomixSlider" min="1" max="15" step="1" value="${(s.automixDuration || 'auto') === 'auto' ? 6 : Number(s.automixDuration)}" style="accent-color:var(--accent);width:120px">
            <span id="settingAutomixVal" style="font-size:12px;font-weight:700;color:var(--accent);min-width:35px">${(s.automixDuration || 'auto') === 'auto' ? 'Auto' : s.automixDuration + 's'}</span>
          </div>
        </div>
      </div>

      <div class="settings-card">
        <h3>${icon('lyrics')} Lyrics & Visual Animation</h3>
        <div class="settings-row">
          <div class="settings-label">
            <span class="settings-title">Lyrics Animation Style</span>
            <span class="settings-desc">Choose between the AI-powered cinematic canvas, Apple Music kinetic blur, classic karaoke, or minimalist</span>
          </div>
          <select id="settingLyricsStyle" class="fs-select" style="padding:7px 14px;border-radius:8px;background:var(--bg3);border:1px solid var(--line);color:var(--text);font-weight:600">
            <option value="random" ${(!s.lyricsStyle || s.lyricsStyle === 'random') ? 'selected' : ''}>🔀 Auto-Randomize per Song</option>
            <option value="cinematic" ${s.lyricsStyle === 'cinematic' ? 'selected' : ''}>✨ Cinematic Story (SONARA AI Engine)</option>
            <option value="apple-music" ${s.lyricsStyle === 'apple-music' ? 'selected' : ''}>🎵 Apple Music Kinetic Blur</option>
            <option value="verci-visual" ${s.lyricsStyle === 'verci-visual' ? 'selected' : ''}>✨ Verci Visual (with Animated Emojis)</option>
            <option value="verci-chat" ${s.lyricsStyle === 'verci-chat' ? 'selected' : ''}>💬 Verci iMessage Chat (iOS Bubbles)</option>
            <option value="verci-notifications" ${s.lyricsStyle === 'verci-notifications' ? 'selected' : ''}>📱 Verci iOS Lock-Screen Notifications</option>
            <option value="verci-fisheye" ${s.lyricsStyle === 'verci-fisheye' ? 'selected' : ''}>👁️ Verci 3D Fisheye Lens Stack</option>
            <option value="verci-code" ${s.lyricsStyle === 'verci-code' ? 'selected' : ''}>💻 Verci Code Terminal & Cursor</option>
            <option value="verci-constellation" ${s.lyricsStyle === 'verci-constellation' ? 'selected' : ''}>🌌 Verci Constellation Star Nodes</option>
            <option value="karaoke" ${s.lyricsStyle === 'karaoke' ? 'selected' : ''}>🎤 Classic Karaoke</option>
            <option value="minimal" ${s.lyricsStyle === 'minimal' ? 'selected' : ''}>📄 Minimalist Clean</option>
          </select>
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
        <h3>${icon('download')} App Updates</h3>
        <div class="settings-row">
          <div class="settings-label">
            <span class="settings-title">Check for updates automatically</span>
            <span class="settings-desc" id="updateSupportText">Checks GitHub Releases at startup and every 6 hours. Update prompts let you install now or later.</span>
          </div>
          <label class="eq-checkbox-label">
            <input type="checkbox" id="settingAutoUpdate" ${autoUpdate ? 'checked' : ''}>
            <span>Enabled</span>
          </label>
        </div>
        <div class="settings-row" style="margin-top:10px">
          <span class="settings-desc">Automatic installation works with the Windows Setup installer. Portable and ZIP builds need a manual download.</span>
          <button class="ghostbtn" id="checkUpdatesBtn" style="padding:7px 14px;border-radius:999px">Check now</button>
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

  const updateCheck = $('#settingAutoUpdate');
  if (updateCheck) {
    updateCheck.addEventListener('change', (e) => {
      const enabled = !!e.target.checked;
      settings().autoUpdate = enabled;
      mutate({ type: 'settings.set', patch: { autoUpdate: enabled } });
      toast(`Automatic update checks ${enabled ? 'enabled' : 'disabled'}`);
      if (enabled) call('updates:check', { manual: false }).catch((err) => console.warn('Update check failed:', err.message));
    });
  }

  const lyricsStyleSel = $('#settingLyricsStyle');
  if (lyricsStyleSel) {
    lyricsStyleSel.addEventListener('change', (e) => {
      setLyricsStyle(e.target.value);
    });
  }

  const checkUpdatesBtn = $('#checkUpdatesBtn');
  if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener('click', async () => {
      checkUpdatesBtn.disabled = true;
      checkUpdatesBtn.textContent = 'Checking…';
      try { await call('updates:check', { manual: true }); }
      catch (err) { toast(err.message || 'Update check failed'); }
      finally {
        checkUpdatesBtn.disabled = false;
        checkUpdatesBtn.textContent = 'Check now';
      }
    });
    call('updates:get-status').then((status) => {
      if (status.supported) return;
      checkUpdatesBtn.disabled = true;
      checkUpdatesBtn.title = 'Automatic updates are available only in the installed Windows Setup version';
      const note = $('#updateSupportText');
      if (note) note.textContent = 'Update checks are active in the installed Windows Setup version. Portable, ZIP, and development builds cannot self-update.';
    }).catch(() => {});
  }

  const ambientCheck = $('#ambientColorsToggle');
  if (ambientCheck) {
    ambientCheck.addEventListener('change', (e) => {
      const on = !!e.target.checked;
      settings().ambientColors = on;
      if (on) settings().accentHue = 'auto';
      mutate({ type: 'settings.set', patch: { ambientColors: on, accentHue: on ? 'auto' : settings().accentHue } });
      accCache.clear();
      if (on) {
        const cur = curTrack();
        applyAccent(cur ? cur.thumb : null);
      } else {
        const fixedHue = settings().accentHue !== 'auto' && settings().accentHue != null
          ? settings().accentHue : ACC_DEFAULT_HUE;
        setHue(fixedHue === 'auto' ? ACC_DEFAULT_HUE : fixedHue);
      }
      renderSettings();
      toast('Ambient colors ' + (on ? 'on' : 'off'));
    });
  }

  const settingAutomixToggle = $('#settingAutomix');
  const settingAutomixDuration = $('#settingAutomixDuration');
  const settingAutomixSlider = $('#settingAutomixSlider');
  const settingAutomixVal = $('#settingAutomixVal');
  const settingAutomixHint = $('#settingAutomixHint');
  const settingAutomixSliderRow = $('#settingAutomixSliderRow');

  if (settingAutomixToggle) {
    settingAutomixToggle.addEventListener('change', (e) => {
      const enabled = !!e.target.checked;
      settings().automix = enabled;
      mutate({ type: 'settings.set', patch: { automix: enabled } });
      if (settingAutomixSliderRow) {
        settingAutomixSliderRow.style.opacity = enabled ? '1' : '0.5';
        settingAutomixSliderRow.style.pointerEvents = enabled ? 'auto' : 'none';
      }
      updateShuffleRepeatBtns();
      const durLabel = (!settings().automixDuration || settings().automixDuration === 'auto') ? 'Auto (Best Mix)' : `${settings().automixDuration}s`;
      toast('AutoMix ' + (enabled ? `enabled (Apple Music ${durLabel})` : 'disabled'));
    });
  }

  if (settingAutomixDuration) {
    settingAutomixDuration.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'auto') {
        settings().automixDuration = 'auto';
        if (settingAutomixVal) settingAutomixVal.textContent = 'Auto';
        if (settingAutomixSlider) settingAutomixSlider.value = 6;
        if (settingAutomixHint) settingAutomixHint.textContent = 'Best Mix dynamically tunes transition duration between 4.0s and 8.5s based on track BPM and length';
      } else if (val !== 'custom') {
        const secs = Math.max(1, Math.min(15, parseInt(val, 10) || 6));
        settings().automixDuration = secs;
        settings().crossfadeDuration = secs;
        if (settingAutomixVal) settingAutomixVal.textContent = secs + 's';
        if (settingAutomixSlider) settingAutomixSlider.value = secs;
        if (settingAutomixHint) settingAutomixHint.textContent = `Transition length fixed at ${secs}s`;
      }
      mutate({ type: 'settings.set', patch: { automixDuration: settings().automixDuration, crossfadeDuration: settings().crossfadeDuration } });
      updateShuffleRepeatBtns();
    });
  }

  if (settingAutomixSlider && settingAutomixVal) {
    settingAutomixSlider.addEventListener('input', (e) => {
      const secs = Math.round(parseFloat(e.target.value));
      settingAutomixVal.textContent = secs + 's';
      settings().automixDuration = secs;
      settings().crossfadeDuration = secs;
      if (settingAutomixDuration) {
        settingAutomixDuration.value = [1, 3, 5, 6, 8, 10, 12, 15].includes(secs) ? String(secs) : 'custom';
      }
      if (settingAutomixHint) settingAutomixHint.textContent = `Transition length fixed at ${secs}s`;
      mutate({ type: 'settings.set', patch: { automixDuration: secs, crossfadeDuration: secs } });
      updateShuffleRepeatBtns();
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
