# My Music

A Spotify-style desktop music player for Windows, powered by YouTube Music.

Search, browse, stream, and download songs, albums, artists, and playlists — with synced lyrics, offline downloads, playlist CSV imports, a 10-band equalizer, reactive audio visualizers, Discord Rich Presence, and a persistent local library.

---

## Features

- **High-Performance Catalog & Search** — Search all categories simultaneously or filter by type (Songs, Videos, Albums, Artists, Playlists). Powered by direct InnerTube protobuf queries via [youtubei.js](https://github.com/LuanRT/YouTube.js) (~700ms response time) with recursive shelf parsing and in-memory LRU caching.
- **Optimized Search Experience** — In-place live rendering without view resets or lost input focus, 0ms tab-switching cache across categories, and autocomplete suggestions with keyboard navigation (`ArrowUp` / `ArrowDown` / `Enter`).
- **Streaming & Resolution** — Audio stream URLs resolved via bundled `bin\yt-dlp.exe` and cached for ~4.5 hours with self-pruning LRU eviction.
- **Offline Downloader** — Download tracks directly to your local music directory with automated ID3/metadata tagging, sanitized filenames, and cover artwork embedding.
- **Playlist CSV Importer** — Import existing playlists and song collections from CSV or plain text tracklists with fuzzy search matching.
- **10-Band EQ & Audio Processing** — Built-in 10-band equalizer, playback speed control (0.5x–2.0x), pitch lock, and listening analytics / play statistics.
- **Enhanced Lyrics** — Synced line highlighting from lrclib.net with fallback to YouTube Music; click-to-seek directly on lyrics, persistent per-track millisecond offset adjustments, and one-click translation.
- **6 Reactive Visualizers** — Liquid, Orbit, Bars (with gravity peak caps), Wave, Silk, and Blob modes responding live to Web Audio API frequencies and bass pulse.
- **Dynamic Accent Palette** — Samples cover artwork colors to dynamically shade glass borders, glows, and theme highlights.
- **Mini Floating Player** — Compact (380×140) always-on-top floating mode with draggable window frame and playback controls.
- **Discord Rich Presence** — Displays current song, artist, album art, and playback timeline in your Discord profile.
- **Local Library** — Favorites, playlists, recently played (last 100), settings, and queue restore saved atomically as JSON (`src/lib/store.js`).

---

## Requirements

- Windows 10/11 (x64)
- [Node.js](https://nodejs.org/) v18+ (for development or building from source)

---

## Quick Start

Double-click **`Start My Music.bat`** — it checks for Node.js, runs `npm install` on first run if needed, and starts the app.

Or run from any terminal:

```bat
npm install
npm start
```

---

## Testing

```bat
# Backend smoke test (search, stream URL resolution, suggestions, synced lyrics)
npm run smoke

# Feature unit test (offline downloader directory, CSV importer parser, 10-band EQ defaults)
node test\test-features.mjs

# Full Electron E2E test via Chrome DevTools Protocol (UI, visualizers, mini mode, playback)
npm run test:e2e
```

---

## Building & Code Signing

My Music produces signed Windows binaries: an NSIS installer, a standalone portable executable, and a zip archive.

### Signed Production Build

Run the automated signing and packaging script:

```bat
powershell -ExecutionPolicy Bypass -File scripts\build-signed.ps1
```

Or standard build:

```bat
npm run dist
```

Outputs are generated in `dist/`:
- `My Music Setup 1.1.1.exe` — Windows NSIS installer with desktop and Start Menu shortcuts.
- `My Music Portable 1.1.1.exe` — Self-contained portable executable.
- `My Music-1.1.1-win.zip` — Portable directory archive.

### Certificate Management & Security Hardening

The repository includes PowerShell scripts for managing code signing without hardcoding secrets:

- **`scripts\rotate-signing-cert.ps1`** — Generates a new code-signing certificate (`CN=My Music (induw)`), imports it to the local certificate store (`CurrentUser\Root` and `CurrentUser\TrustedPublisher`), and saves the PFX password DPAPI-encrypted at `%LOCALAPPDATA%\mymusic-signing\cert-password.txt`.
- **`scripts\build-signed.ps1`** — Reads the DPAPI-encrypted password into memory, sets `CSC_LINK` and `CSC_KEY_PASSWORD`, executes `electron-builder`, and scrubs environment variables upon completion.
- **`scripts\install-cert.bat`** — Installs `build\MyMusic.cer` into the Windows Trusted Root store on other machines.
- **`scripts\sign-ytdlp.ps1`** — Signs `bin\yt-dlp.exe` with the active certificate.

All release executables pass Windows Defender (`MpCmdRun.exe`) scans with zero threats detected.

---

## Project Structure

```
mymusic/
├── Start My Music.bat          # One-click launcher (Windows)
├── bin/
│   └── yt-dlp.exe              # Bundled audio stream resolver
├── build/
│   ├── icon.ico                # Application icon
│   └── cert.pfx                # Code-signing certificate (git-ignored)
├── scripts/
│   ├── build-signed.ps1        # DPAPI-authenticated signed release build
│   ├── rotate-signing-cert.ps1 # Certificate generation & DPAPI key rotation
│   ├── install-cert.bat        # Trust cert installer for Windows
│   └── sign-ytdlp.ps1          # Helper to sign bundled yt-dlp binary
├── src/
│   ├── main.js                 # Electron main process + IPC handlers + window hardening
│   ├── preload.js              # Allowlisted contextBridge IPC bridge
│   ├── lib/
│   │   ├── ytm.js              # YouTube Music client (protobuf search, streaming, lyrics, LRU caches)
│   │   ├── downloader.js       # Offline track downloader with metadata tagging
│   │   ├── importer.js         # CSV / text playlist importer and parser
│   │   └── store.js            # Atomic JSON library persistence (playlists, EQ, favorites)
│   └── renderer/
│       ├── index.html          # App shell + strict Content Security Policy
│       ├── app.js              # Spotify-style UI logic, audio visualizers, mini mode
│       └── styles.css          # Dark glass theme & animations
└── test/
    ├── smoke.mjs               # Backend API and streaming smoke tests
    ├── test-features.mjs       # Downloader, CSV importer, and store unit tests
    └── e2e-live.mjs            # End-to-end Electron CDP test suite
```

---

## How It Works

The Electron main process manages four core backend modules:

1. **`src/lib/ytm.js`** — Queries YouTube Music via `youtubei.js` using direct InnerTube protobuf type filters, executes recursive shelf parsing, caches search queries (10m TTL) and suggestions (5m TTL), and resolves audio stream URLs via `yt-dlp.exe` cached for ~4.5 hours.
2. **`src/lib/store.js`** — Atomic read/write storage (temp file write + rename) into the Electron `userData` directory for playlists, favorites, 10-band EQ settings, and listening analytics.
3. **`src/lib/downloader.js`** — Downloads and saves audio files with sanitized filenames and embedded metadata into the user's local music directory.
4. **`src/lib/importer.js`** — Parses CSV and hyphen-separated text tracklists for playlist importing.

The renderer process (`index.html` + `app.js`) runs with full context isolation and communicates via allowlisted IPC channels (`ytm:*`, `library:*`, `download:*`, `importer:*`) defined in `preload.js`.

---

## Security Model

- **Context Isolation & Sandbox** — `contextIsolation: true` and `nodeIntegration: false` in the renderer; all capabilities are gated through `preload.js` with IPC channel allowlisting.
- **Strict Content Security Policy** — `script-src 'self'` with no external script or style evaluation allowed.
- **Remote Content Escaping** — Every remote string (metadata, titles, artist names, suggestions, lyrics) is HTML-escaped before DOM insertion.
- **Navigation & Popup Hardening** — `setWindowOpenHandler` denies all popups; `will-navigate` blocks navigation away from internal `file://` URLs.
- **Input & Parameter Validation** — Track IDs are validated against strict 11-character YouTube video ID regex before invoking `yt-dlp.exe`; processes are spawned using argument arrays without shell expansion.
- **DPAPI Certificate Protection** — Code-signing PFX passwords are stored DPAPI-encrypted in `%LOCALAPPDATA%`, keeping secrets out of the repository.
- **Zero Windows Defender Alerts** — Signed binaries and hardened process execution conform to Windows security standards.

---

## License

MIT (see [package.json](package.json)).
