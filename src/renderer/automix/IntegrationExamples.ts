/**
 * AutoMix Engine Integration Hooks & Examples for My Music
 *
 * This file illustrates how to wire the modular TypeScript AutoMix engine into:
 * 1. Stream Resolvers: YouTube Music (Innertube / youtubei.js) and local offline files (Music/My Music).
 * 2. Expanding / Fullscreen Player UI: artwork cross-dissolve, seek bar, and title updates.
 * 3. Lyrics Controller: LRCLIB time-synced lyrics with YouTube Music fallback.
 * 4. Audio-Reactive Visualizers: routing the shared masterBus AnalyserNode into SonaraEngine.
 * 5. Player State Controls: manual seek, pause, and skip edge cases.
 */

import { AutoMixEngine } from './AutoMixEngine';
import { AutoMixAnalyzer } from './AutoMixAnalyzer';
import { TransitionCoordinator } from './TransitionCoordinator';
import { LyricClockBinder } from './LyricClockBinder';
import { AutoMixTrack, LyricsModel } from './types';

// ============================================================================
// 1. Initializing the AutoMix Stack in My Music Renderer
// ============================================================================

export function setupAutoMix(deckAEl: HTMLAudioElement, deckBEl: HTMLAudioElement) {
  const analyzer = new AutoMixAnalyzer();
  const engine = new AutoMixEngine(deckAEl, deckBEl, {
    enabled: true,
    defaultDurationSec: 6.0,
    bassCutFrequencyHz: 200,
    bassCutMaxDb: -24,
    preferWebAudio: true
  });
  const coordinator = new TransitionCoordinator(engine, analyzer);
  const lyricBinder = new LyricClockBinder();

  // Connect Shared Master Visualizer Bus
  const analyserNode = engine.getAnalyser();
  if (analyserNode && typeof (window as unknown as { SonaraEngine?: { setAudioSource: (node: AnalyserNode) => void } }).SonaraEngine !== 'undefined') {
    (window as unknown as { SonaraEngine: { setAudioSource: (node: AnalyserNode) => void } }).SonaraEngine.setAudioSource(analyserNode);
  }

  // ==========================================================================
  // 2. Wiring Transition Coordinator Events to UI & Visualizer
  // ==========================================================================

  // On Mix Start: Show mixing glow on player bar and full-screen view
  coordinator.on('onMixStart', ({ outTrack, inTrack, decision, durationSec }) => {
    console.log(`[AutoMix] Starting ${decision.mode} transition from "${outTrack.title}" to "${inTrack.title}" (${durationSec.toFixed(1)}s)`);

    // UI Badges
    document.getElementById('pb-automix')?.classList.add('mixing-glow');
    document.getElementById('fs-automix')?.classList.add('mixing-glow');
    document.getElementById('np-mixing-badge')?.classList.remove('hidden');
    document.getElementById('fs-mixing-badge')?.classList.remove('hidden');
  });

  // On Mix Progress: Smoothly update visualizer bars and crossfade indicators
  coordinator.on('onMixProgress', ({ t, outVolume, inVolume, bassCutDb }) => {
    // E.g. Update UI crossfade progress or subtle waveform tinting if displayed
    const progressEl = document.getElementById('automix-progress-bar');
    if (progressEl) {
      progressEl.style.width = `${(t * 100).toFixed(1)}%`;
    }
  });

  // On Midpoint Handoff (t = 0.5):
  // Commit active track metadata to Player UI and swap lyrics clock!
  coordinator.on('onMidpointHandoff', ({ activeTrack, inDeck, lyrics }) => {
    console.log(`[AutoMix] Midpoint handoff reached -> committing "${activeTrack.title}" to UI`);

    // 1. Cross-dissolve artwork and title in Player Bar & Fullscreen
    const npThumb = document.getElementById('np-thumb') as HTMLImageElement | null;
    const fsThumb = document.getElementById('fs-thumb') as HTMLImageElement | null;
    if (npThumb && activeTrack.thumb) {
      npThumb.classList.add('mixing-dissolve');
      npThumb.src = activeTrack.thumb;
      setTimeout(() => npThumb.classList.remove('mixing-dissolve'), 500);
    }
    if (fsThumb && activeTrack.thumb) {
      fsThumb.classList.add('mixing-dissolve');
      fsThumb.src = activeTrack.thumb;
      setTimeout(() => fsThumb.classList.remove('mixing-dissolve'), 500);
    }

    const titleEl = document.getElementById('np-title');
    const artistEl = document.getElementById('np-artist');
    if (titleEl) titleEl.textContent = activeTrack.title;
    if (artistEl) artistEl.textContent = activeTrack.artist;

    // 2. Bind Lyrics Clock to incoming deck
    // Reads inDeck.currentTime directly so tempo-scaled rates (playbackRate !== 1.0) stay frame-accurate!
    lyricBinder.bind(inDeck, lyrics, 0, ({ activeIndex, activeLine, isSynced }) => {
      renderLyricsLineToDom(activeIndex, activeLine, isSynced, lyrics);
    });
  });

  // On Mix Complete: Clean up UI states
  coordinator.on('onMixComplete', ({ activeTrack }) => {
    console.log(`[AutoMix] Transition complete for "${activeTrack.title}"`);
    document.getElementById('pb-automix')?.classList.remove('mixing-glow');
    document.getElementById('fs-automix')?.classList.remove('mixing-glow');
    document.getElementById('np-mixing-badge')?.classList.add('hidden');
    document.getElementById('fs-mixing-badge')?.classList.add('hidden');
  });

  // On Mix Abort: User manually paused, sought, or clicked skip
  coordinator.on('onMixAbort', ({ reason }) => {
    console.log(`[AutoMix] Transition aborted: ${reason}`);
    document.getElementById('pb-automix')?.classList.remove('mixing-glow');
    document.getElementById('fs-automix')?.classList.remove('mixing-glow');
    document.getElementById('np-mixing-badge')?.classList.add('hidden');
    document.getElementById('fs-mixing-badge')?.classList.add('hidden');
    lyricBinder.unbind();
  });

  return { engine, analyzer, coordinator, lyricBinder };
}

// ============================================================================
// 3. Stream & Local Library Resolvers (Innertube + Music/My Music)
// ============================================================================

/**
 * Resolves direct audio stream or local file path for AutoMixTrack.
 */
export async function resolveTrackForAutoMix(
  track: { id: string; title: string; artist: string; album?: string; duration?: number; thumb?: string; localPath?: string },
  ipcCall: (channel: string, args: unknown) => Promise<unknown>
): Promise<AutoMixTrack> {
  let streamUrl = '';

  if (track.localPath) {
    // Offline Track in Music/My Music
    streamUrl = 'file:///' + track.localPath.replace(/\\/g, '/');
  } else {
    // Stream via Innertube / ytm:stream IPC
    const streamResult = (await ipcCall('ytm:stream', { id: track.id })) as { url?: string; urls?: string[] } | null;
    streamUrl = (streamResult && streamResult.url) || (streamResult && streamResult.urls && streamResult.urls[0]) || '';
  }

  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    durationSec: track.duration || 180,
    thumb: track.thumb,
    streamUrl,
    localPath: track.localPath
  };
}

/**
 * Pre-fetches LRCLIB synced lyrics with YouTube Music native lyrics fallback.
 */
export async function fetchLyricsForAutoMix(
  track: AutoMixTrack,
  ipcCall: (channel: string, args: unknown) => Promise<unknown>
): Promise<LyricsModel> {
  try {
    const res = (await ipcCall('ytm:lyrics', { track })) as {
      synced?: { t: number; text: string }[];
      plain?: string;
    } | null;

    if (res && res.synced && res.synced.length > 0) {
      return { synced: res.synced, plain: res.plain || null, source: 'lrclib' };
    }
    if (res && res.plain) {
      return { synced: null, plain: res.plain, source: 'ytm' };
    }
  } catch (e) {
    console.warn(`[AutoMix] Lyrics fetch failed for ${track.title}:`, e);
  }

  return { synced: null, plain: null, source: 'none' };
}

// ============================================================================
// 4. Lyrics DOM Renderer Helper (Supporting Synced & Plain Text Fallbacks)
// ============================================================================

function renderLyricsLineToDom(
  activeIndex: number,
  activeLine: { t: number; text: string } | null,
  isSynced: boolean,
  lyrics: LyricsModel
) {
  const container = document.getElementById('fs-lyrics-body');
  if (!container) return;

  if (!isSynced || !lyrics.synced) {
    // Plain text / YTM fallback display
    if (lyrics.plain) {
      container.innerHTML = `<div class="fs-lyrics-plain">${lyrics.plain}</div>`;
    } else {
      container.innerHTML = '<div class="fs-lyrics-empty">No lyrics available</div>';
    }
    return;
  }

  // Update active line styling and scroll to center
  const rows = container.querySelectorAll('.fs-ly-row');
  rows.forEach((row, idx) => {
    const isNowActive = idx === activeIndex;
    row.classList.toggle('on', isNowActive);
    if (isNowActive) {
      (row as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

// ============================================================================
// 5. User Seek / Manual Skip Edge Case Listeners
// ============================================================================

export function attachUserInteractionGuards(coordinator: TransitionCoordinator) {
  // Seek bar scrub aborts active in-flight blend immediately
  const seekBar = document.getElementById('time-track');
  seekBar?.addEventListener('mousedown', () => {
    coordinator.abortTransition('User scrubbed seek bar');
  });

  // Play/Pause button toggles
  const playBtn = document.getElementById('pb-play');
  playBtn?.addEventListener('click', () => {
    // If paused mid-mix, transition is cleanly halted
    const state = coordinator.getState();
    if (state === 'MIXING') {
      coordinator.abortTransition('User paused playback during mix');
    }
  });
}
