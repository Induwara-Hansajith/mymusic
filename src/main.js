const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, session } = require('electron');
const path = require('path');
const fs = require('fs');

const store = require('./lib/store');
const ytm = require('./lib/ytm');
const downloader = require('./lib/downloader');
const importer = require('./lib/importer');

app.setAppUserModelId('com.mymusic.app');

function log(...args) {
  const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log('[main]', line);
}

process.on('uncaughtException', (e) => console.error('[crash]', e));

// Single instance lock: prevent orphaned background copies and focus existing window
let mainWindow = null;
let tray = null;
let appIsQuitting = false;
let currentPlaybackStatus = { playing: false, title: '', artist: '' };

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  log('Another instance is already running; focusing existing instance and quitting');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Windows thumbar buttons
let icons = null;
function loadThumbarIcons() {
  if (icons) return icons;
  try {
    const dir = path.join(__dirname, '..', 'build', 'thumbar');
    icons = {
      play: nativeImage.createFromPath(path.join(dir, 'play.png')),
      pause: nativeImage.createFromPath(path.join(dir, 'pause.png')),
      prev: nativeImage.createFromPath(path.join(dir, 'prev.png')),
      next: nativeImage.createFromPath(path.join(dir, 'next.png'))
    };
  } catch (e) {
    log('Failed to load thumbar icons:', e.message);
  }
  return icons;
}

function updateThumbar(playing) {
  if (!mainWindow || mainWindow.isDestroyed() || process.platform !== 'win32') return;
  const ic = loadThumbarIcons();
  if (!ic) return;
  try {
    mainWindow.setThumbarButtons([
      {
        tooltip: 'Previous',
        icon: ic.prev,
        click: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('cmd:prev'); }
      },
      {
        tooltip: playing ? 'Pause' : 'Play',
        icon: playing ? ic.pause : ic.play,
        click: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('cmd:toggle'); }
      },
      {
        tooltip: 'Next',
        icon: ic.next,
        click: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('cmd:next'); }
      }
    ]);
  } catch {
    // Ignore thumbar updates before window is ready or if not supported
  }
}

function createTray() {
  if (tray) return;
  try {
    const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
    const trayIcon = fs.existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath)
      : nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.png'));
    tray = new Tray(trayIcon);
    tray.setToolTip('My Music');
    updateTrayMenu();

    tray.on('click', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isVisible()) {
        if (mainWindow.isFocused()) mainWindow.hide();
        else mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (e) {
    log('Tray creation skipped/failed:', (e && e.message) || e);
  }
}

function updateTrayMenu() {
  if (!tray) return;
  const trackInfo = currentPlaybackStatus.title
    ? `${currentPlaybackStatus.title} — ${currentPlaybackStatus.artist || 'Unknown'}`
    : 'No track playing';

  const contextMenu = Menu.buildFromTemplate([
    { label: trackInfo.length > 42 ? trackInfo.slice(0, 42) + '…' : trackInfo, enabled: false },
    { type: 'separator' },
    {
      label: currentPlaybackStatus.playing ? 'Pause' : 'Play',
      click: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('cmd:toggle'); }
    },
    {
      label: 'Next Track',
      click: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('cmd:next'); }
    },
    {
      label: 'Previous Track',
      click: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('cmd:prev'); }
    },
    { type: 'separator' },
    {
      label: (mainWindow && mainWindow.isVisible()) ? 'Hide Window' : 'Show Window',
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (mainWindow.isVisible()) mainWindow.hide();
        else { mainWindow.show(); mainWindow.focus(); }
      }
    },
    {
      label: 'Quit My Music',
      click: () => {
        appIsQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  if (currentPlaybackStatus.title) {
    tray.setToolTip(`My Music: ${trackInfo}`.slice(0, 127));
  } else {
    tray.setToolTip('My Music');
  }
}

function updatePlayerStatus(p) {
  currentPlaybackStatus = {
    playing: !!p.playing,
    title: p.title || '',
    artist: p.artist || ''
  };
  updateThumbar(currentPlaybackStatus.playing);
  updateTrayMenu();
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#0b0d12',
    title: 'My Music',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false
    }
  });

  mainWindow = win;

  win.on('close', (e) => {
    if (appIsQuitting) return;
    try {
      const s = store.all();
      const closeToTray = s && s.settings && s.settings.closeToTray;
      if (closeToTray) {
        e.preventDefault();
        win.hide();
        updateTrayMenu();
      }
    } catch { /* proceed with normal close */ }
  });

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    updateThumbar(false);
    log('window visible');
  });

  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show();
      win.focus();
      log('fallback window show triggered');
    }
  }, 400);

  win.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('[main] load failed:', code, desc);
  });

  win.webContents.on('render-process-gone', (e, details) => {
    console.error('[main] render process gone:', details);
  });

  // Navigation hardening: no popups, no off-app navigation.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!String(url).startsWith('file://')) e.preventDefault();
  });

  win.webContents.on('console-message', (...args) => {
    try {
      const p = args[1];
      let msg = null;
      if (typeof args[2] === 'string') msg = args[2];
      else if (p && typeof p === 'object') msg = p.message || JSON.stringify(p).slice(0, 300);
      if (msg) log('[renderer]', msg.slice(0, 300));
    } catch { /* ignore logging failures */ }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

const ok = (data) => ({ ok: true, data });
const fail = (e) => ({ ok: false, error: (e && e.message) || String(e) });

const wrap = (fn) => async (_ev, payload) => {
  try { return ok(await fn(payload || {})); }
  catch (e) { console.error('[ipc] failed:', (e && e.message) || e); return fail(e); }
};

ipcMain.handle('ytm:search', wrap((p) => ytm.search(p.query, p.filter)));
ipcMain.handle('ytm:suggestions', wrap((p) => ytm.suggestions(p.query)));
ipcMain.handle('ytm:home', wrap(() => ytm.home()));
ipcMain.handle('ytm:album', wrap((p) => ytm.album(p.id)));
ipcMain.handle('ytm:artist', wrap((p) => ytm.artist(p.id)));
ipcMain.handle('ytm:playlist', wrap((p) => ytm.playlist(p.id)));
ipcMain.handle('ytm:stream', wrap((p) => ytm.stream(p.id)));
ipcMain.handle('ytm:lyrics', wrap((p) => ytm.lyrics(p.track)));
ipcMain.handle('ytm:translate', wrap((p) => ytm.translate(p.text, p.targetLang)));
ipcMain.handle('ytm:radio', wrap((p) => ytm.radio(p.id)));
ipcMain.handle('library:get', wrap(() => store.all()));
ipcMain.handle('library:mutate', wrap((p) => store.mutate(p)));
ipcMain.handle('window:setMiniMode', wrap((p) => setMiniMode(p && p.enable)));
ipcMain.handle('presence:update', wrap((p) => updatePresence(p)));

// New features: Downloader, Importer, Player Status
ipcMain.handle('download:start', wrap((p) => downloader.downloadTrack(p.track)));
ipcMain.handle('download:list', wrap(() => downloader.list()));
ipcMain.handle('download:reveal', wrap((p) => downloader.reveal(p.path)));
ipcMain.handle('import:url', wrap((p) => importer.resolveUrl(p.url)));
ipcMain.handle('import:csv', wrap((p) => importer.parseCsv(p.text)));
ipcMain.handle('import:match', wrap((p) => importer.matchTracks(p.rows)));
ipcMain.handle('player:status', wrap((p) => updatePlayerStatus(p)));

let isMiniMode = false;
let normalBounds = null;

function setMiniMode(enable) {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return false;
  const target = typeof enable === 'boolean' ? enable : !isMiniMode;
  if (target === isMiniMode) return isMiniMode;
  isMiniMode = target;

  if (isMiniMode) {
    if (win.isMaximized()) win.unmaximize();
    normalBounds = win.getBounds();
    win.setMinimumSize(360, 135);
    win.setSize(380, 140);
    win.setResizable(false);
    win.setAlwaysOnTop(true, 'floating');
  } else {
    win.setAlwaysOnTop(false);
    win.setResizable(true);
    win.setMinimumSize(1000, 640);
    if (normalBounds) {
      win.setBounds(normalBounds);
    } else {
      win.setSize(1360, 860);
    }
  }
  return isMiniMode;
}

let rpcClient = null;
let rpcConnecting = false;
let lastRpcAttempt = 0;
const DISCORD_CLIENT_ID = '1024541825978839120';

async function getDiscordClient() {
  if (rpcClient && rpcClient.user) return rpcClient;
  if (rpcConnecting) return null;
  if (Date.now() - lastRpcAttempt < 20000) return null;
  rpcConnecting = true;
  lastRpcAttempt = Date.now();
  try {
    const { Client } = require('@xhayper/discord-rpc');
    const client = new Client({ clientId: DISCORD_CLIENT_ID });
    client.on('ready', () => log('Discord RPC ready'));
    await client.login();
    rpcClient = client;
    return rpcClient;
  } catch (e) {
    log('Discord RPC login skipped:', (e && e.message) || e);
    rpcClient = null;
    return null;
  } finally {
    rpcConnecting = false;
  }
}

async function updatePresence(data) {
  try {
    const client = await getDiscordClient();
    if (!client || !client.user) return;
    if (!data || !data.title) {
      await client.user.clearActivity().catch(() => {});
      return;
    }
    const activity = {
      details: String(data.title).slice(0, 128),
      state: String(data.artist || 'Unknown Artist').slice(0, 128),
      largeImageKey: data.thumb || 'logo',
      largeImageUrl: data.thumb || undefined,
      largeImageText: String(data.album || data.title).slice(0, 128),
      smallImageKey: data.playing ? 'play' : 'pause',
      smallImageText: data.playing ? 'Playing' : 'Paused',
      instance: false
    };
    if (data.playing && data.duration && data.progress != null) {
      const now = Math.floor(Date.now());
      activity.startTimestamp = Math.floor(now - (data.progress * 1000));
      activity.endTimestamp = Math.floor(now + ((data.duration - data.progress) * 1000));
    }
    await client.user.setActivity(activity).catch(() => {});
  } catch (e) {
    log('presence update failed:', (e && e.message) || e);
  }
}

app.whenReady().then(() => {
  // CORS bypass on audio streams for Web Audio BiquadFilterNodes (EQ)
  try {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = Object.assign({}, details.responseHeaders);
      if (details.url.includes('googlevideo.com') || details.url.includes('youtube.com')) {
        responseHeaders['access-control-allow-origin'] = ['*'];
        responseHeaders['access-control-allow-headers'] = ['*'];
        responseHeaders['access-control-allow-methods'] = ['GET, HEAD, OPTIONS'];
      }
      callback({ responseHeaders });
    });
  } catch (e) {
    log('Failed to configure CORS interceptor:', e.message);
  }

  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  appIsQuitting = true;
});

app.on('window-all-closed', () => {
  const s = store.all();
  const closeToTray = s && s.settings && s.settings.closeToTray;
  if (!closeToTray || appIsQuitting) {
    app.quit();
  }
});
