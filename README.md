# My Music

A Spotify-style desktop music player for **Windows & Linux**, powered by YouTube Music.

Search, browse, stream, and download songs, albums, artists, and playlists — with synced lyrics, offline downloads, playlist CSV imports, a 10-band equalizer, reactive audio visualizers, Discord Rich Presence, cloud playlist sync, and a persistent local library.

---

## Features

- **Cross-Platform** — Native performance and desktop integration across **Windows (10/11)** and **Linux** (Debian, Ubuntu, Arch Linux, Fedora, openSUSE, Manjaro, Mint).
- **High-Performance Catalog & Search** — Search all categories simultaneously or filter by type (Songs, Videos, Albums, Artists, Playlists). Powered by direct InnerTube protobuf queries via [youtubei.js](https://github.com/LuanRT/YouTube.js) (~700ms response time) with recursive shelf parsing and in-memory LRU caching.
- **Optimized Search Experience** — In-place live rendering without view resets or lost input focus, 0ms tab-switching cache across categories, and autocomplete suggestions with keyboard navigation (`ArrowUp` / `ArrowDown` / `Enter`).
- **Streaming & Resolution** — Audio stream URLs resolved via bundled cross-platform `yt-dlp` (`bin/yt-dlp.exe` on Windows, `bin/yt-dlp` on Linux) and cached for ~4.5 hours with self-pruning LRU eviction.
- **Offline Downloader** — Download tracks directly to your local music directory with automated ID3/metadata tagging, sanitized filenames, and cover artwork embedding.
- **Playlist CSV Importer** — Import existing playlists and song collections from CSV or plain text tracklists with fuzzy search matching.
- **Apple Music-Style AutoMix** — Dual-deck seamless song transitions with equal-power crossfade volume curves ($\cos / \sin$), dead-air/silence trimming, dynamic duration adaptation, background lookahead pre-buffering (preloads next song ~15s early), live "MIXING" visual badge with artwork cross-dissolve, and smooth DJ skip transitions.
- **10-Band EQ & Audio Processing** — Built-in 10-band equalizer, playback speed control (0.5x–2.0x), pitch lock, and listening analytics / play statistics.
- **Enhanced Lyrics** — Synced line highlighting from lrclib.net with fallback to YouTube Music; click-to-seek directly on lyrics, persistent per-track millisecond offset adjustments, and one-click translation.
- **5 Reactive Visualizers** — Liquid, Orbit, Bars (with gravity peak caps), Wave, and Silk modes responding live to Web Audio API frequencies and bass pulse.
- **Dynamic Accent Palette** — Samples cover artwork colors to dynamically shade glass borders, glows, and theme highlights.
- **Cloud Library & Auth Sync** — Optional account sign-in with Google OAuth or email to synchronize playlists, favorites, and settings securely via Supabase.
- **Mini Floating Player** — Compact (380×140) always-on-top floating mode with draggable window frame and playback controls.
- **Discord Rich Presence** — Displays current song, artist, album art, and playback timeline in your Discord profile.
- **Local Library** — Favorites, playlists, recently played (last 100), settings, and queue restore saved atomically as JSON (`src/lib/store.js`).
- **Automated Updates** —
  - **Windows**: Built-in silent background updater via NSIS installer and GitHub Releases.
  - **Linux**: In-app GitHub release notifications with one-click background downloading, desktop context menu update action, and terminal command (`mymusic --update`).

---

## Installation & Downloads

Download the latest version from [GitHub Releases](https://github.com/Induwara-Hansajith/mymusic/releases).

### Windows

- **Installer (`My.Music.Setup.<version>.exe`)**: Recommended. Includes desktop shortcuts, Start Menu integration, and automated background updates.
- **Portable (`My.Music.Portable.<version>.exe`)**: Standalone single executable, no installation required.
- **ZIP (`My Music-<version>-win.zip`)**: Portable folder extraction.

### Linux

#### 1-Line Universal Installer (All Distributions)
Run this single command in your terminal (no `sudo` required):
```bash
curl -fsSL https://raw.githubusercontent.com/Induwara-Hansajith/mymusic/main/scripts/install.sh | bash
```
This automatically downloads the latest release, installs it to `~/.local/share/mymusic`, creates the `mymusic` CLI command, integrates with your desktop application menu, and enables automatic updates via `mymusic --update`.

#### Debian / Ubuntu / Linux Mint
Download the native `.deb` package and install:
```bash
sudo apt install ./My.Music.<version>.deb
# or:
sudo dpkg -i ./My.Music.<version>.deb
```

#### Fedora / RHEL / openSUSE / Universal
Extract the universal `.tar.gz` bundle and integrate with your desktop:
```bash
tar -xzf My.Music.<version>.tar.gz
cd My.Music.<version>
./install.sh           # Integrates into desktop menu and installs CLI launcher
./My-Music.sh          # Or run immediately without installing
```

#### Arch Linux / Manjaro
**Via AUR / PKGBUILD:**
```bash
cd dist/arch
makepkg -si
```
**Or via Universal Installer:**
```bash
curl -fsSL https://raw.githubusercontent.com/Induwara-Hansajith/mymusic/main/scripts/install.sh | bash
```

#### Updating on Linux
- **Inside the app**: When an update is detected, click **Download & Update** in the notification.
- **Terminal**: Run `mymusic --update` anytime.
- **Application menu**: Right-click the **My Music** icon in your application launcher and choose **Check for Updates**.
- **Uninstall**: Run `mymusic --update.sh --uninstall` or `./install.sh --uninstall`.

### Android (v1.1.8)
Native Kotlin / Jetpack Compose app with two flavors, published on the [Android 1.1.8 release](https://github.com/Induwara-Hansajith/mymusic/releases/tag/android_1.1.8):

| Flavor | File | YouTube streaming | Use |
|---|---|---|---|
| Play-safe | `My.Music.Mobile.1.1.8.play.apk` | No | Sideloading now / Google Play later |
| Full | `My.Music.Mobile.1.1.8.full.apk` | Yes (NewPipe Extractor) | GitHub / F-Droid only |

Includes local playback, background playback with lockscreen controls, queue, shuffle/repeat, playlists, liked songs, LRCLIB lyrics, Google sign-in and Supabase cloud sync shared with the desktop `user_libraries` schema. The **equalizer** (framework EQ with presets) and **Auto-Mix** (keep-playing queue top-up) are in both flavors, and the **offline downloader** (MediaStore, saves to `Music/My Music`) is in the Full flavor. **Crossfade** (dual-player gapless hand-off), the **Sonara visualizer** (GPU-heavy canvas for large screens), and **Live DJ Studio** (desktop-sized touch UI) remain desktop-only and are planned for future mobile releases.

Build from source: see [`android/README.md`](android/README.md) (Gradle flavors `play` / `full`).

---

## System Requirements

- **Windows**: Windows 10 or Windows 11 (64-bit)
- **Linux**: Any modern 64-bit Linux distribution with `glibc 2.31+` (Debian 11+, Ubuntu 20.04+, Fedora 34+, Arch Linux, openSUSE 15+)
- **Development**: [Node.js](https://nodejs.org/) v18+ and Python 3 (for Linux packaging scripts)

---

## Quick Start (Development)

### Windows
Double-click **`Start My Music.bat`** — it verifies Node.js, runs `npm install` on first run if needed, and starts the app.

### Linux & macOS
```bash
npm install
npm start
```

---

## Testing

```bash
# Syntax and integrity check
npm run check

# Backend smoke test (search, stream URL resolution, suggestions, synced lyrics)
npm run smoke

# Feature unit test (offline downloader directory, CSV importer parser, 10-band EQ defaults)
node test/test-features.mjs

# Full Electron E2E test via Chrome DevTools Protocol (UI, visualizers, mini mode, playback)
npm run test:e2e
```

---

## Building Releases

### Windows (Signed Build)

Run the automated signing and packaging script:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-signed.ps1
```

Or standard unsigned build:
```bash
npm run dist
```

Outputs are generated in `dist/`:
- `My.Music.Setup.<version>.exe` — Windows NSIS installer with desktop/Start Menu shortcuts and auto-updater.
- `My.Music.Portable.<version>.exe` — Self-contained portable executable.
- `My Music-<version>-win.zip` — Portable directory archive.
- `latest.yml` — Windows auto-updater release manifest.

### Linux Packages

Run the Linux build and packaging pipeline:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-linux.ps1
```
Or directly invoke the packager:
```bash
python scripts/pack-linux.py
```

Outputs are generated in `dist/`:
- `My.Music.<version>.deb` — Native Debian/Ubuntu package with desktop shortcut, icons, and launcher wrapper.
- `My.Music.<version>.tar.gz` — Universal portable Linux archive with 1-click desktop integration (`install.sh`, `My-Music.sh`).
- `dist/arch/` — Arch Linux package directory containing `PKGBUILD`, `.SRCINFO`, `.desktop`, and icon.

### Release Asset Organizer

Organize all built Windows and Linux release assets into structured folders with cryptographic checksums:
```bash
python scripts/organize-releases.py
```
Outputs organized folders `dist/1.1.7/` and `dist/1.1.8/` with `SHA256SUMS.txt`.

---

## Project Structure

```
mymusic/
├── Start My Music.bat          # One-click launcher (Windows)
├── bin/
│   ├── yt-dlp.exe              # Audio stream resolver (Windows x64)
│   └── yt-dlp                  # Audio stream resolver (Linux x64)
├── build/
│   ├── icon.ico                # Windows application icon
│   ├── icon.png                # Linux high-resolution icon (512x512)
│   ├── cert.pfx                # Code-signing certificate (git-ignored)
│   └── MyMusic.cer             # Public certificate for trust installation
├── dist/                       # Packaged release binaries (.exe, .deb, .tar.gz, arch/)
├── scripts/
│   ├── install.sh              # Universal Linux 1-line installer & updater
│   ├── build-signed.ps1        # DPAPI-authenticated signed Windows release build
│   ├── build-linux.ps1         # Linux build automation script
│   ├── pack-linux.py           # Bit-perfect .deb and .tar.gz Linux packager
│   ├── organize-releases.py    # Release folder grouping and SHA256SUMS generator
│   ├── rotate-signing-cert.ps1 # Certificate generation & DPAPI key rotation
│   └── install-cert.bat        # Trust cert installer for Windows
├── sql/
│   └── supabase-schema.sql     # Supabase database schema for cloud playlist sync
├── src/
│   ├── main.js                 # Electron main process, IPC handlers, Linux/Win auto-updaters
│   ├── preload.js              # Allowlisted contextBridge IPC security bridge
│   ├── lib/
│   │   ├── ytm.js              # YouTube Music client (protobuf search, streaming, lyrics, LRU caches)
│   │   ├── downloader.js       # Offline track downloader with metadata tagging
│   │   ├── importer.js         # CSV / text playlist importer and parser
│   │   ├── auth-sync.js        # Supabase authentication and cloud playlist synchronization
│   │   └── store.js            # Atomic JSON library persistence (playlists, EQ, favorites)
│   └── renderer/
│       ├── index.html          # App shell + strict Content Security Policy
│       ├── app.js              # Spotify-style UI logic, visualizers, AutoMix, updater UI
│       └── styles.css          # Dark glass theme & animations
└── test/
    ├── smoke.mjs               # Backend API and streaming smoke tests
    ├── test-features.mjs       # Downloader, CSV importer, and store unit tests
    └── e2e-live.mjs            # End-to-end Electron CDP test suite
```

---

## Security Model

- **Context Isolation & Sandbox** — `contextIsolation: true` and `nodeIntegration: false` in the renderer; all capabilities are gated through `preload.js` with IPC channel allowlisting.
- **Strict Content Security Policy** — `script-src 'self'` with no external script or style evaluation allowed.
- **Remote Content Escaping** — Every remote string (metadata, titles, artist names, suggestions, lyrics) is HTML-escaped before DOM insertion.
- **Navigation & Popup Hardening** — `setWindowOpenHandler` denies all popups; `will-navigate` blocks navigation away from internal `file://` URLs.
- **Input & Parameter Validation** — Track IDs are validated against strict 11-character YouTube video ID regex before invoking `yt-dlp`; processes are spawned using argument arrays without shell expansion.
- **Cross-Platform Path Resolution** — Dynamically locates binaries (`yt-dlp`, `ffmpeg`) across packaged paths, dev paths, and Unix system paths (`/usr/bin/`).
- **DPAPI Certificate Protection** — Code-signing PFX passwords on Windows are stored DPAPI-encrypted in `%LOCALAPPDATA%`, keeping secrets out of the repository.
- **Zero Windows Defender Alerts** — Hardened process execution and signed Windows binaries conform to strict security standards.

---

## License

MIT (see [package.json](package.json)).
