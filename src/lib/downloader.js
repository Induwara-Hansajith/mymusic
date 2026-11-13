const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { shell, app } = require('electron');

let YTDLP = path.join(__dirname, '..', '..', 'bin', 'yt-dlp.exe');
try {
  const electron = require('electron');
  if (electron && electron.app && electron.app.isPackaged) {
    const packagedPath = path.join(process.resourcesPath, 'bin', 'yt-dlp.exe');
    if (fs.existsSync(packagedPath)) YTDLP = packagedPath;
  }
} catch {}

function getFfmpegPath() {
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'zstream', 'ffmpeg', 'ffmpeg.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'zstream', 'ffmpeg', 'ffmpeg.exe')
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

function getDownloadDir() {
  let baseDir;
  try {
    baseDir = app ? app.getPath('music') : path.join(os.homedir(), 'Music');
  } catch {
    baseDir = path.join(os.homedir(), 'Music');
  }
  const dir = path.join(baseDir, 'My Music');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const downloadsFile = () => {
  let dir;
  try {
    dir = app ? app.getPath('userData') : path.join(os.homedir(), '.mymusic');
  } catch {
    dir = path.join(os.homedir(), '.mymusic');
  }
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'mymusic-downloads.json');
};

let downloadsCache = null;

function loadDownloads() {
  if (downloadsCache) return downloadsCache;
  try {
    downloadsCache = JSON.parse(fs.readFileSync(downloadsFile(), 'utf8'));
  } catch {
    downloadsCache = [];
  }
  return downloadsCache;
}

function saveDownloads() {
  try {
    const tmp = downloadsFile() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(loadDownloads(), null, 2));
    fs.renameSync(tmp, downloadsFile());
  } catch (e) {
    console.error('[downloader] save failed:', e.message);
  }
}

async function list() {
  return loadDownloads();
}

function sanitize(name) {
  return String(name || '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
}

function downloadTrack(track) {
  return new Promise((resolve, reject) => {
    if (!track || !track.id) return reject(new Error('Invalid track'));
    const dir = getDownloadDir();
    const safeTitle = sanitize(track.title || 'Unknown');
    const safeArtist = sanitize(track.artist || 'Unknown');
    const outTemplate = path.join(dir, `${safeTitle} - ${safeArtist}.%(ext)s`);

    const ffmpeg = getFfmpegPath();
    const args = [
      '--no-warnings',
      '--no-playlist',
      '--extractor-args', 'youtube:player_client=android'
    ];

    if (ffmpeg) {
      args.push('--ffmpeg-location', ffmpeg, '-x', '--audio-format', 'mp3', '--audio-quality', '0', '--embed-thumbnail', '--add-metadata');
    } else {
      args.push('-f', 'bestaudio[ext=m4a]/bestaudio');
    }

    args.push('-o', outTemplate, `https://www.youtube.com/watch?v=${track.id}`);

    const p = spawn(YTDLP, args, { windowsHide: true });
    let stdout = '', stderr = '';
    const to = setTimeout(() => {
      try { p.kill(); } catch {}
      reject(new Error('Download timed out after 90 seconds'));
    }, 90000);

    p.stdout.on('data', d => { stdout += d; });
    p.stderr.on('data', d => { stderr += d; });

    p.on('error', err => {
      clearTimeout(to);
      reject(err);
    });

    p.on('close', code => {
      clearTimeout(to);
      if (code === 0) {
        const ext = ffmpeg ? 'mp3' : 'm4a';
        let actualPath = path.join(dir, `${safeTitle} - ${safeArtist}.${ext}`);
        if (!fs.existsSync(actualPath)) {
          try {
            const files = fs.readdirSync(dir);
            const found = files.find(f => f.startsWith(safeTitle));
            if (found) actualPath = path.join(dir, found);
          } catch {}
        }
        const record = {
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album || '',
          thumb: track.thumb || '',
          duration: track.duration || 0,
          path: actualPath,
          downloadedAt: Date.now()
        };
        const list = loadDownloads();
        const idx = list.findIndex(d => d.id === track.id);
        if (idx >= 0) list[idx] = record;
        else list.unshift(record);
        saveDownloads();
        resolve(record);
      } else {
        const errLine = stderr.trim().split(/\r?\n/).pop() || 'Download process exited with error';
        reject(new Error(errLine.slice(-160)));
      }
    });
  });
}

function reveal(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  const dir = getDownloadDir();
  shell.openPath(dir);
  return true;
}

module.exports = { list, downloadTrack, reveal, getDownloadDir };
