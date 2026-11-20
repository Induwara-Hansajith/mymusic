/**
 * AutoMix Engine for My Music
 * TypeScript Type Definitions & Interfaces
 */

export interface AutoMixTrack {
  id: string;               // Video ID or local file hash
  title: string;
  artist: string;
  album?: string;
  albumIndex?: number;      // Track number on album (for sequential album detection)
  durationSec: number;
  thumb?: string;
  streamUrl?: string;       // Direct audio stream URL (YouTube CDN or file://)
  localPath?: string;       // Absolute path if stored in Music/My Music
  lyrics?: LyricsModel;
}

export interface LyricsLine {
  t: number;                // Timestamp in seconds
  text: string;
}

export interface LyricsModel {
  synced: LyricsLine[] | null;
  plain: string | null;
  source: 'lrclib' | 'ytm' | 'local' | 'none';
}

export interface AutoMixTrackMeta {
  id: string;
  bpm: number;
  beatIntervalSec: number;   // 60 / bpm
  firstDownbeatSec: number;  // Offset to the first accented downbeat
  introEndSec: number;       // Where full instrumentation/vocals start
  outroStartSec: number;     // Quantized bar boundary where track winds down
  energyProfile: number[];   // Normalized 32-bin energy curve
  confidence: number;        // 0.0 to 1.0 detection confidence
  analyzedAt: number;        // Unix timestamp
}

export type AutoMixMode = 'gapless-album' | 'beat-matched' | 'equal-power-crossfade';

export interface MixDecision {
  mode: AutoMixMode;
  durationSec: number;
  cueInSec: number;          // Where incoming track should begin playback
  cueOutSec: number;         // Where outgoing track begins its fade out
  tempoRatio: number;        // In-track playbackRate scale factor (e.g. 0.98..1.02)
  barAlignmentOffsetSec: number;
  bassSwapEnabled: boolean;
  reason: string;
}

export type TransitionState =
  | 'IDLE'
  | 'PRELOADING'
  | 'MIXING'
  | 'COMPLETED'
  | 'ABORTED';

export interface TransitionProgressPayload {
  t: number;                 // Normalized progress 0.0 .. 1.0
  elapsedSec: number;
  durationSec: number;
  outVolume: number;         // 0.0 .. 1.0
  inVolume: number;          // 0.0 .. 1.0
  outDeckId: 'deckA' | 'deckB';
  inDeckId: 'deckA' | 'deckB';
  bassCutDb: number;         // Current bass attenuation in dB
}

export interface MidpointHandoffPayload {
  activeTrack: AutoMixTrack;
  activeDeckId: 'deckA' | 'deckB';
  inDeck: HTMLAudioElement;
  cueInSec: number;
  playbackRate: number;
  lyrics: LyricsModel;
}

export interface MixStartPayload {
  outTrack: AutoMixTrack;
  inTrack: AutoMixTrack;
  decision: MixDecision;
  durationSec: number;
  outDeckId: 'deckA' | 'deckB';
  inDeckId: 'deckA' | 'deckB';
}

export interface MixCompletePayload {
  activeTrack: AutoMixTrack;
  activeDeckId: 'deckA' | 'deckB';
}

export interface MixAbortPayload {
  reason: string;
  activeTrack: AutoMixTrack | null;
  activeDeckId: 'deckA' | 'deckB';
}

export interface TransitionEvents {
  onStateChange: (state: TransitionState) => void;
  onMixStart: (payload: MixStartPayload) => void;
  onMixProgress: (payload: TransitionProgressPayload) => void;
  onMidpointHandoff: (payload: MidpointHandoffPayload) => void;
  onMixComplete: (payload: MixCompletePayload) => void;
  onMixAbort: (payload: MixAbortPayload) => void;
}

export interface AutoMixStorageCache {
  get(trackId: string): Promise<AutoMixTrackMeta | null>;
  set(trackId: string, meta: AutoMixTrackMeta): Promise<void>;
  has(trackId: string): Promise<boolean>;
  clear(): Promise<void>;
}

export interface AutoMixEngineOptions {
  enabled?: boolean;
  defaultDurationSec?: number;
  minCrossfadeSec?: number;
  maxCrossfadeSec?: number;
  bassCutFrequencyHz?: number;
  bassCutMaxDb?: number;
  preferWebAudio?: boolean;
}
