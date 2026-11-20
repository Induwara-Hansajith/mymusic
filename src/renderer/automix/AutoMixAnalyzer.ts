/**
 * AutoMixAnalyzer
 * Client-Side DSP Pipeline for Beat, Downbeat & Outro Detection
 *
 * Runs on decoded mono PCM via OfflineAudioContext at 22,050 Hz with a 150 Hz
 * low-pass filter to isolate kick and sub-bass transients without blocking playback.
 */

import { AutoMixTrack, AutoMixTrackMeta, AutoMixStorageCache } from './types';

export class AutoMixIndexedDbCache implements AutoMixStorageCache {
  private dbName = 'MyMusic_AutoMix_DB';
  private storeName = 'track_meta';
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB not supported in this context'));
      }
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return this.dbPromise;
  }

  async get(trackId: string): Promise<AutoMixTrackMeta | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(trackId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async set(trackId: string, meta: AutoMixTrackMeta): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put({ ...meta, id: trackId });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[AutoMixAnalyzer] Cache write failed:', e);
    }
  }

  async has(trackId: string): Promise<boolean> {
    const item = await this.get(trackId);
    return item !== null;
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).clear();
    } catch {}
  }
}

export class AutoMixAnalyzer {
  private cache: AutoMixStorageCache;
  private targetSampleRate = 22050; // High enough for sub-bass/kicks, light enough for fast decode
  private lowPassCutoffHz = 150;    // Isolates kick drum & bass transients

  constructor(cache?: AutoMixStorageCache) {
    this.cache = cache || new AutoMixIndexedDbCache();
  }

  /**
   * Primary entry point: analyzes an AutoMixTrack or returns cached analysis.
   */
  async analyze(track: AutoMixTrack): Promise<AutoMixTrackMeta> {
    // 1. Check cache first
    const cached = await this.cache.get(track.id);
    if (cached) {
      return cached;
    }

    // 2. Fetch audio array buffer (local file or bounded stream range)
    const arrayBuffer = await this.loadAudioBuffer(track);

    // 3. Run DSP analysis pipeline
    const meta = await this.processAudioData(track.id, arrayBuffer, track.durationSec);

    // 4. Save to persistent cache
    await this.cache.set(track.id, meta);
    return meta;
  }

  /**
   * Loads the audio data. For local offline files, reads the local buffer.
   * For remote streams, uses Range request to download a bounded chunk (up to 2.5 MB)
   * avoiding full file downloads when estimating tempo and energy.
   */
  private async loadAudioBuffer(track: AutoMixTrack): Promise<ArrayBuffer> {
    if (track.localPath) {
      const fileUrl = 'file:///' + track.localPath.replace(/\\/g, '/');
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`Failed to load local track: ${res.statusText}`);
      return await res.arrayBuffer();
    }

    if (!track.streamUrl) {
      throw new Error(`Track ${track.id} has no streamUrl or localPath`);
    }

    // Attempt bounded HTTP Range download (first ~2 MB contains intro and tempo patterns)
    try {
      const rangeRes = await fetch(track.streamUrl, {
        headers: { Range: 'bytes=0-2097152' }
      });
      if (rangeRes.ok || rangeRes.status === 206) {
        return await rangeRes.arrayBuffer();
      }
    } catch {
      // Fallback to unconstrained fetch if Range is not supported
    }

    const fallbackRes = await fetch(track.streamUrl);
    if (!fallbackRes.ok) throw new Error(`Stream fetch failed: ${fallbackRes.statusText}`);
    return await fallbackRes.arrayBuffer();
  }

  /**
   * Runs the OfflineAudioContext filtering and autocorrelation pipeline on PCM data.
   */
  private async processAudioData(
    trackId: string,
    rawBuffer: ArrayBuffer,
    fallbackDurationSec: number
  ): Promise<AutoMixTrackMeta> {
    // Decode audio into PCM
    const OfflineCtxClass = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    const tempCtx = new AudioCtxClass();
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await tempCtx.decodeAudioData(rawBuffer.slice(0));
    } finally {
      tempCtx.close().catch(() => {});
    }

    const duration = audioBuffer.duration || fallbackDurationSec || 180;
    const offlineCtx = new OfflineCtxClass(1, Math.floor(duration * this.targetSampleRate), this.targetSampleRate);

    // Source node
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    // 150 Hz 2nd-order Low-Pass Filter
    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.lowPassCutoffHz;
    filter.Q.value = 1.0;

    source.connect(filter);
    filter.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const pcm = renderedBuffer.getChannelData(0);

    // Extract onset envelope & features
    const { onsets, hopSec } = this.computeOnsetEnvelope(pcm, this.targetSampleRate);
    const { bpm, confidence } = this.estimateBpmAutocorrelation(onsets, hopSec);
    const beatIntervalSec = 60 / Math.max(50, Math.min(220, bpm));

    const firstDownbeatSec = this.findFirstDownbeat(onsets, hopSec, beatIntervalSec);
    const energyProfile = this.computeEnergyProfile(pcm, 32);
    const { introEndSec, outroStartSec } = this.detectIntroOutro(
      energyProfile,
      duration,
      firstDownbeatSec,
      beatIntervalSec
    );

    return {
      id: trackId,
      bpm: Math.round(bpm * 10) / 10,
      beatIntervalSec: Math.round(beatIntervalSec * 1000) / 1000,
      firstDownbeatSec: Math.round(firstDownbeatSec * 100) / 100,
      introEndSec: Math.round(introEndSec * 10) / 10,
      outroStartSec: Math.round(outroStartSec * 10) / 10,
      energyProfile,
      confidence: Math.round(confidence * 100) / 100,
      analyzedAt: Date.now()
    };
  }

  /**
   * Computes onset strength signal via spectral / half-wave rectified energy differences.
   */
  private computeOnsetEnvelope(
    pcm: Float32Array,
    sampleRate: number
  ): { onsets: Float32Array; hopSec: number } {
    const frameSize = 1024;
    const hopSize = 512;
    const numFrames = Math.floor((pcm.length - frameSize) / hopSize);
    const onsets = new Float32Array(Math.max(1, numFrames));
    const hopSec = hopSize / sampleRate;

    let prevEnergy = 0;
    for (let f = 0; f < numFrames; f++) {
      let energy = 0;
      const start = f * hopSize;
      for (let i = 0; i < frameSize; i++) {
        const val = pcm[start + i];
        energy += val * val;
      }
      energy = Math.sqrt(energy / frameSize);

      // Half-wave rectified first-order difference
      const diff = Math.max(0, energy - prevEnergy);
      onsets[f] = diff;
      prevEnergy = energy;
    }

    return { onsets, hopSec };
  }

  /**
   * Autocorrelates the onset envelope across tempo lags (60..180 BPM range).
   */
  private estimateBpmAutocorrelation(
    onsets: Float32Array,
    hopSec: number
  ): { bpm: number; confidence: number } {
    const minBpm = 65;
    const maxBpm = 185;
    const minLag = Math.floor(60 / (maxBpm * hopSec));
    const maxLag = Math.ceil(60 / (minBpm * hopSec));

    if (onsets.length < maxLag * 2) {
      return { bpm: 120, confidence: 0.2 };
    }

    let maxCorr = 0;
    let bestLag = Math.round(60 / (120 * hopSec));
    let meanCorr = 0;
    let corrCount = 0;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      const limit = onsets.length - lag;
      for (let i = 0; i < limit; i++) {
        sum += onsets[i] * onsets[i + lag];
      }
      const norm = sum / limit;

      // Subtle Gaussian weighting curve centered around 118 BPM (standard pop/hip-hop/dance bias)
      const currentBpm = 60 / (lag * hopSec);
      const tempoPrior = Math.exp(-0.5 * Math.pow((currentBpm - 118) / 45, 2));
      const weightedScore = norm * (0.85 + 0.3 * tempoPrior);

      meanCorr += norm;
      corrCount++;

      if (weightedScore > maxCorr) {
        maxCorr = weightedScore;
        bestLag = lag;
      }
    }

    const rawBpm = 60 / (bestLag * hopSec);
    meanCorr = corrCount > 0 ? meanCorr / corrCount : 1;
    const peakRatio = meanCorr > 0 ? maxCorr / meanCorr : 1;
    const confidence = Math.max(0, Math.min(1, (peakRatio - 1.2) / 2.0));

    // Normalize octave (prefer 75..155 range)
    let finalBpm = rawBpm;
    if (finalBpm < 70) finalBpm *= 2;
    if (finalBpm > 175) finalBpm /= 2;

    return { bpm: finalBpm, confidence };
  }

  /**
   * Finds the timestamp of the first strong musical downbeat.
   */
  private findFirstDownbeat(
    onsets: Float32Array,
    hopSec: number,
    beatIntervalSec: number
  ): number {
    const searchLimitFrames = Math.min(onsets.length, Math.floor(25 / hopSec)); // First 25s
    let peakIndex = 0;
    let maxVal = 0;

    for (let i = 0; i < searchLimitFrames; i++) {
      if (onsets[i] > maxVal) {
        maxVal = onsets[i];
        peakIndex = i;
      }
    }

    const rawTime = peakIndex * hopSec;
    // Quantize to closest fraction of beat interval
    return Math.max(0, rawTime % beatIntervalSec);
  }

  /**
   * Calculates a normalized 32-bin energy curve across the track.
   */
  private computeEnergyProfile(pcm: Float32Array, bins = 32): number[] {
    const profile = new Array(bins).fill(0);
    const binSize = Math.floor(pcm.length / bins);
    let maxBin = 0.0001;

    for (let b = 0; b < bins; b++) {
      let sum = 0;
      const start = b * binSize;
      for (let i = 0; i < binSize; i++) {
        sum += Math.abs(pcm[start + i]);
      }
      profile[b] = sum / binSize;
      if (profile[b] > maxBin) maxBin = profile[b];
    }

    // Normalize 0.0 .. 1.0
    return profile.map((v) => Math.round((v / maxBin) * 100) / 100);
  }

  /**
   * Estimates intro end and outro start, quantized to 4-beat bar boundaries.
   */
  private detectIntroOutro(
    energy: number[],
    durationSec: number,
    firstDownbeatSec: number,
    beatIntervalSec: number
  ): { introEndSec: number; outroStartSec: number } {
    const barSec = 4 * beatIntervalSec;

    // Intro end: where energy crosses 40% of track average
    let introBin = 1;
    for (let i = 0; i < Math.floor(energy.length * 0.3); i++) {
      if (energy[i] >= 0.4) {
        introBin = i;
        break;
      }
    }
    const rawIntroSec = (introBin / energy.length) * durationSec;
    const introEndSec = Math.max(firstDownbeatSec, Math.round(rawIntroSec / barSec) * barSec);

    // Outro start: where energy drops toward end of track
    let outroBin = Math.floor(energy.length * 0.88);
    for (let i = energy.length - 1; i >= Math.floor(energy.length * 0.7); i--) {
      if (energy[i] <= 0.35) {
        outroBin = i;
      } else {
        break;
      }
    }
    const rawOutroSec = (outroBin / energy.length) * durationSec;
    // Quantize outro start to a bar boundary relative to first downbeat
    const barsFromDownbeat = Math.floor((rawOutroSec - firstDownbeatSec) / barSec);
    const outroStartSec = Math.max(durationSec * 0.65, firstDownbeatSec + barsFromDownbeat * barSec);

    return { introEndSec, outroStartSec };
  }
}
