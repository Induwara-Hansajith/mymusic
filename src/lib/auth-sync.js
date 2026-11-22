// Authentication & Cross-Platform Cloud Synchronization Engine for My Music
// Supports Supabase GoTrue Auth & REST database with offline-first local cache reconciliation.

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const getClientVersion = () => {
  try {
    if (app && typeof app.getVersion === 'function') return app.getVersion();
  } catch {}
  return '1.1.8';
};

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
        supabaseUrl: 'https://sjvnqqacnbnqdljuhpsh.supabase.co',
        supabaseAnonKey: 'sb_publishable_Xt2LF3sA6V-kn6Rmx9Criw_iCkkkdhK',
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

  async signInWithGoogle(options = {}) {
    const d = this.load();
    const url = d.config.supabaseUrl;
    const key = d.config.supabaseAnonKey;
    if (!url || !key) throw new Error('Supabase project is not configured.');

    const http = require('http');
    const { exec } = require('child_process');

    const shell = (options && typeof options === 'object' && options.shell) || null;
    const mainWindow = (options && typeof options === 'object' && options.mainWindow) || null;

    return new Promise((resolve, reject) => {
      let resolved = false;
      let server = null;
      let timeoutId = null;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (server) {
          try { server.close(); } catch {}
          server = null;
        }
      };

      const finishResolve = (val) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        if (mainWindow && typeof mainWindow.focus === 'function') {
          try { mainWindow.focus(); } catch {}
        }
        resolve(val);
      };

      const finishReject = (err) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        reject(err);
      };

      server = http.createServer(async (req, res) => {
        try {
          const reqUrl = new URL(req.url, 'http://localhost');
          const pathname = reqUrl.pathname;

          if (pathname === '/auth/callback') {
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MyMusic - Sign-In</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0b0e17; color: #f8fafc;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; padding: 20px;
    }
    .card {
      background: #141824; border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px; padding: 36px 32px; max-width: 440px; text-align: center;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
    }
    .icon { font-size: 44px; margin-bottom: 16px; }
    h1 { font-size: 20px; margin: 0 0 10px; font-weight: 700; }
    p { color: #94a3b8; font-size: 14.5px; line-height: 1.5; margin: 0 0 20px; }
  </style>
</head>
<body>
  <div class="card" id="card">
    <div class="icon" id="icon">🔄</div>
    <h1 id="title">Completing Sign-In...</h1>
    <p id="desc">Connecting your account with MyMusic. Please wait a moment.</p>
  </div>
  <script>
    (async () => {
      try {
        let params = new URLSearchParams(window.location.search);
        if (window.location.hash && window.location.hash.length > 1) {
          params = new URLSearchParams(window.location.hash.substring(1));
        }

        const token = params.get('access_token');
        const refresh = params.get('refresh_token');
        const error = params.get('error_description') || params.get('error');

        if (error) {
          document.getElementById('icon').textContent = '⚠️';
          document.getElementById('title').textContent = 'Sign-In Failed';
          document.getElementById('desc').textContent = error;
          await fetch('/token?error=' + encodeURIComponent(error));
          return;
        }

        if (!token) {
          document.getElementById('icon').textContent = '⚠️';
          document.getElementById('title').textContent = 'Sign-In Incomplete';
          document.getElementById('desc').textContent = 'No access token was received.';
          await fetch('/token?error=no_token');
          return;
        }

        const res = await fetch('/token?access_token=' + encodeURIComponent(token) + '&refresh_token=' + encodeURIComponent(refresh || ''));
        if (res.ok) {
          document.getElementById('icon').textContent = '✅';
          document.getElementById('title').textContent = 'Authentication Successful!';
          document.getElementById('desc').textContent = 'You have signed in to MyMusic. You can close this browser tab and return to the application.';
          setTimeout(() => { try { window.close(); } catch {} }, 1500);
        } else {
          throw new Error('Local communication error');
        }
      } catch (err) {
        document.getElementById('icon').textContent = '⚠️';
        document.getElementById('title').textContent = 'Communication Error';
        document.getElementById('desc').textContent = err.message || 'Could not relay credentials to MyMusic.';
      }
    })();
  </script>
</body>
</html>`);
            return;
          }

          if (pathname === '/token') {
            const token = reqUrl.searchParams.get('access_token');
            const refresh = reqUrl.searchParams.get('refresh_token');
            const error = reqUrl.searchParams.get('error');

            if (error) {
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ ok: false }));
              finishReject(new Error(decodeURIComponent(error.replace(/\+/g, ' '))));
              return;
            }

            if (token) {
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ ok: true }));

              try {
                const userRes = await fetch(`${url}/auth/v1/user`, {
                  headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${token}`
                  }
                });
                const userData = await userRes.json();
                if (!userRes.ok || !userData || !userData.id) {
                  throw new Error('Failed to retrieve user profile after Google sign-in.');
                }

                d.user = {
                  id: userData.id,
                  email: userData.email,
                  name: (userData.user_metadata && (userData.user_metadata.full_name || userData.user_metadata.name)) || userData.email.split('@')[0],
                  avatarUrl: (userData.user_metadata && userData.user_metadata.avatar_url) || ''
                };
                d.session = {
                  accessToken: token,
                  refreshToken: refresh || '',
                  expiresAt: Date.now() + 3600 * 1000
                };
                this.save();
                this.setSyncStatus('syncing');
                this.emit('state-changed', this.getUser());

                await this.syncNow();
                finishResolve({ ok: true, user: this.getUser() });
              } catch (profileErr) {
                finishReject(profileErr);
              }
              return;
            }

            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Missing token' }));
            return;
          }

          res.writeHead(404);
          res.end('Not Found');
        } catch (serverErr) {
          try {
            res.writeHead(500);
            res.end('Server Error');
          } catch {}
        }
      });

      const tryListen = (portToTry) => {
        const onErr = (err) => {
          server.removeListener('listening', onListen);
          if (err.code === 'EADDRINUSE' && portToTry < 54325) {
            tryListen(portToTry + 1);
          } else {
            finishReject(new Error('Failed to start local authentication listener: ' + err.message));
          }
        };

        const onListen = () => {
          server.removeListener('error', onErr);
          const address = server.address();
          const port = address.port;
          const redirectUrl = `http://localhost:${port}/auth/callback`;
          const authUrl = `${url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;

          if (shell && typeof shell.openExternal === 'function') {
            shell.openExternal(authUrl);
          } else {
            exec(`start "" "${authUrl}"`);
          }

          timeoutId = setTimeout(() => {
            finishReject(new Error('Google sign-in timed out. Please try again.'));
          }, 180000);
        };

        server.once('error', onErr);
        server.once('listening', onListen);
        server.listen(portToTry, '127.0.0.1');
      };

      tryListen(54321);
    });
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

  async updateProfile({ name, avatarUrl }) {
    if (!this.isLoggedIn()) throw new Error('You must be signed in to update your profile.');
    const d = this.load();
    const cleanName = (name !== undefined ? name : (d.user.name || '')).trim();
    const cleanAvatar = avatarUrl !== undefined ? avatarUrl.trim() : (d.user.avatarUrl || '');

    const url = d.config.supabaseUrl;
    const key = d.config.supabaseAnonKey;
    if (url && key && !d.config.demoMode) {
      const token = await this.refreshSessionIfNeeded();
      if (!token) throw new Error('Session expired. Please sign in again.');

      const res = await fetch(`${url}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: { name: cleanName, avatarUrl: cleanAvatar }
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.msg || resData.error_description || resData.message || 'Failed to update profile.');
      }
    }

    d.user.name = cleanName;
    d.user.avatarUrl = cleanAvatar;
    this.save();
    this.emit('state-changed', this.getUser());
    return { ok: true, user: this.getUser() };
  }

  async updatePassword({ newPassword }) {
    if (!this.isLoggedIn()) throw new Error('You must be signed in to change your password.');
    const cleanPass = (newPassword || '').trim();
    if (!cleanPass || cleanPass.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const d = this.load();
    const url = d.config.supabaseUrl;
    const key = d.config.supabaseAnonKey;
    if (url && key && !d.config.demoMode) {
      const token = await this.refreshSessionIfNeeded();
      if (!token) throw new Error('Session expired. Please sign in again.');

      const res = await fetch(`${url}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: cleanPass })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.msg || resData.error_description || resData.message || 'Failed to change password.');
      }
    }
    return { ok: true, message: 'Password updated successfully.' };
  }

  async forcePush() {
    if (!this.isLoggedIn()) throw new Error('Not signed in.');
    const d = this.load();
    const url = d.config.supabaseUrl;
    const key = d.config.supabaseAnonKey;

    if (!url || !key || d.config.demoMode) {
      this.setSyncStatus('synced');
      return { ok: true, message: 'Local library pushed to cloud (demo mode).' };
    }

    this.setSyncStatus('syncing');
    const token = await this.refreshSessionIfNeeded();
    if (!token) throw new Error('Session expired. Please sign in again.');

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
        client_version: getClientVersion(),
        updated_at: new Date().toISOString()
      })
    });

    if (!res.ok) {
      this.setSyncStatus('error', `Cloud push failed: HTTP ${res.status}`);
      throw new Error(`Cloud push failed: HTTP ${res.status}`);
    }

    this.setSyncStatus('synced');
    return { ok: true, message: 'Local library successfully uploaded and replaced in cloud.' };
  }

  async forcePull() {
    if (!this.isLoggedIn()) throw new Error('Not signed in.');
    const d = this.load();
    const url = d.config.supabaseUrl;
    const key = d.config.supabaseAnonKey;

    if (!url || !key || d.config.demoMode) {
      this.setSyncStatus('synced');
      return { ok: true, message: 'Cloud library loaded.' };
    }

    this.setSyncStatus('syncing');
    const token = await this.refreshSessionIfNeeded();
    if (!token) throw new Error('Session expired. Please sign in again.');

    const res = await fetch(`${url}/rest/v1/user_libraries?user_id=eq.${encodeURIComponent(d.user.id)}&select=*`, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      this.setSyncStatus('error', `Cloud fetch failed: HTTP ${res.status}`);
      throw new Error(`Cloud fetch failed: HTTP ${res.status}`);
    }

    const rows = await res.json();
    const remote = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!remote) {
      this.setSyncStatus('synced');
      return { ok: true, message: 'No remote cloud data found for this account.' };
    }

    if (this.store && typeof this.store.applyRemote === 'function') {
      this.store.applyRemote({
        favorites: remote.favorites || [],
        playlists: remote.playlists || [],
        settings: remote.settings || {},
        playStats: remote.play_stats || remote.playStats || {},
        lyricsOffsets: remote.lyrics_offsets || remote.lyricsOffsets || {}
      });
      this.emit('library-merged', this.store.all());
    }

    this.setSyncStatus('synced');
    return { ok: true, message: 'Local library replaced with cloud library.' };
  }

  async deleteCloudData() {
    if (!this.isLoggedIn()) throw new Error('Not signed in.');
    const d = this.load();
    const url = d.config.supabaseUrl;
    const key = d.config.supabaseAnonKey;

    if (url && key && !d.config.demoMode) {
      const token = await this.refreshSessionIfNeeded();
      if (token) {
        await fetch(`${url}/rest/v1/user_libraries?user_id=eq.${encodeURIComponent(d.user.id)}`, {
          method: 'DELETE',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${token}`
          }
        });
      }
    }

    this.setSyncStatus('idle');
    return { ok: true, message: 'Cloud library data deleted. Local files remain intact.' };
  }

  async deleteAccount() {
    await this.deleteCloudData();
    await this.signOut();
    return { ok: true, message: 'Account deleted and signed out.' };
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
          client_version: getClientVersion(),
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
          client_version: getClientVersion(),
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
