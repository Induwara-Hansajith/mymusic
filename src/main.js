const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, session, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { autoUpdater } = require('electron-updater');

const store = require('./lib/store');
const ytm = require('./lib/ytm');
const downloader = require('./lib/downloader');
const importer = require('./lib/importer');

app.setAppUserModelId('com.induw.mymusic');

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
let updateInterval = null;
let pendingUpdateInfo = null;
let updateDownloadedInfo = null;
let updateCheckIsManual = false;
let updateCheckInProgress = false;
let installAfterDownload = false;
let updateDownloadStarted = false;

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
    const playImg = nativeImage.createFromPath(path.join(dir, 'play.png'));
    const pauseImg = nativeImage.createFromPath(path.join(dir, 'pause.png'));
    const prevImg = nativeImage.createFromPath(path.join(dir, 'prev.png'));
    const nextImg = nativeImage.createFromPath(path.join(dir, 'next.png'));
    if (!playImg.isEmpty() && !pauseImg.isEmpty() && !prevImg.isEmpty() && !nextImg.isEmpty()) {
      icons = { play: playImg, pause: pauseImg, prev: prevImg, next: nextImg };
    }
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
    const pngPath = path.join(__dirname, '..', 'build', 'icon.png');
    let trayIcon = null;
    if (fs.existsSync(iconPath)) {
      trayIcon = nativeImage.createFromPath(iconPath);
    } else if (fs.existsSync(pngPath)) {
      trayIcon = nativeImage.createFromPath(pngPath);
    }
    if (!trayIcon || trayIcon.isEmpty()) {
      log('Tray icon file missing or empty, skipping tray creation');
      return;
    }
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
    icon: fs.existsSync(path.join(__dirname, '..', 'build', 'icon.png'))
      ? path.join(__dirname, '..', 'build', 'icon.png')
      : undefined,
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
  const appUrl = pathToFileURL(path.join(__dirname, 'renderer', 'index.html')).href;
  win.webContents.on('will-navigate', (e, url) => {
    // Single-page app: only the packaged page may ever be navigated to.
    if (url !== appUrl) e.preventDefault();
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

function updaterSupported() {
  if (!app.isPackaged || process.platform !== 'win32' || process.env.PORTABLE_EXECUTABLE_DIR) return false;
  const updateConfig = path.join(process.resourcesPath, 'app-update.yml');
  if (!fs.existsSync(updateConfig)) return false;
  // The NSIS installer creates an uninstaller beside the app executable. ZIP and
  // portable builds do not have this marker and must be updated manually.
  try {
    return fs.readdirSync(path.dirname(process.execPath)).some(name => /^uninstall.*\.exe$/i.test(name));
  } catch {
    return false;
  }
}

function sendUpdateEvent(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function showUpdateNotification(info) {
  if (!Notification.isSupported()) return;
  try {
    const options = {
      title: 'My Music update available',
      body: `Version ${info.version} is ready. Open My Music to choose Update now or Later.`
    };
    const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
    if (fs.existsSync(iconPath)) options.icon = iconPath;
    const notification = new Notification(options);
    notification.on('click', focusMainWindow);
    notification.show();
  } catch (e) {
    log('Update notification could not be shown:', e.message);
  }
}

async function checkForUpdate(manual = true) {
  if (!updaterSupported()) throw new Error('Automatic updates are available only in the installed Windows Setup version.');
  const currentSettings = store.all().settings || {};
  if (!manual && currentSettings.autoUpdate === false) return { skipped: true };
  if (updateCheckInProgress) return { checking: true };
  if (manual && currentSettings.updateDeferredVersion) {
    store.mutate({ type: 'settings.set', patch: { updateDeferredVersion: '' } });
  }
  updateCheckIsManual = !!manual;
  updateCheckInProgress = true;
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    updateCheckInProgress = false;
    updateCheckIsManual = false;
    throw error;
  }
  return { checking: true };
}

function startUpdateChecker() {
  if (!updaterSupported()) {
    log('Auto-updater disabled for development, portable, and ZIP builds');
    return;
  }
  const currentSettings = store.all().settings || {};
  autoUpdater.autoDownload = currentSettings.autoUpdate !== false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on('update-available', (info) => {
    updateCheckInProgress = false;
    pendingUpdateInfo = { version: String(info.version || '') };
    const deferred = (store.all().settings || {}).updateDeferredVersion;
    if (deferred && deferred === pendingUpdateInfo.version) {
      log('Update remains deferred:', pendingUpdateInfo.version);
      updateCheckIsManual = false;
      return;
    }
    const isManual = updateCheckIsManual;
    sendUpdateEvent('updates:available', {
      version: pendingUpdateInfo.version,
      manual: isManual,
      autoDownloading: autoUpdater.autoDownload
    });
    if (isManual && (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible())) {
      showUpdateNotification(pendingUpdateInfo);
    }
    updateCheckIsManual = false;
  });
  autoUpdater.on('update-not-available', (info) => {
    updateCheckInProgress = false;
    if (updateCheckIsManual) sendUpdateEvent('updates:not-available', { version: info && info.version });
    updateCheckIsManual = false;
  });
  autoUpdater.on('download-progress', (progress) => {
    updateDownloadStarted = true;
    sendUpdateEvent('updates:progress', {
      percent: Math.max(0, Math.min(100, Number(progress.percent) || 0)),
      bytesPerSecond: Number(progress.bytesPerSecond) || 0,
      transferred: Number(progress.transferred) || 0,
      total: Number(progress.total) || 0
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    updateDownloadStarted = false;
    updateDownloadedInfo = { version: String((info && info.version) || (pendingUpdateInfo && pendingUpdateInfo.version) || '') };
    log('Update downloaded in background:', updateDownloadedInfo.version);
    // Silent installation on exit is enabled once downloaded
    autoUpdater.autoInstallOnAppQuit = true;
    sendUpdateEvent('updates:downloaded', {
      version: updateDownloadedInfo.version,
      playing: currentPlaybackStatus.playing
    });
    if (installAfterDownload) {
      if (currentPlaybackStatus.playing) {
        log('Update downloaded; playback is active, deferring restart to prevent interrupting music.');
        installAfterDownload = false;
        sendUpdateEvent('updates:deferred-for-playback', { version: updateDownloadedInfo.version });
      } else {
        installAfterDownload = false;
        log('Playback idle; restarting to install update', updateDownloadedInfo.version);
        appIsQuitting = true;
        autoUpdater.quitAndInstall(false, true);
      }
    }
  });
  autoUpdater.on('error', (error) => {
    updateCheckInProgress = false;
    let message = String((error && error.message) || 'Update check failed');
    if (message.includes('Cannot find latest.yml') || message.includes('latest.yml') || message.includes('HttpError: 404')) {
      message = 'Update error: release manifest (latest.yml) is missing from the GitHub release.';
    } else if (message.includes('net::ERR_') || message.includes('ENOTFOUND') || message.includes('ETIMEDOUT')) {
      message = 'Unable to reach update server. Check your connection.';
    } else {
      message = message.split('\n')[0].slice(0, 140);
    }
    log('Auto-updater error:', message);
    sendUpdateEvent('updates:error', { message, manual: updateCheckIsManual || updateDownloadStarted });
    updateCheckIsManual = false;
    updateDownloadStarted = false;
    installAfterDownload = false;
  });

  setTimeout(() => checkForUpdate(false).catch((e) => log('Initial update check failed:', e.message)), 12000);
  updateInterval = setInterval(() => {
    checkForUpdate(false).catch((e) => log('Scheduled update check failed:', e.message));
  }, 6 * 60 * 60 * 1000);
}

ipcMain.handle('updates:get-status', wrap(() => ({
  supported: updaterSupported(),
  enabled: (store.all().settings || {}).autoUpdate !== false,
  downloaded: !!updateDownloadedInfo,
  downloading: updateDownloadStarted,
  version: updateDownloadedInfo ? updateDownloadedInfo.version : (pendingUpdateInfo ? pendingUpdateInfo.version : null),
  playing: currentPlaybackStatus.playing
})));
ipcMain.handle('updates:check', wrap((p) => {
  const currentSettings = store.all().settings || {};
  autoUpdater.autoDownload = currentSettings.autoUpdate !== false;
  return checkForUpdate(p.manual !== false);
}));
ipcMain.handle('updates:defer', wrap((p) => {
  const version = String(p.version || '').slice(0, 32);
  if (!version) throw new Error('Update version is missing.');
  store.mutate({ type: 'settings.set', patch: { updateDeferredVersion: version } });
  return true;
}));
ipcMain.handle('updates:install', wrap(async (p) => {
  if (!updaterSupported() || (!updateDownloadedInfo && !pendingUpdateInfo)) {
    throw new Error('There is no update ready to download.');
  }
  if (updateDownloadedInfo) {
    const force = !!(p && p.force);
    if (currentPlaybackStatus.playing && !force) {
      return { ready: true, playing: true, promptConfirm: true, version: updateDownloadedInfo.version };
    }
    log('Restarting application to apply update now...');
    appIsQuitting = true;
    autoUpdater.quitAndInstall(false, true);
    return { installing: true };
  }
  if (updateDownloadStarted) return { downloading: true };
  updateDownloadStarted = true;
  installAfterDownload = !(p && p.background);
  try {
    await autoUpdater.downloadUpdate();
    return { downloading: true };
  } catch (error) {
    updateDownloadStarted = false;
    installAfterDownload = false;
    throw error;
  }
}));

ipcMain.handle('ytm:search', wrap((p) => ytm.search(p.query, p.filter)));
ipcMain.handle('ytm:suggestions', wrap((p) => ytm.suggestions(p.query)));
ipcMain.handle('ytm:home', wrap(() => ytm.home()));
ipcMain.handle('ytm:album', wrap((p) => ytm.album(p.id)));
ipcMain.handle('ytm:artist', wrap((p) => ytm.artist(p.id)));
ipcMain.handle('ytm:artist-thumb', wrap((p) => ytm.artistThumb(p && p.name, p && p.artistId)));
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
    session.defaultSession.webRequest.onHeadersReceived({ urls: ['*://*.googlevideo.com/*', '*://*.youtube.com/*'] }, (details, callback) => {
      try {
        if (!details) {
          callback({});
          return;
        }
        const responseHeaders = Object.assign({}, details.responseHeaders);
        const url = details.url || '';
        if (typeof url === 'string' && (url.includes('googlevideo.com') || url.includes('youtube.com'))) {
          responseHeaders['access-control-allow-origin'] = ['*'];
          responseHeaders['access-control-allow-headers'] = ['*'];
          responseHeaders['access-control-allow-methods'] = ['GET, HEAD, OPTIONS'];
        }
        callback({ responseHeaders });
      } catch (err) {
        callback({ responseHeaders: (details && details.responseHeaders) || {} });
      }
    });
  } catch (e) {
    log('Failed to configure CORS interceptor:', e.message);
  }

  createWindow();
  createTray();
  startUpdateChecker();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  appIsQuitting = true;
  if (updateInterval) clearInterval(updateInterval);
});

app.on('window-all-closed', () => {
  const s = store.all();
  const closeToTray = s && s.settings && s.settings.closeToTray;
  if (!closeToTray || appIsQuitting) {
    app.quit();
  }
});
