# My Music

A Spotify-style desktop music player for Windows, powered by YouTube Music.

Search, browse, and stream songs, albums, artists, and playlists from YouTube Music — with synced lyrics, a queue, and a local library (favorites, playlists, recents, settings) that persists on your machine.

## Features

- **Catalog & search** — search everything at once (songs, videos, albums, artists, playlists) or filter by type, powered by [youtubei.js](https://github.com/LuanRT/YouTube.js) v18.
- **Streaming** — audio stream URLs resolved via a bundled `bin\yt-dlp.exe` and cached for ~4.5 hours, so playback starts fast and repeats are free.
- **Browse** — home feed with shelves, album pages (full tracklists), artist pages (songs, albums, singles, videos), and playlists.
- **Lyrics** — synced (timed) lyrics when available from lrclib.net, plain text otherwise; falls back to YouTube Music's own lyrics endpoint.
- **Queue** — now-playing panel with "Next up", shuffle, and repeat (off / all / one).
- **Local library** — favorites, playlists (create / rename / delete / add / remove), recently played (last 100), settings, and last-queue restore, saved as JSON (see `src/lib/store.js`).
- **Player UI & Liquid Glass** — Spotify-inspired dark aesthetic with dynamic chromatic aurora mesh, glass surfaces, context menus, toasts, and modals.
- **6 Reactive Visualizers** — Liquid, Orbit, Bars (with gravity peak caps), Wave, Silk, and Blob modes responding live to audio frequencies and bass pulse. Cycle with the visualizer button in the player bar.
- **Dynamic Accent Palette** — Samples cover artwork colors to dynamically shade glass borders, glows, and theme highlights for every playing track.
- **Mini Floating Player** — Compact (380×140) always-on-top floating mode with full playback controls and draggable window frame.
- **Discord Rich Presence** — Displays current song, artist, album art, and playback timeline in your Discord profile.
- **Enhanced Lyrics** — Synced line highlighting, click-to-seek directly on any lyric line, persistent millisecond offset adjustments (`+/- ms` saved per track), and one-click English translation toggle.

## Requirements

- Windows with [Node.js](https://nodejs.org/) installed (dependencies install Electron themselves).

## Quick start

Double-click **`Start My Music.bat`** — it checks for Node, runs `npm install` on first run if needed, and starts the app.

Or from a terminal in this folder:

```bat
npm install
npm start
```

## Testing

### Smoke test
Verifies backend services: search (all + songs + albums filters), album/artist/playlist parsing, stream URL resolution (HTTP 200), suggestions, and lyrics:

```bat
npm run smoke
```

### Live End-to-End test
Automates the full Electron runtime via Chrome DevTools Protocol to verify the real UI: DOM elements, all 6 visualizer mode transitions, live YouTube search, track playback, album cover accent extraction, mini mode toggle, and lyrics panel with sync offsets & translation:

```bat
npm run test:e2e
```

## Project structure

```
mymusic/
├── Start My Music.bat      # one-click launcher (Windows)
├── bin/
│   └── yt-dlp.exe          # bundled stream-URL resolver
├── src/
│   ├── main.js             # Electron main process + IPC handlers + window hardening
│   ├── preload.js          # contextBridge API exposed to the renderer
│   ├── lib/
│   │   ├── ytm.js          # YouTube Music client (search/browse/stream/lyrics + caches)
│   │   └── store.js        # local library persistence (JSON, atomic writes)
│   └── renderer/
│       ├── index.html      # app shell + Content-Security-Policy
│       ├── app.js          # player UI logic (views, playback, panels)
│       └── styles.css      # Spotify-style theme
└── test/
    ├── smoke.mjs           # end-to-end smoke test (npm run smoke)
    └── scratch/            # one-off exploration scripts used during development
```

## How it works

The Electron main process owns two services:

1. **`src/lib/ytm.js`** — talks to YouTube Music through `youtubei.js` (search with filter chips, home feed, album, artist, playlist, suggestions, lyrics) and asks the bundled `yt-dlp.exe` for playable audio URLs, cached ~4.5 hours with a size-capped, self-pruning cache (40 streams / 200 lyric entries).
2. **`src/lib/store.js`** — reads/writes the local library JSON (atomic write via temp file + rename) into the Electron `userData` folder, so favorites, playlists, recents, and settings survive restarts.

The renderer (`index.html` + `app.js`) is a plain HTML/CSS/JS UI that calls these services through the `preload.js` context bridge (`ytm:*` and `library:*` IPC channels).

## Security model

- **Context isolation on, Node integration off** in the renderer; the only bridge is `preload.js`, which allowlists IPC channels (any other channel is rejected).
- **XSS-safe rendering** — every remote string (titles, artist names, thumbnails, lyrics, suggestions) is HTML-escaped before it enters the DOM; strict Content-Security-Policy (`script-src 'self'`, no remote script/style origins).
- **Navigation hardening** — `setWindowOpenHandler` denies all popups; `will-navigate` blocks anything that isn't the app's own `file://` content.
- **Track-ID validation** — playback rejects any ID that isn't a valid 11-character YouTube video ID before `yt-dlp.exe` is ever spawned (spawned with an args array, no shell).
- **Settings allowlist** — only `volume` (clamped 0–1), `repeat` (`off`/`all`/`one`), and `shuffle` are accepted from the renderer; unknown or dangerous keys are dropped.
- **Bounded caches** — stream and lyric caches prune expired entries and enforce size caps so long sessions don't grow without limit.

## Notes

- Streaming quality and availability depend on YouTube Music; no account or API key is required.
- Lyrics come from lrclib.net (with a custom User-Agent) and YouTube Music's lyrics endpoint.
- `node_modules/`, `run.log`, and `*.tmp` are git-ignored.
- License: MIT (see `package.json`).
