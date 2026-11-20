/**
 * LyricClockBinder
 * Exact Lyric Clock Binding Helper for AutoMix Transitions
 *
 * Ensures lyrics stay locked to playback even when:
 * 1. Playback rate is scaled during beat-matching (playbackRate !== 1.0)
 * 2. Active deck switches at midpoint handoff (t = 0.5)
 * 3. Lyrics transition between synced LRCLIB timestamps and plain YTM text
 *
 * Samples deck.currentTime directly on requestAnimationFrame, completely
 * preventing wall-clock drift from setInterval or setTimeout.
 */

import { LyricsModel, LyricsLine } from './types';

export interface LyricHighlightState {
  activeIndex: number;
  activeLine: LyricsLine | null;
  progressInLine: number; // 0.0 .. 1.0
  isSynced: boolean;
}

export type LyricStateCallback = (state: LyricHighlightState) => void;

export class LyricClockBinder {
  private activeDeck: HTMLAudioElement | null = null;
  private lyrics: LyricsModel | null = null;
  private offsetSec = 0; // User-defined sync offset in seconds
  private callback: LyricStateCallback | null = null;

  private rafId = 0;
  private lastIndex = -1;
  private running = false;

  constructor() {}

  /**
   * Binds the lyric clock to an audio deck and lyric data set.
   * Can be safely called at t = 0.5 to swap to incoming track without visual hiccups.
   */
  bind(
    deck: HTMLAudioElement,
    lyrics: LyricsModel,
    offsetMs = 0,
    callback?: LyricStateCallback
  ): void {
    this.unbind();

    this.activeDeck = deck;
    this.lyrics = lyrics;
    this.offsetSec = offsetMs / 1000;
    if (callback) this.callback = callback;
    this.lastIndex = -1;
    this.running = true;

    // Handle Unsynced / Plain / YTM fallback lyrics immediately
    if (!lyrics.synced || lyrics.synced.length === 0) {
      if (this.callback) {
        this.callback({
          activeIndex: -1,
          activeLine: null,
          progressInLine: 0,
          isSynced: false
        });
      }
      return;
    }

    // Start high-precision animation frame clock loop
    const tick = () => {
      if (!this.running || !this.activeDeck || !this.lyrics?.synced) return;

      // Direct deck reading: automatically accounts for playbackRate tempo scaling!
      const audioTime = this.activeDeck.currentTime + this.offsetSec;
      const index = this.findActiveLineIndex(this.lyrics.synced, audioTime);

      if (index !== this.lastIndex) {
        this.lastIndex = index;
        const currentLine = index >= 0 ? this.lyrics.synced[index] : null;
        const nextLine = (index >= 0 && index + 1 < this.lyrics.synced.length)
          ? this.lyrics.synced[index + 1]
          : null;

        let progressInLine = 0;
        if (currentLine && nextLine) {
          const lineDuration = nextLine.t - currentLine.t;
          if (lineDuration > 0) {
            progressInLine = Math.min(1.0, Math.max(0.0, (audioTime - currentLine.t) / lineDuration));
          }
        }

        if (this.callback) {
          this.callback({
            activeIndex: index,
            activeLine: currentLine,
            progressInLine,
            isSynced: true
          });
        }
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  /**
   * Fast binary search for the active lyric line at audioTime.
   */
  private findActiveLineIndex(lines: LyricsLine[], time: number): number {
    if (!lines.length || time < lines[0].t) return -1;
    if (time >= lines[lines.length - 1].t) return lines.length - 1;

    let low = 0;
    let high = lines.length - 1;
    let best = -1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (lines[mid].t <= time) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return best;
  }

  /**
   * Updates user timing offset without restarting the binder.
   */
  setOffsetMs(offsetMs: number): void {
    this.offsetSec = offsetMs / 1000;
  }

  /**
   * Stops the lyric clock loop and clears references.
   */
  unbind(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.activeDeck = null;
    this.lyrics = null;
    this.lastIndex = -1;
  }
}
