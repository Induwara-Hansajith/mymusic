/**
 * AutoMixEngine
 * Dual-Deck Playback Architecture, Decision Engine & DSP Routing Controller
 *
 * Implements Apple Music-style continuous transitions with:
 * 1. Dual-deck Web Audio graph with shared AnalyserNode for visualizers.
 * 2. Safe fallback to dual HTML5 audio elements when CORS restricts MediaElementSource.
 * 3. Intelligent Decision Engine:
 *    - Sequential Album Guard (gapless / trim-silence for adjacent album tracks)
 *    - Beat-Matched Mix with bass-swap (200 Hz low-shelf) and tempo normalization
 *    - Equal-Power Crossfade Fallback (asymmetric cos/sin curve)
 */

import {
  AutoMixTrack,
  AutoMixTrackMeta,
  MixDecision,
  AutoMixMode,
  AutoMixEngineOptions
} from './types';

interface DeckAudioNodeGraph {
  sourceNode: MediaElementAudioSourceNode;
  bassFilter: BiquadFilterNode;
  gainNode: GainNode;
}

export class AutoMixEngine {
  private deckA: HTMLAudioElement;
  private deckB: HTMLAudioElement;
  private activeDeckId: 'deckA' | 'deckB' = 'deckA';

  // Web Audio Graph
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private deckGraphs: Map<'deckA' | 'deckB', DeckAudioNodeGraph> = new Map();
  private webAudioEnabled = false;

  private options: Required<AutoMixEngineOptions>;

  constructor(
    deckA: HTMLAudioElement,
    deckB: HTMLAudioElement,
    options: AutoMixEngineOptions = {}
  ) {
    this.deckA = deckA;
    this.deckB = deckB;

    this.options = {
      enabled: options.enabled ?? true,
      defaultDurationSec: options.defaultDurationSec ?? 6.0,
      minCrossfadeSec: options.minCrossfadeSec ?? 2.5,
      maxCrossfadeSec: options.maxCrossfadeSec ?? 12.0,
      bassCutFrequencyHz: options.bassCutFrequencyHz ?? 200,
      bassCutMaxDb: options.bassCutMaxDb ?? -24,
      preferWebAudio: options.preferWebAudio ?? true
    };

    if (this.options.preferWebAudio) {
      this.initWebAudioGraph().catch((err) => {
        console.warn('[AutoMixEngine] Web Audio init deferred or failed, using element fallback:', err);
      });
    }
  }

  /**
   * Initializes the shared Web Audio Master Bus.
   * If a stream origin lacks CORS headers, graceful fallback handles playback without audio loss.
   */
  async initWebAudioGraph(): Promise<void> {
    if (this.webAudioEnabled && this.audioCtx) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.audioCtx = new AudioCtxClass();
      if (this.audioCtx.state === 'suspended') {
        const resumeOnInteraction = () => {
          this.audioCtx?.resume();
          window.removeEventListener('click', resumeOnInteraction);
          window.removeEventListener('keydown', resumeOnInteraction);
        };
        window.addEventListener('click', resumeOnInteraction);
        window.addEventListener('keydown', resumeOnInteraction);
      }

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 1.0;

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.82;

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);

      // Attempt wiring decks
      this.wireDeckToGraph('deckA', this.deckA);
      this.wireDeckToGraph('deckB', this.deckB);

      this.webAudioEnabled = true;
    } catch (e) {
      console.warn('[AutoMixEngine] Web Audio routing rejected (CORS or permissions):', e);
      this.webAudioEnabled = false;
    }
  }

  private wireDeckToGraph(deckId: 'deckA' | 'deckB', deckEl: HTMLAudioElement): void {
    if (!this.audioCtx || !this.masterGain) return;
    try {
      deckEl.crossOrigin = 'anonymous';
      const sourceNode = this.audioCtx.createMediaElementSource(deckEl);

      const bassFilter = this.audioCtx.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = this.options.bassCutFrequencyHz;
      bassFilter.gain.value = 0.0;

      const gainNode = this.audioCtx.createGain();
      gainNode.gain.value = 1.0;

      sourceNode.connect(bassFilter);
      bassFilter.connect(gainNode);
      gainNode.connect(this.masterGain);

      this.deckGraphs.set(deckId, { sourceNode, bassFilter, gainNode });
    } catch (e) {
      // CORS taint or already connected
      console.warn(`[AutoMixEngine] Cannot wire ${deckId} via MediaElementSource (CORS fallback active):`, e);
    }
  }

  /**
   * Adaptive Mix Mode Decision Engine
   */
  makeMixDecision(
    outTrack: AutoMixTrack,
    inTrack: AutoMixTrack,
    outMeta: AutoMixTrackMeta | null,
    inMeta: AutoMixTrackMeta | null,
    isSequentialAlbum = false
  ): MixDecision {
    if (!this.options.enabled) {
      return {
        mode: 'equal-power-crossfade',
        durationSec: 0.1,
        cueInSec: 0,
        cueOutSec: outTrack.durationSec - 0.1,
        tempoRatio: 1.0,
        barAlignmentOffsetSec: 0,
        bassSwapEnabled: false,
        reason: 'AutoMix is disabled'
      };
    }

    // 1. Sequential Album Guard
    // When playing sequential tracks from the same album without shuffle, preserve gapless album transition
    const sameAlbum = !!(outTrack.album && inTrack.album && outTrack.album.toLowerCase() === inTrack.album.toLowerCase());
    const sequentialIndex = (outTrack.albumIndex != null && inTrack.albumIndex != null && inTrack.albumIndex === outTrack.albumIndex + 1);

    if (isSequentialAlbum || (sameAlbum && sequentialIndex)) {
      return {
        mode: 'gapless-album',
        durationSec: 0.25,
        cueInSec: 0,
        cueOutSec: Math.max(0, outTrack.durationSec - 0.25),
        tempoRatio: 1.0,
        barAlignmentOffsetSec: 0,
        bassSwapEnabled: false,
        reason: 'Sequential album gapless transition'
      };
    }

    // 2. Beat-Matched Mix Decision
    if (outMeta && inMeta && outMeta.confidence >= 0.65 && inMeta.confidence >= 0.65) {
      const bpmA = outMeta.bpm;
      const bpmB = inMeta.bpm;

      // Check octave normalized tempo ratio (handling half-time and double-time)
      const ratios = [
        { ratio: bpmB / bpmA, scale: 1.0 },
        { ratio: (bpmB * 2) / bpmA, scale: 2.0 },
        { ratio: (bpmB * 0.5) / bpmA, scale: 0.5 }
      ];

      // Find closest ratio to 1.0
      let best = ratios[0];
      for (const candidate of ratios) {
        if (Math.abs(candidate.ratio - 1.0) < Math.abs(best.ratio - 1.0)) {
          best = candidate;
        }
      }

      // If normalized tempo is within 0.92 .. 1.08 (within 8% tempo pitch warp limit)
      if (best.ratio >= 0.92 && best.ratio <= 1.08) {
        const tempoRatio = Math.max(0.92, Math.min(1.08, 1 / best.ratio));

        // Musical bar duration for outgoing track (4 beats per bar)
        const barSec = 4 * outMeta.beatIntervalSec;
        // Quantize transition duration to 2 or 4 bars
        const durationSec = Math.max(this.options.minCrossfadeSec, Math.min(this.options.maxCrossfadeSec, barSec * 2));

        // Align Track B's first downbeat to Track A's bar boundary
        const barAlignmentOffsetSec = inMeta.firstDownbeatSec;

        return {
          mode: 'beat-matched',
          durationSec,
          cueInSec: 0,
          cueOutSec: Math.max(0, outMeta.outroStartSec || (outTrack.durationSec - durationSec)),
          tempoRatio,
          barAlignmentOffsetSec,
          bassSwapEnabled: true,
          reason: `Beat-matched at ~${Math.round(bpmB)} BPM (tempo adjustment: ${Math.round(tempoRatio * 100)}%)`
        };
      }
    }

    // 3. Equal-Power Crossfade Fallback
    // When tempos clash, confidence is low, or track metadata is missing
    const durationSec = this.options.defaultDurationSec;
    return {
      mode: 'equal-power-crossfade',
      durationSec,
      cueInSec: 0,
      cueOutSec: Math.max(0, outTrack.durationSec - durationSec),
      tempoRatio: 1.0,
      barAlignmentOffsetSec: 0,
      bassSwapEnabled: false,
      reason: 'Standard equal-power crossfade'
    };
  }

  /**
   * Applies the DSP parameters for progress t in [0.0, 1.0].
   */
  applyTransitionStep(
    outDeckId: 'deckA' | 'deckB',
    inDeckId: 'deckA' | 'deckB',
    t: number,
    decision: MixDecision,
    masterVolume = 1.0
  ): { outVol: number; inVol: number; bassCutDb: number } {
    const clampedT = Math.max(0, Math.min(1, t));

    // Equal-Power Curves: cos(t * PI/2) for out, sin(t * PI/2) for in
    // with subtle midpoint energy preservation curve
    const outCurve = Math.cos(clampedT * (Math.PI * 0.5));
    const inCurve = Math.sin(clampedT * (Math.PI * 0.5));
    const energyBoost = 1.0 + 0.05 * Math.sin(clampedT * Math.PI);

    const outVol = Math.max(0, Math.min(1, masterVolume * outCurve * energyBoost));
    const inVol = Math.max(0, Math.min(1, masterVolume * inCurve * energyBoost));

    const outDeck = this.getDeck(outDeckId);
    const inDeck = this.getDeck(inDeckId);

    // Apply playback volumes (via Web Audio GainNode or direct element fallback)
    const outGraph = this.deckGraphs.get(outDeckId);
    const inGraph = this.deckGraphs.get(inDeckId);

    if (outGraph && this.webAudioEnabled) {
      outGraph.gainNode.gain.setValueAtTime(outVol, this.audioCtx?.currentTime || 0);
      outDeck.volume = masterVolume; // Keep element volume up so Web Audio has headroom
    } else {
      outDeck.volume = outVol;
    }

    if (inGraph && this.webAudioEnabled) {
      inGraph.gainNode.gain.setValueAtTime(inVol, this.audioCtx?.currentTime || 0);
      inDeck.volume = masterVolume;
    } else {
      inDeck.volume = inVol;
    }

    // Bass Swap (200 Hz Low-Shelf) in Beat-Matched Mode
    let bassCutDb = 0;
    if (decision.bassSwapEnabled) {
      if (clampedT < 0.5) {
        // Outgoing has full bass, incoming is attenuated
        const inBassGain = this.options.bassCutMaxDb * (1.0 - clampedT * 2);
        bassCutDb = inBassGain;
        if (inGraph && this.webAudioEnabled) {
          inGraph.bassFilter.gain.setValueAtTime(inBassGain, this.audioCtx?.currentTime || 0);
        }
        if (outGraph && this.webAudioEnabled) {
          outGraph.bassFilter.gain.setValueAtTime(0, this.audioCtx?.currentTime || 0);
        }
      } else {
        // Incoming recovers full bass, outgoing bass cuts
        const outBassGain = this.options.bassCutMaxDb * ((clampedT - 0.5) * 2);
        bassCutDb = outBassGain;
        if (outGraph && this.webAudioEnabled) {
          outGraph.bassFilter.gain.setValueAtTime(outBassGain, this.audioCtx?.currentTime || 0);
        }
        if (inGraph && this.webAudioEnabled) {
          inGraph.bassFilter.gain.setValueAtTime(0, this.audioCtx?.currentTime || 0);
        }
      }

      // Tempo recovery: smoothly return incoming deck playbackRate to 1.0 after midpoint
      if (clampedT >= 0.5) {
        const recoveryProgress = (clampedT - 0.5) * 2; // 0..1
        const currentRate = decision.tempoRatio + (1.0 - decision.tempoRatio) * recoveryProgress;
        inDeck.playbackRate = currentRate;
      }
    }

    return { outVol, inVol, bassCutDb };
  }

  /**
   * Resets all filters and deck rates back to standard neutral values.
   */
  resetDeckDsp(): void {
    for (const [, graph] of this.deckGraphs) {
      if (this.audioCtx) {
        const now = this.audioCtx.currentTime;
        graph.bassFilter.gain.setValueAtTime(0, now);
        graph.gainNode.gain.setValueAtTime(1.0, now);
      }
    }
    this.deckA.playbackRate = 1.0;
    this.deckB.playbackRate = 1.0;
    this.deckA.preservesPitch = true;
    this.deckB.preservesPitch = true;
  }

  getDeck(deckId: 'deckA' | 'deckB'): HTMLAudioElement {
    return deckId === 'deckA' ? this.deckA : this.deckB;
  }

  getStandbyDeckId(): 'deckA' | 'deckB' {
    return this.activeDeckId === 'deckA' ? 'deckB' : 'deckA';
  }

  getActiveDeckId(): 'deckA' | 'deckB' {
    return this.activeDeckId;
  }

  setActiveDeckId(id: 'deckA' | 'deckB'): void {
    this.activeDeckId = id;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }
}
