/**
 * AutoMix Engine Runtime for My Music
 * Client-Side DSP Beat Analysis, Dual-Deck Web Audio Graph, Midpoint Handoff & Lyric Clock
 */

(function (root) {
  'use strict';

  // ==========================================================================
  // 1. Persistent IndexedDB Cache
  // ==========================================================================
  class AutoMixIndexedDbCache {
    constructor() {
      this.dbName = 'MyMusic_AutoMix_DB';
      this.storeName = 'track_meta';
      this.dbPromise = null;
    }

    getDB() {
      if (this.dbPromise) return this.dbPromise;
      this.dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
          return reject(new Error('IndexedDB not supported'));
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

    async get(trackId) {
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

    async set(trackId, meta) {
      try {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          const req = store.put(Object.assign({}, meta, { id: trackId }));
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      } catch (e) {
        console.warn('[AutoMix] Cache write error:', e);
      }
    }
  }

  // ==========================================================================
  // 2. Client-Side DSP Analyzer (OfflineAudioContext + 150 Hz Low-Pass)
  // ==========================================================================
  class AutoMixAnalyzer {
    constructor(cache) {
      this.cache = cache || new AutoMixIndexedDbCache();
      this.targetSampleRate = 22050;
      this.lowPassCutoffHz = 150;
    }

    estimateHeuristicBpm(track) {
      const dur = (track && track.durationSec) || 180;
      if (dur > 260) return 96;
      if (dur < 160) return 128;
      return 120;
    }

    async analyze(track) {
      if (!track || !track.id) return null;
      const cached = await this.cache.get(track.id);
      if (cached) return cached;

      // For remote streams, never perform background network downloads on active streaming URLs
      // Remote fetch causes YouTube CDN rate limits, socket contention, and player dropouts
      if (!track.localPath) {
        const bpm = this.estimateHeuristicBpm(track);
        const beatIntervalSec = 60 / bpm;
        const dur = (track && track.durationSec) || 180;
        const meta = {
          id: track.id,
          bpm,
          beatIntervalSec: Math.round(beatIntervalSec * 1000) / 1000,
          firstDownbeatSec: 0,
          introEndSec: 1.5,
          outroStartSec: Math.max(0, dur - 8),
          energyProfile: null,
          confidence: 0.6,
          analyzedAt: Date.now()
        };
        await this.cache.set(track.id, meta);
        return meta;
      }

      try {
        const rawBuffer = await this.loadAudioBuffer(track);
        if (!rawBuffer) return null;
        const meta = await this.processAudioData(track.id, rawBuffer, track.durationSec || 180);
        await this.cache.set(track.id, meta);
        return meta;
      } catch (err) {
        console.warn(`[AutoMixAnalyzer] Analysis failed for ${track.title || track.id}:`, err);
        return null;
      }
    }

    async loadAudioBuffer(track) {
      if (track.localPath) {
        const url = 'file:///' + track.localPath.replace(/\\/g, '/');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Local file read failed: ${res.statusText}`);
        return await res.arrayBuffer();
      }

      return null;
    }

    async processAudioData(trackId, rawBuffer, fallbackDurationSec) {
      const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;

      const tempCtx = new AudioCtxClass();
      let audioBuffer;
      try {
        audioBuffer = await tempCtx.decodeAudioData(rawBuffer.slice(0));
      } finally {
        tempCtx.close().catch(() => {});
      }

      const duration = audioBuffer.duration || fallbackDurationSec || 180;
      const offlineCtx = new OfflineCtxClass(1, Math.floor(duration * this.targetSampleRate), this.targetSampleRate);

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;

      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = this.lowPassCutoffHz;
      filter.Q.value = 1.0;

      source.connect(filter);
      filter.connect(offlineCtx.destination);
      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      const pcm = renderedBuffer.getChannelData(0);

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

    computeOnsetEnvelope(pcm, sampleRate) {
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
        const diff = Math.max(0, energy - prevEnergy);
        onsets[f] = diff;
        prevEnergy = energy;
      }
      return { onsets, hopSec };
    }

    estimateBpmAutocorrelation(onsets, hopSec) {
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

      let finalBpm = rawBpm;
      if (finalBpm < 70) finalBpm *= 2;
      if (finalBpm > 175) finalBpm /= 2;

      return { bpm: finalBpm, confidence };
    }

    findFirstDownbeat(onsets, hopSec, beatIntervalSec) {
      const searchLimitFrames = Math.min(onsets.length, Math.floor(25 / hopSec));
      let peakIndex = 0;
      let maxVal = 0;

      for (let i = 0; i < searchLimitFrames; i++) {
        if (onsets[i] > maxVal) {
          maxVal = onsets[i];
          peakIndex = i;
        }
      }

      const rawTime = peakIndex * hopSec;
      return Math.max(0, rawTime % beatIntervalSec);
    }

    computeEnergyProfile(pcm, bins = 32) {
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

      return profile.map((v) => Math.round((v / maxBin) * 100) / 100);
    }

    detectIntroOutro(energy, durationSec, firstDownbeatSec, beatIntervalSec) {
      const barSec = 4 * beatIntervalSec;

      let introBin = 1;
      for (let i = 0; i < Math.floor(energy.length * 0.3); i++) {
        if (energy[i] >= 0.4) {
          introBin = i;
          break;
        }
      }
      const rawIntroSec = (introBin / energy.length) * durationSec;
      const introEndSec = Math.max(firstDownbeatSec, Math.round(rawIntroSec / barSec) * barSec);

      let outroBin = Math.floor(energy.length * 0.88);
      for (let i = energy.length - 1; i >= Math.floor(energy.length * 0.7); i--) {
        if (energy[i] <= 0.35) {
          outroBin = i;
        } else {
          break;
        }
      }
      const rawOutroSec = (outroBin / energy.length) * durationSec;
      const barsFromDownbeat = Math.floor((rawOutroSec - firstDownbeatSec) / barSec);
      const outroStartSec = Math.max(durationSec * 0.65, firstDownbeatSec + barsFromDownbeat * barSec);

      return { introEndSec, outroStartSec };
    }
  }

  // ==========================================================================
  // 3. Dual-Deck Playback & DSP Routing Controller
  // ==========================================================================
  class AutoMixEngine {
    constructor(deckA, deckB, options = {}) {
      this.deckA = deckA;
      this.deckB = deckB;
      this.activeDeckId = 'deckA';

      this.options = Object.assign({
        enabled: true,
        defaultDurationSec: 6.0,
        minCrossfadeSec: 2.5,
        maxCrossfadeSec: 12.0,
        bassCutFrequencyHz: 200,
        bassCutMaxDb: -24,
        preferWebAudio: true
      }, options);

      this.audioCtx = null;
      this.masterGain = null;
      this.analyser = null;
      this.deckGraphs = new Map();
      this.webAudioEnabled = false;
      this.currentSinkId = 'default';

      if (this.options.preferWebAudio) {
        this.initWebAudioGraph().catch(() => {});
      }
    }

    async setSinkId(deviceId) {
      this.currentSinkId = deviceId || 'default';
      if (this.audioCtx && typeof this.audioCtx.setSinkId === 'function') {
        try {
          await this.audioCtx.setSinkId(this.currentSinkId);
        } catch (e) {
          console.warn('[AutoMixEngine] setSinkId error:', e);
        }
      }
    }

    async initWebAudioGraph() {
      if (this.webAudioEnabled && this.audioCtx) return;
      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtxClass) return;

        this.audioCtx = new AudioCtxClass();
        if (this.currentSinkId && typeof this.audioCtx.setSinkId === 'function') {
          this.audioCtx.setSinkId(this.currentSinkId).catch(err => {
            console.warn('[AutoMixEngine] Initial setSinkId error:', err);
          });
        }
        if (this.audioCtx.state === 'suspended') {
          const resume = () => {
            this.audioCtx?.resume();
            window.removeEventListener('click', resume);
            window.removeEventListener('keydown', resume);
          };
          window.addEventListener('click', resume);
          window.addEventListener('keydown', resume);
        }

        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.value = 1.0;

        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.82;

        // Transparent mastering soft-knee peak limiter: prevents digital clipping/distortion on bass boost
        this.limiter = this.audioCtx.createDynamicsCompressor();
        this.limiter.threshold.setValueAtTime(-1.2, 0);
        this.limiter.knee.setValueAtTime(8.0, 0);
        this.limiter.ratio.setValueAtTime(8.0, 0);
        this.limiter.attack.setValueAtTime(0.012, 0);
        this.limiter.release.setValueAtTime(0.18, 0);

        this.relinkMasterDsp();
        this.analyser.connect(this.limiter);
        this.limiter.connect(this.audioCtx.destination);

        this.wireDeckToGraph('deckA', this.deckA);
        this.wireDeckToGraph('deckB', this.deckB);

        this.webAudioEnabled = true;
      } catch (e) {
        console.warn('[AutoMixEngine] Web Audio routing fallback:', e);
        this.webAudioEnabled = false;
      }
    }

    relinkMasterDsp() {
      if (!this.masterGain || !this.analyser) return;
      try {
        this.masterGain.disconnect();
        let tail = this.masterGain;

        if (typeof window.getDspEqChain === 'function') {
          const eqChain = window.getDspEqChain(this.audioCtx);
          if (eqChain && eqChain.in && eqChain.out) {
            tail.connect(eqChain.in);
            tail = eqChain.out;
          }
        }

        const dj = window.liveDjStudioInstance;
        if (dj && dj.initialized && dj.inputNode && dj.outputNode) {
          tail.connect(dj.inputNode);
          try { dj.outputNode.disconnect(); } catch {}
          dj.outputNode.connect(this.analyser);
        } else {
          tail.connect(this.analyser);
        }
      } catch (e) {
        console.warn('[AutoMixEngine] relinkMasterDsp fallback:', e);
        try { this.masterGain.connect(this.analyser); } catch {}
      }
    }

    attachLiveDjStudio(liveDj) {
      this.relinkMasterDsp();
    }

    wireDeckToGraph(deckId, deckEl) {
      if (typeof window !== 'undefined' && (window.AndroidNative || (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)))) {
        this.webAudioEnabled = false;
        return;
      }
      if (!this.audioCtx || !this.masterGain) return;
      if (this.deckGraphs.has(deckId)) return;
      try {
        const sourceNode = this.audioCtx.createMediaElementSource(deckEl);

        const bassFilter = this.audioCtx.createBiquadFilter();
        bassFilter.type = 'lowshelf';
        bassFilter.frequency.value = this.options.bassCutFrequencyHz || 200;
        bassFilter.gain.value = 0.0;

        const sweepFilter = this.audioCtx.createBiquadFilter();
        sweepFilter.type = 'lowpass';
        sweepFilter.frequency.value = 22050;
        sweepFilter.Q.value = 0.707;

        const gainNode = this.audioCtx.createGain();
        gainNode.gain.value = 1.0;

        sourceNode.connect(bassFilter);
        bassFilter.connect(sweepFilter);
        sweepFilter.connect(gainNode);
        gainNode.connect(this.masterGain);

        this.deckGraphs.set(deckId, { sourceNode, bassFilter, sweepFilter, gainNode });
      } catch (e) {
        console.warn(`[AutoMixEngine] Cannot wire ${deckId} via MediaElementSource (CORS fallback active):`, e);
      }
    }

    makeMixDecision(outTrack, inTrack, outMeta, inMeta, isSequentialAlbum = false) {
      if (!this.options.enabled) {
        return {
          mode: 'equal-power-crossfade',
          durationSec: 0.1,
          cueInSec: 0,
          cueOutSec: (outTrack?.durationSec || 180) - 0.1,
          tempoRatio: 1.0,
          barAlignmentOffsetSec: 0,
          bassSwapEnabled: false,
          filterSweepEnabled: false,
          reason: 'AutoMix is disabled'
        };
      }

      // Smart Intro Cue: skip dead intro silence so incoming track grooves immediately
      let cueInSec = 0;
      if (inMeta && inMeta.firstDownbeatSec && inMeta.firstDownbeatSec > 0.6) {
        cueInSec = Math.min(inMeta.firstDownbeatSec, 3.8);
      } else if (inMeta && inMeta.introEndSec && inMeta.introEndSec > 2.0) {
        cueInSec = Math.min(inMeta.introEndSec * 0.35, 3.2);
      }

      // 1. Beat-Matched Mix (Expanded BPM compatibility window)
      if (outMeta && inMeta && outMeta.bpm && inMeta.bpm) {
        const bpmA = outMeta.bpm;
        const bpmB = inMeta.bpm;

        const candidates = [
          { ratio: bpmB / bpmA, scale: 1.0 },
          { ratio: (bpmB * 2) / bpmA, scale: 2.0 },
          { ratio: (bpmB * 0.5) / bpmA, scale: 0.5 },
          { ratio: (bpmB * 1.3333) / bpmA, scale: 1.3333 },
          { ratio: (bpmB * 0.75) / bpmA, scale: 0.75 }
        ];

        let best = candidates[0];
        for (const c of candidates) {
          if (Math.abs(c.ratio - 1.0) < Math.abs(best.ratio - 1.0)) {
            best = c;
          }
        }

        // Allow up to ±14% tempo matching
        if (best.ratio >= 0.86 && best.ratio <= 1.14) {
          const tempoRatio = Math.max(0.86, Math.min(1.14, 1 / best.ratio));
          const barSec = (outMeta.beatIntervalSec ? 4 * outMeta.beatIntervalSec : 2.0);
          const durationSec = Math.max(6.0, Math.min(10.0, barSec * 2));
          const cueOutSec = Math.max(0, (outTrack?.durationSec || 180) - durationSec);

          return {
            mode: 'beat-matched',
            durationSec,
            cueInSec,
            cueOutSec,
            tempoRatio,
            barAlignmentOffsetSec: inMeta.firstDownbeatSec || 0,
            bassSwapEnabled: true,
            filterSweepEnabled: true,
            reason: `Beat-matched at ~${Math.round(bpmB)} BPM (${Math.round(tempoRatio * 100)}% tempo sync, 2-bar mix)`
          };
        }
      }

      // 2. Sequential Album: Smooth musical blend with bass swap (NOT an abrupt 0.25s gapless cut!)
      if (isSequentialAlbum) {
        const durationSec = 4.8;
        return {
          mode: 'album-blend',
          durationSec,
          cueInSec: Math.min(cueInSec, 1.2),
          cueOutSec: Math.max(0, (outTrack?.durationSec || 180) - durationSec),
          tempoRatio: 1.0,
          barAlignmentOffsetSec: 0,
          bassSwapEnabled: true,
          filterSweepEnabled: true,
          reason: 'Sequential album DJ mix with low-end bass swap'
        };
      }

      // 3. Dynamic DJ Filter Blend (Energy Crossfade + Bass Swap + Filter Sweep)
      const durationSec = Math.max(6.0, Math.min(10.0, this.options.defaultDurationSec || 7.0));
      return {
        mode: 'dj-filter-blend',
        durationSec,
        cueInSec,
        cueOutSec: Math.max(0, (outTrack?.durationSec || 180) - durationSec),
        tempoRatio: 1.0,
        barAlignmentOffsetSec: 0,
        bassSwapEnabled: true,
        filterSweepEnabled: true,
        reason: 'DJ filter sweep transition with 200Hz bass swap'
      };
    }

    applyTransitionStep(outDeckId, inDeckId, t, decision, masterVolume = 1.0) {
      const clampedT = Math.max(0, Math.min(1, t));

      // Asymmetric DJ Transition Curve with midpoint energy preservation (no volume dip)
      const outCurve = Math.pow(Math.cos(clampedT * (Math.PI * 0.5)), 0.78);
      const inCurve = Math.pow(Math.sin(clampedT * (Math.PI * 0.5)), 1.15);
      const energyBoost = 1.0 + 0.08 * Math.sin(clampedT * Math.PI);

      const outVol = Math.max(0, Math.min(1, masterVolume * outCurve * energyBoost));
      const inVol = Math.max(0, Math.min(1, masterVolume * inCurve * energyBoost));

      const outDeck = this.getDeck(outDeckId);
      const inDeck = this.getDeck(inDeckId);

      const outGraph = this.deckGraphs.get(outDeckId);
      const inGraph = this.deckGraphs.get(inDeckId);

      const now = this.audioCtx?.currentTime || 0;

      if (outGraph && this.webAudioEnabled) {
        outGraph.gainNode.gain.setValueAtTime(outVol, now);
        outDeck.volume = masterVolume;
      } else {
        outDeck.volume = outVol;
      }

      if (inGraph && this.webAudioEnabled) {
        inGraph.gainNode.gain.setValueAtTime(inVol, now);
        inDeck.volume = masterVolume;
      } else {
        inDeck.volume = inVol;
      }

      // 1. Dynamic 200 Hz Bass Swap (Crucial DJ Transition Element)
      if (decision.bassSwapEnabled !== false) {
        if (clampedT < 0.5) {
          const inBassGain = (this.options.bassCutMaxDb || -24) * (1.0 - clampedT * 2);
          if (inGraph && this.webAudioEnabled && inGraph.bassFilter) {
            inGraph.bassFilter.gain.setValueAtTime(inBassGain, now);
          }
          if (outGraph && this.webAudioEnabled && outGraph.bassFilter) {
            outGraph.bassFilter.gain.setValueAtTime(0, now);
          }
        } else {
          const outBassGain = (this.options.bassCutMaxDb || -24) * ((clampedT - 0.5) * 2);
          if (outGraph && this.webAudioEnabled && outGraph.bassFilter) {
            outGraph.bassFilter.gain.setValueAtTime(outBassGain, now);
          }
          if (inGraph && this.webAudioEnabled && inGraph.bassFilter) {
            inGraph.bassFilter.gain.setValueAtTime(0, now);
          }
        }
      }

      // 2. DJ Low-Pass Filter Sweep (Smoothly dissolves outgoing highs after midpoint)
      if (decision.filterSweepEnabled !== false && this.webAudioEnabled) {
        if (clampedT >= 0.35 && outGraph && outGraph.sweepFilter) {
          const sweepP = (clampedT - 0.35) / 0.65;
          const freq = Math.max(500, 22050 - Math.pow(sweepP, 1.6) * 21450);
          outGraph.sweepFilter.frequency.setValueAtTime(freq, now);
        } else if (outGraph && outGraph.sweepFilter) {
          outGraph.sweepFilter.frequency.setValueAtTime(22050, now);
        }

        if (inGraph && inGraph.sweepFilter) {
          inGraph.sweepFilter.frequency.setValueAtTime(22050, now);
        }
      }

      // 3. Tempo Recovery (Return incoming deck smoothly to 1.0x after midpoint)
      if (decision.tempoRatio && decision.tempoRatio !== 1.0) {
        if (clampedT >= 0.5) {
          const recoveryProgress = (clampedT - 0.5) * 2;
          const currentRate = decision.tempoRatio + (1.0 - decision.tempoRatio) * recoveryProgress;
          inDeck.playbackRate = currentRate;
        } else {
          inDeck.playbackRate = decision.tempoRatio;
        }
      }

      return { outVol, inVol };
    }

    resetDeckDsp() {
      for (const [, graph] of this.deckGraphs) {
        if (this.audioCtx) {
          const now = this.audioCtx.currentTime;
          if (graph.bassFilter) graph.bassFilter.gain.setValueAtTime(0, now);
          if (graph.sweepFilter) graph.sweepFilter.frequency.setValueAtTime(22050, now);
          if (graph.gainNode) graph.gainNode.gain.setValueAtTime(1.0, now);
        }
      }
      this.deckA.playbackRate = 1.0;
      this.deckB.playbackRate = 1.0;
      this.deckA.preservesPitch = true;
      this.deckB.preservesPitch = true;
    }

    getDeck(deckId) {
      return deckId === 'deckA' ? this.deckA : this.deckB;
    }

    getStandbyDeckId() {
      return this.activeDeckId === 'deckA' ? 'deckB' : 'deckA';
    }

    getActiveDeckId() {
      return this.activeDeckId;
    }

    setActiveDeckId(id) {
      this.activeDeckId = id;
    }

    getAnalyser() {
      return this.analyser;
    }
  }

  // ==========================================================================
  // 4. Lyric Clock Binder (Direct currentTime Tracking without setInterval Drift)
  // ==========================================================================
  class LyricClockBinder {
    constructor() {
      this.activeDeck = null;
      this.lyrics = null;
      this.offsetSec = 0;
      this.callback = null;
      this.rafId = 0;
      this.lastIndex = -1;
      this.running = false;
    }

    bind(deck, lyrics, offsetMs = 0, callback) {
      this.unbind();

      this.activeDeck = deck;
      this.lyrics = lyrics;
      this.offsetSec = offsetMs / 1000;
      if (callback) this.callback = callback;
      this.lastIndex = -1;
      this.running = true;

      if (!lyrics?.synced || lyrics.synced.length === 0) {
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

      const tick = () => {
        if (!this.running || !this.activeDeck || !this.lyrics?.synced) return;

        const audioTime = this.activeDeck.currentTime + this.offsetSec;
        const index = this.findActiveLineIndex(this.lyrics.synced, audioTime);

        if (index !== this.lastIndex) {
          this.lastIndex = index;
          const currentLine = index >= 0 ? this.lyrics.synced[index] : null;
          const nextLine = (index >= 0 && index + 1 < this.lyrics.synced.length) ? this.lyrics.synced[index + 1] : null;

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

    findActiveLineIndex(lines, time) {
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

    setOffsetMs(offsetMs) {
      this.offsetSec = offsetMs / 1000;
    }

    unbind() {
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

  // ==========================================================================
  // 5. Transition Coordinator (Lifecycle State Machine)
  // ==========================================================================
  class TransitionCoordinator {
    constructor(engine, analyzer) {
      this.engine = engine;
      this.analyzer = analyzer;
      this.state = 'IDLE';
      this.listeners = {};

      this.currentTrack = null;
      this.currentMeta = null;
      this.preloadedTrack = null;
      this.preloadedMeta = null;
      this.preloadedLyrics = null;

      this.rafId = 0;
      this.mixStartTime = 0;
      this.mixDurationSec = 6;
      this.activeDecision = null;
      this.outDeckId = 'deckA';
      this.inDeckId = 'deckB';
      this.midpointHandedOff = false;
    }

    on(event, listener) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(listener);
      return () => {
        this.listeners[event] = this.listeners[event].filter((l) => l !== listener);
      };
    }

    emit(event, payload) {
      const list = this.listeners[event];
      if (list) {
        for (const fn of list) fn(payload);
      }
    }

    getState() {
      return this.state;
    }

    setInitialTrack(track, deckId = 'deckA') {
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

    async preloadNextTrack(nextTrack, fetchLyricsFn) {
      if (this.state === 'MIXING') return;

      this.setState('PRELOADING');
      this.preloadedTrack = nextTrack;
      const standbyDeckId = this.engine.getStandbyDeckId();
      const standbyDeck = this.engine.getDeck(standbyDeckId);

      try {
        standbyDeck.src = nextTrack.streamUrl || (nextTrack.localPath ? 'file:///' + nextTrack.localPath.replace(/\\/g, '/') : '');
        standbyDeck.volume = 0;
        standbyDeck.preload = 'auto';
        standbyDeck.load();

        const [meta, lyrics] = await Promise.all([
          this.analyzer.analyze(nextTrack).catch(() => null),
          fetchLyricsFn ? fetchLyricsFn(nextTrack).catch(() => ({ synced: null, plain: null, source: 'none' })) : Promise.resolve(nextTrack.lyrics || null)
        ]);

        this.preloadedMeta = meta;
        this.preloadedLyrics = lyrics;
        nextTrack.lyrics = lyrics || undefined;
      } catch (err) {
        console.warn('[TransitionCoordinator] Preload error:', err);
      }
    }

    async startTransition(isSequentialAlbum = false, masterVolume = 1.0) {
      if (!this.currentTrack || !this.preloadedTrack || this.state === 'MIXING') return;

      const outTrack = this.currentTrack;
      const inTrack = this.preloadedTrack;

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

      inDeck.currentTime = decision.cueInSec || 0;
      inDeck.preservesPitch = true;
      inDeck.playbackRate = decision.tempoRatio || 1.0;
      inDeck.volume = 0.0;

      try {
        await inDeck.play();
      } catch (e) {
        console.warn('[TransitionCoordinator] In-deck play failed:', e);
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

      const step = (now) => {
        if (this.state !== 'MIXING') return;

        const elapsedSec = (now - this.mixStartTime) / 1000;
        const t = Math.min(1.0, Math.max(0.0, elapsedSec / this.mixDurationSec));

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

        // Midpoint Handoff (t >= 0.5)
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

    completeTransition(finalTrack) {
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

    abortTransition(reason) {
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

    setState(newState) {
      if (this.state !== newState) {
        this.state = newState;
        this.emit('onStateChange', newState);
      }
    }
  }

  // Export to global window object
  root.AutoMix = {
    AutoMixIndexedDbCache,
    AutoMixAnalyzer,
    AutoMixEngine,
    LyricClockBinder,
    TransitionCoordinator
  };

})(typeof window !== 'undefined' ? window : globalThis);
