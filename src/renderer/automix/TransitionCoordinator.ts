/**
 * TransitionCoordinator
 * Explicit State Machine & Event Coordinator for AutoMix Transitions
 *
 * Implements deterministic transition lifecycle:
 * IDLE -> PRELOADING -> MIXING (t = 0.0 .. 1.0) -> COMPLETED
 *
 * Handles:
 * - Pre-buffering audio & pre-fetching LRCLIB/YTM lyrics during PRELOADING.
 * - Outgoing track dominance during t in [0.0, 0.5).
 * - Exact Midpoint Handoff at t = 0.5 (activeTrack commit, lyric clock binding, cross-dissolve).
 * - Incoming track dominance & tempo return during t in [0.5, 1.0].
 * - Immediate, click-free abort on manual user seek, pause, or skip.
 */

import {
  AutoMixTrack,
  AutoMixTrackMeta,
  MixDecision,
  TransitionState,
  TransitionEvents,
  LyricsModel
} from './types';
import { AutoMixEngine } from './AutoMixEngine';
import { AutoMixAnalyzer } from './AutoMixAnalyzer';

type EventListener<K extends keyof TransitionEvents> = TransitionEvents[K];

export class TransitionCoordinator {
  private engine: AutoMixEngine;
  private analyzer: AutoMixAnalyzer;

  private state: TransitionState = 'IDLE';
  private listeners: { [K in keyof TransitionEvents]?: EventListener<K>[] } = {};

  private currentTrack: AutoMixTrack | null = null;
  private currentMeta: AutoMixTrackMeta | null = null;

  private preloadedTrack: AutoMixTrack | null = null;
  private preloadedMeta: AutoMixTrackMeta | null = null;
  private preloadedLyrics: LyricsModel | null = null;

  // Active mix loop tracking
  private rafId = 0;
  private mixStartTime = 0;
  private mixDurationSec = 6;
  private activeDecision: MixDecision | null = null;
  private outDeckId: 'deckA' | 'deckB' = 'deckA';
  private inDeckId: 'deckA' | 'deckB' = 'deckB';
  private midpointHandedOff = false;

  constructor(engine: AutoMixEngine, analyzer: AutoMixAnalyzer) {
    this.engine = engine;
    this.analyzer = analyzer;
  }

  on<K extends keyof TransitionEvents>(event: K, listener: EventListener<K>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    (this.listeners[event] as EventListener<K>[]).push(listener);
    return () => {
      this.listeners[event] = (this.listeners[event] as EventListener<K>[]).filter((l) => l !== listener);
    };
  }

  private emit<K extends keyof TransitionEvents>(event: K, ...args: Parameters<TransitionEvents[K]>): void {
    const list = this.listeners[event];
    if (list) {
      for (const fn of list) {
        // @ts-expect-error dynamic spread
        fn(...args);
      }
    }
  }

  getState(): TransitionState {
    return this.state;
  }

  getCurrentTrack(): AutoMixTrack | null {
    return this.currentTrack;
  }

  getPreloadedTrack(): AutoMixTrack | null {
    return this.preloadedTrack;
  }

  /**
   * Sets the initial track without crossfading (e.g. at app start or user cold start).
   */
  setInitialTrack(track: AutoMixTrack, deckId: 'deckA' | 'deckB' = 'deckA'): void {
    this.abortTransition('New initial track selected');
    this.currentTrack = track;
    this.engine.setActiveDeckId(deckId);
    this.outDeckId = deckId;
    this.inDeckId = deckId === 'deckA' ? 'deckB' : 'deckA';

    const deck = this.engine.getDeck(deckId);
    deck.src = track.streamUrl || (track.localPath ? 'file:///' + track.localPath.replace(/\\/g, '/') : '');
    deck.volume = 1.0;
    deck.playbackRate = 1.0;
    deck.preservesPitch = true;

    this.analyzer.analyze(track).then((meta) => {
      this.currentMeta = meta;
    }).catch(() => {});

    this.setState('IDLE');
  }

  /**
   * Phase 1: Preload Phase (PRELOADING, before t = 0)
   * Fetches incoming stream, metadata, and lyrics into memory without affecting UI.
   */
  async preloadNextTrack(
    nextTrack: AutoMixTrack,
    fetchLyricsFn?: (track: AutoMixTrack) => Promise<LyricsModel>
  ): Promise<void> {
    if (this.state === 'MIXING') return;

    this.setState('PRELOADING');
    this.preloadedTrack = nextTrack;
    const standbyDeckId = this.engine.getStandbyDeckId();
    const standbyDeck = this.engine.getDeck(standbyDeckId);

    try {
      // 1. Prepare standby audio element
      standbyDeck.src = nextTrack.streamUrl || (nextTrack.localPath ? 'file:///' + nextTrack.localPath.replace(/\\/g, '/') : '');
      standbyDeck.volume = 0;
      standbyDeck.preload = 'auto';
      standbyDeck.load();

      // 2. Parallel: Analyze DSP & fetch lyrics in memory
      const [meta, lyrics] = await Promise.all([
        this.analyzer.analyze(nextTrack).catch(() => null),
        fetchLyricsFn ? fetchLyricsFn(nextTrack).catch(() => ({ synced: null, plain: null, source: 'none' as const })) : Promise.resolve(nextTrack.lyrics || null)
      ]);

      this.preloadedMeta = meta;
      this.preloadedLyrics = lyrics;
      nextTrack.lyrics = lyrics || undefined;
    } catch (err) {
      console.warn('[TransitionCoordinator] Preload error:', err);
    }
  }

  /**
   * Phase 2, 3, 4: Executes the AutoMix transition over progress t in [0.0, 1.0]
   */
  async startTransition(isSequentialAlbum = false, masterVolume = 1.0): Promise<void> {
    if (!this.currentTrack || !this.preloadedTrack || this.state === 'MIXING') return;

    const outTrack = this.currentTrack;
    const inTrack = this.preloadedTrack;

    // Determine mix decision (gapless, beat-matched, or equal-power)
    const decision = this.engine.makeMixDecision(
      outTrack,
      inTrack,
      this.currentMeta,
      this.preloadedMeta,
      isSequentialAlbum
    );

    this.activeDecision = decision;
    this.outDeckId = this.engine.getActiveDeckId();
    this.inDeckId = this.engine.getStandbyDeckId();
    const outDeck = this.engine.getDeck(this.outDeckId);
    const inDeck = this.engine.getDeck(this.inDeckId);

    // Apply initial cue point and pitch-preserved tempo scaling to incoming deck
    inDeck.currentTime = decision.cueInSec;
    inDeck.preservesPitch = true;
    inDeck.playbackRate = decision.tempoRatio;
    inDeck.volume = 0.0;

    try {
      await inDeck.play();
    } catch (e) {
      console.warn('[TransitionCoordinator] In-deck play failed, falling back to direct play:', e);
      this.abortTransition('Play invocation failed');
      return;
    }

    this.setState('MIXING');
    this.midpointHandedOff = false;
    this.mixDurationSec = Math.max(0.2, decision.durationSec);
    this.mixStartTime = performance.now();

    this.emit('onMixStart', {
      outTrack,
      inTrack,
      decision,
      durationSec: this.mixDurationSec,
      outDeckId: this.outDeckId,
      inDeckId: this.inDeckId
    });

    const step = (now: number) => {
      if (this.state !== 'MIXING') return;

      const elapsedSec = (now - this.mixStartTime) / 1000;
      const t = Math.min(1.0, Math.max(0.0, elapsedSec / this.mixDurationSec));

      // Apply audio DSP curves (equal-power gain + bass swap + tempo recovery)
      const { outVol, inVol, bassCutDb } = this.engine.applyTransitionStep(
        this.outDeckId,
        this.inDeckId,
        t,
        decision,
        masterVolume
      );

      this.emit('onMixProgress', {
        t,
        elapsedSec,
        durationSec: this.mixDurationSec,
        outVolume: outVol,
        inVolume: inVol,
        outDeckId: this.outDeckId,
        inDeckId: this.inDeckId,
        bassCutDb
      });

      // Midpoint Handoff (t >= 0.5): Auditory & UI handover point
      if (t >= 0.5 && !this.midpointHandedOff) {
        this.midpointHandedOff = true;
        this.currentTrack = inTrack;
        this.currentMeta = this.preloadedMeta;
        this.engine.setActiveDeckId(this.inDeckId);

        this.emit('onMidpointHandoff', {
          activeTrack: inTrack,
          activeDeckId: this.inDeckId,
          inDeck,
          cueInSec: decision.cueInSec,
          playbackRate: inDeck.playbackRate,
          lyrics: this.preloadedLyrics || { synced: null, plain: null, source: 'none' }
        });
      }

      if (t < 1.0 && !outDeck.paused && !inDeck.paused) {
        this.rafId = requestAnimationFrame(step);
      } else {
        this.completeTransition(inTrack);
      }
    };

    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(step);
  }

  /**
   * Concludes the transition, frees outgoing deck resources, and resets DSP.
   */
  private completeTransition(finalTrack: AutoMixTrack): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);

    const outDeck = this.engine.getDeck(this.outDeckId);
    const inDeck = this.engine.getDeck(this.inDeckId);

    try {
      outDeck.pause();
      outDeck.src = '';
      outDeck.volume = 0;
    } catch {}

    inDeck.playbackRate = 1.0;
    this.engine.resetDeckDsp();

    this.preloadedTrack = null;
    this.preloadedMeta = null;
    this.preloadedLyrics = null;
    this.activeDecision = null;

    this.setState('COMPLETED');
    this.emit('onMixComplete', {
      activeTrack: finalTrack,
      activeDeckId: this.inDeckId
    });

    this.setState('IDLE');
  }

  /**
   * Phase 5: Edge Cases & Manual Overrides
   * Instantly and click-free aborts an in-flight mix on user seek, pause, or manual skip.
   */
  abortTransition(reason: string): void {
    if (this.state === 'IDLE' && !this.rafId) return;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    const standbyDeckId = this.engine.getStandbyDeckId();
    const standbyDeck = this.engine.getDeck(standbyDeckId);
    try {
      standbyDeck.pause();
      standbyDeck.src = '';
      standbyDeck.volume = 0;
    } catch {}

    const activeDeck = this.engine.getDeck(this.engine.getActiveDeckId());
    activeDeck.playbackRate = 1.0;
    this.engine.resetDeckDsp();

    this.preloadedTrack = null;
    this.preloadedMeta = null;
    this.preloadedLyrics = null;
    this.activeDecision = null;

    this.setState('ABORTED');
    this.emit('onMixAbort', {
      reason,
      activeTrack: this.currentTrack,
      activeDeckId: this.engine.getActiveDeckId()
    });

    this.setState('IDLE');
  }

  private setState(newState: TransitionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.emit('onStateChange', newState);
    }
  }
}
