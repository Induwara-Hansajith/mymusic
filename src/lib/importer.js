const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ytm = require('./ytm');

function getYtDlpPath() {
  const exeName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  try {
    const electron = require('electron');
    if (electron && electron.app && electron.app.isPackaged) {
      const packagedPath = path.join(process.resourcesPath, 'bin', exeName);
      if (fs.existsSync(packagedPath)) {
        if (process.platform !== 'win32') {
          try { fs.chmodSync(packagedPath, 0o755); } catch {}
        }
        return packagedPath;
      }
    }
  } catch {}
  const devPath = path.join(__dirname, '..', '..', 'bin', exeName);
  if (fs.existsSync(devPath)) {
    if (process.platform !== 'win32') {
      try { fs.chmodSync(devPath, 0o755); } catch {}
    }
    return devPath;
  }

  if (process.platform !== 'win32') {
    const systemPaths = ['/usr/bin/yt-dlp', '/usr/local/bin/yt-dlp', '/opt/homebrew/bin/yt-dlp'];
    for (const p of systemPaths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return exeName;
}

function parseCsv(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const first = lines[0];
  const delim = first.includes('\t') ? '\t' : (first.includes(';') ? ';' : ',');

  const splitLine = (l) => {
    const res = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') { inQuotes = !inQuotes; }
      else if (c === delim && !inQuotes) { res.push(cur.trim()); cur = ''; }
      else { cur += c; }
    }
    res.push(cur.trim());
    return res.map(s => s.replace(/^"|"$/g, '').trim());
  };

  const header = splitLine(lines[0]).map(h => h.toLowerCase());
  let titleIdx = header.findIndex(h => /track|title|name|song/i.test(h));
  let artistIdx = header.findIndex(h => /artist|author|singer|creator/i.test(h));
  let albumIdx = header.findIndex(h => /album/i.test(h));

  const hasHeader = (titleIdx >= 0 || artistIdx >= 0);
  const startLine = hasHeader ? 1 : 0;
  if (titleIdx < 0) titleIdx = 0;
  if (artistIdx < 0) artistIdx = 1;

  const rows = [];
  let skipped = 0;
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    const cols = splitLine(line);
    let title = cols[titleIdx] || '';
    let artist = cols[artistIdx] || '';
    let album = (albumIdx >= 0 ? cols[albumIdx] : '') || '';

    // Handle single line "Artist - Title" format
    if (!artist && title.includes(' - ')) {
      const parts = title.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }

    if (title) {
      rows.push({ title, artist, album });
    } else {
      skipped++;
    }
  }
  const result = rows.slice(0, 300);
  result.rows = result;
  result.skipped = skipped;
  return result;
}

function normalizeMediaUrl(raw) {
  const value = String(raw || '').trim();
  if (!value || value.startsWith('-')) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function resolveUrl(url) {
  return new Promise((resolve, reject) => {
    const safeUrl = normalizeMediaUrl(url);
    if (!safeUrl) return reject(new Error('Only http(s) URLs are supported'));
    // '--' ends option parsing so a URL can never be interpreted as a yt-dlp flag.
    const args = ['--flat-playlist', '-J', '--no-warnings', '--', safeUrl];
    const p = spawn(getYtDlpPath(), args, { windowsHide: true });
    let stdout = '', stderr = '';
    const to = setTimeout(() => {
      try { p.kill(); } catch {}
      reject(new Error('Playlist resolution timed out'));
    }, 45000);

    p.stdout.on('data', d => { stdout += d; });
    p.stderr.on('data', d => { stderr += d; });

    p.on('error', err => {
      clearTimeout(to);
      reject(new Error('Failed to run yt-dlp: ' + err.message));
    });

    p.on('close', code => {
      clearTimeout(to);
      if (code === 0 && stdout.trim()) {
        try {
          const data = JSON.parse(stdout);
          const entries = data.entries || [data];
          const rows = entries.filter(Boolean).map(e => ({
            id: e.id || '',
            title: e.title || '',
            artist: e.uploader || e.artist || e.channel || '',
            album: e.album || '',
            duration: e.duration || 0,
            thumb: (e.thumbnails && e.thumbnails[0] && e.thumbnails[0].url) || ''
          })).filter(r => r.title);
          resolve({
            title: data.title || 'Imported Playlist',
            tracks: rows.slice(0, 300),
            rows: rows.slice(0, 300)
          });
        } catch (e) {
          reject(new Error('Failed to parse playlist JSON: ' + e.message));
        }
      } else {
        const err = stderr.trim().split(/\r?\n/).pop() || 'yt-dlp could not read playlist';
        reject(new Error(err.slice(-160)));
      }
    });
  });
}

async function matchTracks(rows) {
  const list = Array.isArray(rows) ? rows : (rows && rows.rows) || [];
  const matched = [];
  for (const r of list.slice(0, 60)) {
    try {
      const q = [r.title, r.artist].filter(Boolean).join(' ');
      const s = await ytm.search(q, 'songs');
      if (s && s.songs && s.songs.length) {
        matched.push(s.songs[0]);
      }
    } catch {}
  }
  return matched;
}

module.exports = { parseCsv, resolveUrl, matchTracks };
