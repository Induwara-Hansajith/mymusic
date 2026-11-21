// Authentication & Cross-Platform Cloud Synchronization Engine for My Music
// Supports Supabase GoTrue Auth & REST database with offline-first local cache reconciliation.

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class AuthSyncEngine extends EventEmitter {
  constructor() {
    super();
    this.store = null;
    this.authFilePath = null;
    this.data = null;
    this.pushTimer = null;
    this.isSyncing = false;
    this.disposed = false;
  }

  getFilePath() {
    if (!this.authFilePath) {
      let dir;
      try {
        dir = (app && typeof app.getPath === 'function')
          ? app.getPath('userData')
          : path.join(require('os').homedir(), '.mymusic');
      } catch {
        dir = path.join(require('os').homedir(), '.mymusic');
      }
      fs.mkdirSync(dir, { recursive: true });
      this.authFilePath = path.join(dir, 'mymusic-auth.json');
    }
    return this.authFilePath;
  }

  load() {
    if (this.data) return this.data;
    const defaults = {
      user: null, // { id, email, name, avatarUrl }
      session: null, // { accessToken, refreshToken, expiresAt }
      config: {
        supabaseUrl: '',
        supabaseAnonKey: '',
        demoMode: false
      },
      sync: {
        status: 'idle', // 'idle' | 'syncing' | 'synced' | 'offline' | 'error'
        lastSyncedAt: null,
        error: null
      }
    };

    try {
      if (fs.existsSync(this.getFilePath())) {
        const parsed = JSON.parse(fs.readFileSync(this.getFilePath(), 'utf8'));
        this.data = {
          ...defaults,
          ...parsed,
          config: { ...defaults.config, ...(parsed && parsed.config) },
          sync: { ...defaults.sync, ...(parsed && parsed.sync), status: 'idle', error: null }
        };
      } else {
        this.data = defaults;
      }
    } catch {
      this.data = defaults;
    }
    return this.data;
  }

  save() {
    try {
      const p = this.getFilePath();
      const tmp = p + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.load(), null, 2), 'utf8');
      fs.renameSync(tmp, p);
    } catch (e) {
      console.error('[auth-sync] save failed:', e.message);
    }
  }

  init(storeInstance) {
    this.store = storeInstance;
    this.load();

    if (this.store && typeof this.store.onMutation === 'function') {
      this.store.onMutation((mutationPayload, currentStore) => {
        this.notifyMutation(mutationPayload, currentStore);
      });
    }

    // If already logged in, perform initial background sync after startup delay
    if (this.isLoggedIn()) {
      setTimeout(() => {
        this.syncNow().catch(() => {});
      }, 3500);
    }
  }

  isLoggedIn() {
    const d = this.load();
    return !!(d.user && d.user.id);
  }

  getUser() {
    const d = this.load();
    return {
      loggedIn: this.isLoggedIn(),
      user: d.user ? {
        id: d.user.id,
        email: d.user.email,
        name: d.user.name || (d.user.email ? d.user.email.split('@')[0] : 'Music Fan'),
        avatarUrl: d.user.avatarUrl || ''
      } : null,
      sync: {
        status: d.sync.status,
        lastSyncedAt: d.sync.lastSyncedAt,
        error: d.sync.error
      },
      config: {
        hasRemoteConfig: !!(d.config.supabaseUrl && d.config.supabaseAnonKey),
        supabaseUrl: d.config.supabaseUrl || '',
        demoMode: !!d.config.demoMode
      }
    };
  }

  getConfig() {
    const d = this.load();
    return {
      supabaseUrl: d.config.supabaseUrl || '',
      supabaseAnonKey: d.config.supabaseAnonKey || '',
      demoMode: !!d.config.demoMode
    };
  }

  setConfig({ supabaseUrl, supabaseAnonKey, demoMode }) {
    const d = this.load();
    if (supabaseUrl !== undefined) d.config.supabaseUrl = (supabaseUrl || '').trim();
    if (supabaseAnonKey !== undefined) d.config.supabaseAnonKey = (supabaseAnonKey || '').trim();
    if (demoMode !== undefined) d.config.demoMode = !!demoMode;
    this.save();
    this.emit('state-changed', this.getUser());
    return this.getUser();
  }

  setSyncStatus(status, error = null) {
    const d = this.load();
    d.sync.status = status;
    d.sync.error = error;
    if (status === 'synced') {
      d.sync.lastSyncedAt = Date.now();
    }
    this.save();
    this.emit('sync-status', {
      status,
      lastSyncedAt: d.sync.lastSyncedAt,
      error
    });
  }

  async signUp({ email, password, name }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();
    const cleanName = (name || '').trim() || (cleanEmail ? cleanEmail.split('@')[0] : 'User');

    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const d = this.load();
    const url = d.config.supabaseUrl;
    const key = d.config.supabaseAnonKey;

    // Demo / Local Mock Mode if not configured
    if (!url || !key || d.config.demoMode) {
      const mockId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      d.user = { id: mockId, email: cleanEmail, name: cleanName, avatarUrl: '' };
      d.session = { accessToken: 'demo_token_' + mockId, refreshToken: 'demo_refresh_' + mockId, expiresAt: Date.now() + 86400000 * 30 };
      this.save();
      this.setSyncStatus('synced');
      this.emit('state-changed', this.getUser());
      return { ok: true, user: this.getUser() };
    }

    try {
      const res = await fetch(`${url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
          data: { name: cleanName }
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.msg || resData.error_description || resData.message || 'Failed to sign up.');
      }

      if (resData.session && resData.user) {
        d.user = {
          id: resData.user.id,
          email: resData.user.email,
          name: (resData.user.user_metadata && resData.user.user_metadata.name) || cleanName,
          avatarUrl: ''
        };
        d.session = {
          accessToken: resData.session.access_token,
          refreshToken: resData.session.refresh_token,
          expiresAt: Date.now() + (resData.session.expires_in || 3600) * 1000
        };
        this.save();
        this.setSyncStatus('synced');
        this.emit('state-changed', this.getUser());
        // Initial cloud library push
        setTimeout(() => this.syncNow().catch(() => {}), 500);
        return { ok: true, user: this.getUser() };
      }

      return {
        ok: true,
        confirmNeeded: true,
        message: 'Account created! Please check your email to confirm your registration before signing in.'
      };
    } catch (err) {
      this.setSyncStatus('error', err.message);
      throw err;
    }
  }

  async signIn({ email, password }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!cleanPassword) {
      throw new Error('Please enter your password.');
    }

    const d = this.load();
    const url = d.config.supabaseUrl;
    const key = d.config.supabaseAnonKey;

    if (!url || !key || d.config.demoMode) {
      const mockId = 'usr_' + Buffer.from(cleanEmail).toString('hex').slice(0, 12);
      d.user = { id: mockId, email: cleanEmail, name: cleanEmail.split('@')[0], avatarUrl: '' };
      d.session = { accessToken: 'demo_token_' + mockId, refreshToken: 'demo_refresh_' + mockId, expiresAt: Date.now() + 86400000 * 30 };
      this.save();
      this.setSyncStatus('synced');
      this.emit('state-changed', this.getUser());
      return { ok: true, user: this.getUser() };
    }

    try {
      const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error_description || resData.msg || resData.message || 'Invalid email or password.');
      }

      d.user = {
        id: resData.user.id,
        email: resData.user.email,
        name: (resData.user.user_metadata && resData.user.user_metadata.name) || resData.user.email.split('@')[0],
        avatarUrl: ''
      };
      d.session = {
        accessToken: resData.access_token,
        refreshToken: resData.refresh_token,
        expiresAt: Date.now() + (resData.expires_in || 3600) * 1000
      };
      this.save();
      this.setSyncStatus('syncing');
      this.emit('state-changed', this.getUser());

      // Pull & merge cloud data
      await this.syncNow();
      return { ok: true, user: this.getUser() };
    } catch (err) {
      this.setSyncStatus('error', err.message);
      throw err;
    }
  }

  async signOut() {
    const d = this.load();
    const url = d.config.supabaseUrl;
    const key = d.config.supabaseAnonKey;
    const token = d.session && d.session.accessToken;

    if (url && key && token) {
      try {
        await fetch(`${url}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${token}`
          }
        });
      } catch {
        // Ignore network failure on sign out
      }
    }

    d.user = null;
    d.session = null;
    d.sync.status = 'idle';
    d.sync.error = null;
    this.save();

    this.emit('state-changed', this.getUser());
    this.emit('sync-status', { status: 'idle', lastSyncedAt: d.sync.lastSyncedAt, error: null });
    return { ok: true };
  }

  async resetPassword({ email }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    const d = this.load();
    const url = d.config.supabaseUrl;
    const key = d.config.supabaseAnonKey;

    if (!url || !key || d.config.demoMode) {
      return { ok: true, message: 'Password reset link sent to ' + cleanEmail };
    }

    const res = await fetch(`${url}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: cleanEmail })
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(resData.msg || resData.error_description || resData.message || 'Failed to send password recovery email.');
    }
    return { ok: true, message: 'Password recovery email sent.' };
  }

  async refreshSessionIfNeeded() {
    const d = this.load();
    if (!d.session || !d.session.refreshToken) return null;
    // If token expires in less than 5 minutes
    if (d.session.expiresAt && Date.now() > d.session.expiresAt - 300000) {
      const url = d.config.supabaseUrl;
      const key = d.config.supabaseAnonKey;
      if (!url || !key) return d.session.accessToken;

      try {
        const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: {
            'apikey': key,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refresh_token: d.session.refreshToken })
        });
        const resData = await res.json();
        if (res.ok && resData.access_token) {
          d.session.accessToken = resData.access_token;
          d.session.refreshToken = resData.refresh_token || d.session.refreshToken;
          d.session.expiresAt = Date.now() + (resData.expires_in || 3600) * 1000;
          this.save();
        }
      } catch (e) {
        console.warn('[auth-sync] session refresh warning:', e.message);
      }
    }
    return d.session ? d.session.accessToken : null;
  }

  notifyMutation(_mutationPayload, _currentStore) {
    if (!this.isLoggedIn()) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.pushToCloud().catch(() => {});
    }, 2500);
  }

  mergeLibraries(localLib, remoteRecord) {
    const local = localLib || {};
    const remote = remoteRecord || {};

    // 1. Favorites merge (union by track id, newest first)
    const seenFavs = new Set();
    const mergedFavs = [];

    const localFavs = Array.isArray(local.favorites) ? local.favorites : [];
    const remoteFavs = Array.isArray(remote.favorites) ? remote.favorites : [];

    for (const t of localFavs) {
      if (t && t.id && !seenFavs.has(t.id)) {
        seenFavs.add(t.id);
        mergedFavs.push(t);
      }
    }
    for (const t of remoteFavs) {
      if (t && t.id && !seenFavs.has(t.id)) {
        seenFavs.add(t.id);
        mergedFavs.push(t);
      }
    }

    // 2. Playlists merge (by playlist id)
    const localPlaylists = Array.isArray(local.playlists) ? local.playlists : [];
    const remotePlaylists = Array.isArray(remote.playlists) ? remote.playlists : [];
    const playlistMap = new Map();

    for (const pl of localPlaylists) {
      if (pl && pl.id) {
        playlistMap.set(pl.id, {
          ...pl,
          tracks: Array.isArray(pl.tracks) ? [...pl.tracks] : []
        });
      }
    }

    for (const rPl of remotePlaylists) {
      if (!rPl || !rPl.id) continue;
      if (!playlistMap.has(rPl.id)) {
        playlistMap.set(rPl.id, {
          ...rPl,
          tracks: Array.isArray(rPl.tracks) ? [...rPl.tracks] : []
        });
      } else {
        const existing = playlistMap.get(rPl.id);
        const trackIds = new Set(existing.tracks.map(t => t.id));
        const remoteTracks = Array.isArray(rPl.tracks) ? rPl.tracks : [];
        for (const t of remoteTracks) {
          if (t && t.id && !trackIds.has(t.id)) {
            trackIds.add(t.id);
            existing.tracks.push(t);
          }
        }
      }
    }
    const mergedPlaylists = Array.from(playlistMap.values());

    // 3. Settings merge (sync theme, EQ presets, automix; preserve local hardware/window settings)
    const localSettings = local.settings || {};
    const remoteSettings = remote.settings || {};
    const mergedSettings = {
      ...localSettings,
      eq: remoteSettings.eq || localSettings.eq,
      eqPreset: remoteSettings.eqPreset || localSettings.eqPreset,
      accentHue: remoteSettings.accentHue !== undefined ? remoteSettings.accentHue : localSettings.accentHue,
      wallpaper: remoteSettings.wallpaper !== undefined ? remoteSettings.wallpaper : localSettings.wallpaper,
      wallpaperDim: remoteSettings.wallpaperDim !== undefined ? remoteSettings.wallpaperDim : localSettings.wallpaperDim,
      automix: remoteSettings.automix !== undefined ? remoteSettings.automix : localSettings.automix,
      automixMode: remoteSettings.automixMode || localSettings.automixMode,
      automixDuration: remoteSettings.automixDuration || localSettings.automixDuration,
      crossfadeDuration: remoteSettings.crossfadeDuration || localSettings.crossfadeDuration,
      viz: remoteSettings.viz || localSettings.viz,
      fsViz: remoteSettings.fsViz || localSettings.fsViz,
      lyricsStyle: remoteSettings.lyricsStyle || localSettings.lyricsStyle
    };

    // 4. PlayStats merge
    const localStats = local.playStats || { totalPlays: 0, totalSeconds: 0, tracks: {}, artists: {} };
    const remoteStats = remote.play_stats || remote.playStats || { totalPlays: 0, totalSeconds: 0, tracks: {}, artists: {} };
    const mergedStats = {
      totalPlays: Math.max(Number(localStats.totalPlays) || 0, Number(remoteStats.totalPlays) || 0),
      totalSeconds: Math.max(Number(localStats.totalSeconds) || 0, Number(remoteStats.totalSeconds) || 0),
      tracks: { ...(remoteStats.tracks || {}), ...(localStats.tracks || {}) },
      artists: { ...(remoteStats.artists || {}), ...(localStats.artists || {}) }
    };

    // 5. LyricsOffsets merge
    const mergedLyricsOffsets = {
      ...(remote.lyrics_offsets || remote.lyricsOffsets || {}),
      ...(local.lyricsOffsets || {})
    };

    return {
      favorites: mergedFavs,
      playlists: mergedPlaylists,
      settings: mergedSettings,
      playStats: mergedStats,
      lyricsOffsets: mergedLyricsOffsets
    };
  }

  async syncNow() {
    if (!this.isLoggedIn()) return { ok: false, error: 'Not logged in' };
    if (this.isSyncing) return { ok: true, status: 'syncing' };

    this.isSyncing = true;
    this.setSyncStatus('syncing');

    try {
      const d = this.load();
      const url = d.config.supabaseUrl;
      const key = d.config.supabaseAnonKey;

      if (!url || !key || d.config.demoMode) {
        // Offline / Demo Sync simulation
        this.setSyncStatus('synced');
        this.isSyncing = false;
        return { ok: true, status: 'synced', mode: 'demo' };
      }

      const token = await this.refreshSessionIfNeeded();
      if (!token) throw new Error('Authentication session expired. Please sign in again.');

      // 1. Fetch remote user library
      const pullRes = await fetch(`${url}/rest/v1/user_libraries?user_id=eq.${encodeURIComponent(d.user.id)}&select=*`, {
        method: 'GET',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${token}`
        }
      });

      if (!pullRes.ok) {
        throw new Error(`Cloud read failed: HTTP ${pullRes.status}`);
      }

      const remoteRows = await pullRes.json();
      const remoteRecord = Array.isArray(remoteRows) && remoteRows[0] ? remoteRows[0] : null;

      const localData = this.store ? this.store.all() : {};
      const merged = this.mergeLibraries(localData, remoteRecord);

      // Apply merged library to local store
      if (this.store && typeof this.store.applyRemote === 'function') {
        this.store.applyRemote(merged);
        this.emit('library-merged', this.store.all());
      }

      // 2. Push merged state back to Supabase
      const pushRes = await fetch(`${url}/rest/v1/user_libraries`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          user_id: d.user.id,
          favorites: merged.favorites,
          playlists: merged.playlists,
          settings: merged.settings,
          play_stats: merged.playStats,
          lyrics_offsets: merged.lyricsOffsets,
          client_version: '1.1.7',
          updated_at: new Date().toISOString()
        })
      });

      if (!pushRes.ok) {
        throw new Error(`Cloud write failed: HTTP ${pushRes.status}`);
      }

      this.setSyncStatus('synced');
      this.isSyncing = false;
      return { ok: true, status: 'synced' };
    } catch (err) {
      this.isSyncing = false;
      const isOffline = err.message && (err.message.includes('fetch failed') || err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED'));
      this.setSyncStatus(isOffline ? 'offline' : 'error', err.message);
      return { ok: false, error: err.message, offline: isOffline };
    }
  }

  async pushToCloud() {
    if (!this.isLoggedIn() || this.isSyncing) return;
    const d = this.load();
    const url = d.config.supabaseUrl;
    const key = d.config.supabaseAnonKey;
    if (!url || !key || d.config.demoMode) {
      this.setSyncStatus('synced');
      return;
    }

    try {
      this.setSyncStatus('syncing');
      const token = await this.refreshSessionIfNeeded();
      if (!token) return;

      const localData = this.store ? this.store.all() : {};
      const res = await fetch(`${url}/rest/v1/user_libraries`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          user_id: d.user.id,
          favorites: localData.favorites || [],
          playlists: localData.playlists || [],
          settings: localData.settings || {},
          play_stats: localData.playStats || {},
          lyrics_offsets: localData.lyricsOffsets || {},
          client_version: '1.1.7',
          updated_at: new Date().toISOString()
        })
      });

      if (res.ok) {
        this.setSyncStatus('synced');
      } else {
        this.setSyncStatus('error', `Cloud sync failed: HTTP ${res.status}`);
      }
    } catch (err) {
      const isOffline = err.message && (err.message.includes('fetch failed') || err.message.includes('ENOTFOUND'));
      this.setSyncStatus(isOffline ? 'offline' : 'error', err.message);
    }
  }
}

const authSync = new AuthSyncEngine();
module.exports = authSync;
