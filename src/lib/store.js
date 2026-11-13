// Local library persistence: favorites, playlists, recently played, settings.
// Stored as JSON in the Electron userData folder (outside OneDrive).

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

let file = null;
let data = null;
let saveTimer = null;

function filePath() {
  if (!file) {
    let dir;
    try {
      dir = (app && typeof app.getPath === 'function')
        ? app.getPath('userData')
        : path.join(require('os').homedir(), '.mymusic');
    } catch {
      dir = path.join(require('os').homedir(), '.mymusic');
    }
    fs.mkdirSync(dir, { recursive: true });
    file = path.join(dir, 'mymusic-data.json');
  }
  return file;
}

const DEFAULTS = () => ({
  favorites: [],
  playlists: [],
  recent: [],
  settings: {
    volume: 0.8,
    repeat: 'off',
    shuffle: false,
    viz: 'liquid',
    radio: true,
    speed: 1.0,
    pitchLock: true,
    eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    eqPreset: 'Flat',
    wallpaper: null,
    wallpaperDim: 0.6,
    accentHue: null,
    closeToTray: true
  },
  lyricsOffsets: {},
  lastQueue: null,
  playStats: {
    totalPlays: 0,
    totalSeconds: 0,
    tracks: {},
    artists: {}
  }
});

function load() {
  if (data) return data;
  try {
    data = { ...DEFAULTS(), ...JSON.parse(fs.readFileSync(filePath(), 'utf8')) };
  } catch {
    data = DEFAULTS();
  }
  if (!data.lyricsOffsets || typeof data.lyricsOffsets !== 'object' || Array.isArray(data.lyricsOffsets)) {
    data.lyricsOffsets = {};
  }
  if (!data.settings || typeof data.settings !== 'object') {
    data.settings = DEFAULTS().settings;
  }
  if (typeof data.settings.radio !== 'boolean') {
    data.settings.radio = true;
  }
  if (!data.playStats || typeof data.playStats !== 'object') {
    data.playStats = DEFAULTS().playStats;
  }
  return data;
}

function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const tmp = filePath() + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(load(), null, 2));
      fs.renameSync(tmp, filePath());
    } catch (e) {
      console.error('[store] save failed:', e.message);
    }
  }, 250);
}

const uid = () => 'pl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sameTrack = (a, b) => a && b && a.id === b.id;

function clean(t) {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist || '',
    artistId: t.artistId || null,
    album: t.album || '',
    albumId: t.albumId || null,
    duration: t.duration || 0,
    thumb: t.thumb || '',
    type: t.type || 'song'
  };
}

function mutate(p) {
  const d = load();
  switch (p.type) {
    case 'fav.toggle': {
      const i = d.favorites.findIndex(t => sameTrack(t, p.track));
      if (i >= 0) d.favorites.splice(i, 1);
      else d.favorites.unshift(clean(p.track));
      break;
    }
    case 'playlist.create':
      d.playlists.unshift({ id: uid(), name: (p.name || 'New Playlist').slice(0, 60), tracks: [], createdAt: Date.now() });
      break;
    case 'playlist.delete':
      d.playlists = d.playlists.filter(pl => pl.id !== p.id);
      break;
    case 'playlist.rename': {
      const pl = d.playlists.find(x => x.id === p.id);
      if (pl) pl.name = (p.name || pl.name).slice(0, 60);
      break;
    }
    case 'playlist.add': {
      const pl = d.playlists.find(x => x.id === p.id);
      if (pl && !pl.tracks.some(t => sameTrack(t, p.track))) pl.tracks.push(clean(p.track));
      break;
    }
    case 'playlist.remove': {
      const pl = d.playlists.find(x => x.id === p.id);
      if (pl) pl.tracks = pl.tracks.filter(t => !sameTrack(t, p.track));
      break;
    }
    case 'recent.add': {
      d.recent = d.recent.filter(t => !sameTrack(t, p.track));
      d.recent.unshift(clean(p.track));
      if (d.recent.length > 100) d.recent.length = 100;
      break;
    }
    case 'settings.set': {
      // Allowlist: only known settings keys, with sane value checks —
      // arbitrary keys (incl. '__proto__') from the renderer are dropped.
      const patch = p.patch || {};
      if ('volume' in patch) d.settings.volume = Math.min(1, Math.max(0, Number(patch.volume) || 0));
      if ('repeat' in patch && ['off', 'all', 'one'].includes(patch.repeat)) d.settings.repeat = patch.repeat;
      if ('shuffle' in patch) d.settings.shuffle = !!patch.shuffle;
      if ('radio' in patch) d.settings.radio = !!patch.radio;
      if ('viz' in patch && ['liquid', 'orbit', 'bars', 'wave', 'silk', 'blob', 'off'].includes(patch.viz)) d.settings.viz = patch.viz;
      if ('speed' in patch) d.settings.speed = Math.max(0.5, Math.min(2.0, Number(patch.speed) || 1.0));
      if ('pitchLock' in patch) d.settings.pitchLock = !!patch.pitchLock;
      if ('eq' in patch && Array.isArray(patch.eq) && patch.eq.length === 10) d.settings.eq = patch.eq.map(v => Math.max(-12, Math.min(12, Number(v) || 0)));
      if ('eqPreset' in patch && typeof patch.eqPreset === 'string') d.settings.eqPreset = patch.eqPreset.slice(0, 30);
      if ('wallpaper' in patch) d.settings.wallpaper = patch.wallpaper ? String(patch.wallpaper).slice(0, 500) : null;
      if ('wallpaperDim' in patch) d.settings.wallpaperDim = Math.max(0, Math.min(0.95, Number(patch.wallpaperDim) || 0.6));
      if ('accentHue' in patch) d.settings.accentHue = patch.accentHue != null ? Math.max(0, Math.min(360, Number(patch.accentHue) || 0)) : null;
      if ('closeToTray' in patch) d.settings.closeToTray = !!patch.closeToTray;
      break;
    }
    case 'stats.record': {
      if (!d.playStats) d.playStats = { totalPlays: 0, totalSeconds: 0, tracks: {}, artists: {} };
      const t = p.track;
      if (t && t.id) {
        d.playStats.totalPlays = (d.playStats.totalPlays || 0) + 1;
        const dur = Number(p.seconds != null ? p.seconds : p.duration) || 0;
        d.playStats.totalSeconds = (d.playStats.totalSeconds || 0) + dur;
        const trk = d.playStats.tracks[t.id] || { id: t.id, title: t.title, artist: t.artist, thumb: t.thumb, plays: 0 };
        trk.plays++;
        d.playStats.tracks[t.id] = trk;
        if (t.artist) {
          const a = d.playStats.artists[t.artist] || { name: t.artist, plays: 0, seconds: 0 };
          a.plays++;
          a.seconds = (a.seconds || 0) + dur;
          d.playStats.artists[t.artist] = a;
        }
      }
      break;
    }
    case 'lastQueue.set':
      d.lastQueue = p.data;
      break;
    case 'lyricsOffset.set': {
      if (!d.lyricsOffsets || typeof d.lyricsOffsets !== 'object') d.lyricsOffsets = {};
      if (p.id && typeof p.id === 'string') {
        const offset = Math.max(-10000, Math.min(10000, Number(p.offset) || 0));
        if (offset === 0) delete d.lyricsOffsets[p.id];
        else d.lyricsOffsets[p.id] = offset;
      }
      break;
    }
    default:
      throw new Error('unknown mutation: ' + p.type);
  }
  save();
  return d;
}

module.exports = { all: () => load(), mutate };
