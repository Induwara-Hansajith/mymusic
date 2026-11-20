// ==========================================================================
// My Music - Live DJ Studio & 8D Spatial Audio Engine
// Real-Time Web Audio DSP: 360° HRTF Binaural Panner, Pseudo-Stereo Widener,
// Haas Effect Decorrelation, DJ Resonance Filter Sweep, and Reverb Room Acoustics
// ==========================================================================

(function() {
  'use strict';

  // Procedural Reverb Impulse Response Generator
  function generateReverbImpulse(ctx, durationSec, decayExp) {
    const sampleRate = ctx.sampleRate || 44100;
    const length = Math.floor(sampleRate * Math.max(0.2, durationSec));
    const buffer = ctx.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      const envelope = Math.pow(1 - n, decayExp);
      // Independent decorrelated white noise for rich spatial diffusion
      const rndL = (Math.random() * 2 - 1) * envelope;
      const rndR = (Math.random() * 2 - 1) * envelope;
      left[i] = rndL;
      right[i] = rndR;
    }
    return buffer;
  }

  function formatAzimuthText(angleRad, orbitMode) {
    if (orbitMode === 'off') return 'FRONT • 0° (CENTER)';
    const deg = Math.round(((angleRad * 180) / Math.PI) % 360);
    if (deg === 0 || deg === 360) return 'FRONT • 0°';
    if (deg === 90) return 'RIGHT • +90°';
    if (deg === 180) return 'REAR • 180°';
    if (deg === 270) return 'LEFT • -90°';
    if (deg < 180) return `RIGHT • +${deg}°`;
    return `LEFT • -${360 - deg}°`;
  }

  class LiveDJStudio {
    constructor(audioCtx, options = {}) {
      this.ctx = audioCtx;
      this.options = options;
      this.initialized = false;

      // Audio Nodes
      this.inputNode = null;
      this.djFilterNode = null;
      this.bassPunchNode = null;
      
      // Stereo Expander Nodes
      this.splitterNode = null;
      this.midSumL = null;
      this.midSumR = null;
      this.midBus = null;
      this.sideDiffL = null;
      this.sideDiffR = null;
      this.sideHp = null;
      this.sideHaasDelay = null;
      this.sideBus = null;
      this.sideGainL = null;
      this.sideGainR = null;
      this.mergerNode = null;

      // 8D Spatial Audio Nodes
      this.pannerNode = null;
      this.occlusionFilter = null;

      // Reverb Nodes
      this.reverbConvolver = null;
      this.reverbDry = null;
      this.reverbWet = null;

      this.outputNode = null;

      // VU Meter Analysers
      this.vuSplitter = null;
      this.vuAnalyserL = null;
      this.vuAnalyserR = null;
      this.vuDataL = null;
      this.vuDataR = null;

      // State Parameters
      this.orbitMode = options.orbitMode || 'off'; // 'off' | 'slow' | 'club' | 'fast' | 'manual'
      this.orbitAngle = 0; // 0 = Front, PI/2 = Right, PI = Behind, 3PI/2 = Left
      this.orbitRadius = 2.4; // Virtual distance in meters
      this.stereoWidth = options.stereoWidth != null ? options.stereoWidth : 1.0; // 0.0 (mono) .. 1.0 .. 2.5 (wide)
      this.djFilter = options.djFilter || 0.0; // -1.0 (Low-Pass) .. 0.0 .. 1.0 (High-Pass)
      this.reverbPreset = options.reverbPreset || 'off'; // 'off' | 'studio' | 'club' | 'arena'
      this.reverbLevel = options.reverbLevel != null ? options.reverbLevel : 0.25;
      this.bassPunch = !!options.bassPunch;

      // Radar Canvas and Animation
      this.radarCanvas = null;
      this.radarCtx = null;
      this.isDraggingRadar = false;
      this.cometTrail = []; // [{x, y, time}]
      this.lastFrameTime = performance.now();
      this.rafId = 0;
      this.onAngleChange = null;

      // Reverb Buffers Cache
      this.reverbBuffers = new Map();

      // Bind Animation Loop
      this._animate = this._animate.bind(this);
    }

    init() {
      if (this.initialized || !this.ctx) return;
      try {
        const now = this.ctx.currentTime || 0;

        // 1. Master Input
        this.inputNode = this.ctx.createGain();
        this.inputNode.gain.setValueAtTime(1.0, now);

        // 2. DJ Resonance Filter Sweep
        this.djFilterNode = this.ctx.createBiquadFilter();
        this.djFilterNode.type = 'allpass';
        this.djFilterNode.frequency.setValueAtTime(1000, now);
        this.djFilterNode.Q.setValueAtTime(0.7, now);

        // 3. DJ Club Bass Punch (+4.8dB at 85Hz)
        this.bassPunchNode = this.ctx.createBiquadFilter();
        this.bassPunchNode.type = 'lowshelf';
        this.bassPunchNode.frequency.setValueAtTime(85, now);
        this.bassPunchNode.gain.setValueAtTime(this.bassPunch ? 4.8 : 0, now);

        // Connect Input -> DJ Filter -> Bass Punch
        this.inputNode.connect(this.djFilterNode);
        this.djFilterNode.connect(this.bassPunchNode);

        // 4. Stereo Expander (Mid-Side Decorrelator + Haas Micro-Delay)
        this.splitterNode = this.ctx.createChannelSplitter(2);
        this.bassPunchNode.connect(this.splitterNode);

        // Mid signal: (L + R) * 0.5
        this.midSumL = this.ctx.createGain();
        this.midSumL.gain.setValueAtTime(0.5, now);
        this.midSumR = this.ctx.createGain();
        this.midSumR.gain.setValueAtTime(0.5, now);
        this.midBus = this.ctx.createGain();

        this.splitterNode.connect(this.midSumL, 0);
        this.splitterNode.connect(this.midSumR, 1);
        this.midSumL.connect(this.midBus);
        this.midSumR.connect(this.midBus);

        // Side signal: (L - R) * 0.5
        this.sideDiffL = this.ctx.createGain();
        this.sideDiffL.gain.setValueAtTime(0.5, now);
        this.sideDiffR = this.ctx.createGain();
        this.sideDiffR.gain.setValueAtTime(-0.5, now);

        // High-pass on Side signal at 140Hz: keeps sub-bass 100% centered and punchy
        this.sideHp = this.ctx.createBiquadFilter();
        this.sideHp.type = 'highpass';
        this.sideHp.frequency.setValueAtTime(140, now);

        // Haas micro-delay for true mono source stereo synthesis (13ms)
        this.sideHaasDelay = this.ctx.createDelay(0.05);
        this.sideHaasDelay.delayTime.setValueAtTime(0.013, now);

        this.sideBus = this.ctx.createGain();
        this.sideBus.gain.setValueAtTime(this.stereoWidth, now);

        this.splitterNode.connect(this.sideDiffL, 0);
        this.splitterNode.connect(this.sideDiffR, 1);
        this.sideDiffL.connect(this.sideHp);
        this.sideDiffR.connect(this.sideHp);
        this.sideHp.connect(this.sideHaasDelay);
        this.sideHaasDelay.connect(this.sideBus);

        // Recombine Mid + Side into Left & Right
        this.sideGainL = this.ctx.createGain();
        this.sideGainL.gain.setValueAtTime(1.0, now);
        this.sideGainR = this.ctx.createGain();
        this.sideGainR.gain.setValueAtTime(-1.0, now); // Inverted on Right for stereo divergence

        this.sideBus.connect(this.sideGainL);
        this.sideBus.connect(this.sideGainR);

        this.mergerNode = this.ctx.createChannelMerger(2);
        this.midBus.connect(this.mergerNode, 0, 0); // Mid to Left
        this.midBus.connect(this.mergerNode, 0, 1); // Mid to Right
        this.sideGainL.connect(this.mergerNode, 0, 0); // +Side to Left
        this.sideGainR.connect(this.mergerNode, 0, 1); // -Side to Right

        // 5. 8D Binaural Spatial Panner (HRTF)
        this.pannerNode = this.ctx.createPanner();
        this.pannerNode.panningModel = 'HRTF';
        this.pannerNode.distanceModel = 'inverse';
        this.pannerNode.refDistance = 1;
        this.pannerNode.maxDistance = 1000;
        this.pannerNode.rolloffFactor = 0.6;
        this.pannerNode.coneInnerAngle = 360;

        // Listener positioning
        const listener = this.ctx.listener;
        if (listener) {
          if (listener.positionX) {
            listener.positionX.setValueAtTime(0, now);
            listener.positionY.setValueAtTime(0, now);
            listener.positionZ.setValueAtTime(0, now);
            listener.forwardX.setValueAtTime(0, now);
            listener.forwardY.setValueAtTime(0, now);
            listener.forwardZ.setValueAtTime(-1, now);
            listener.upX.setValueAtTime(0, now);
            listener.upY.setValueAtTime(1, now);
            listener.upZ.setValueAtTime(0, now);
          } else if (listener.setPosition && listener.setOrientation) {
            listener.setPosition(0, 0, 0);
            listener.setOrientation(0, 0, -1, 0, 1, 0);
          }
        }

        // Behind-Head Occlusion Filter (pinnae/head shadowing)
        this.occlusionFilter = this.ctx.createBiquadFilter();
        this.occlusionFilter.type = 'lowpass';
        this.occlusionFilter.frequency.setValueAtTime(22050, now);

        this.mergerNode.connect(this.pannerNode);
        this.pannerNode.connect(this.occlusionFilter);

        // 6. DJ Room Ambience (Acoustic Reverb)
        this.reverbConvolver = this.ctx.createConvolver();
        this.reverbDry = this.ctx.createGain();
        this.reverbDry.gain.setValueAtTime(1.0, now);
        this.reverbWet = this.ctx.createGain();
        this.reverbWet.gain.setValueAtTime(0.0, now);

        this.occlusionFilter.connect(this.reverbDry);
        this.occlusionFilter.connect(this.reverbConvolver);
        this.reverbConvolver.connect(this.reverbWet);

        // 7. Master Output
        this.outputNode = this.ctx.createGain();
        this.outputNode.gain.setValueAtTime(1.0, now);

        this.reverbDry.connect(this.outputNode);
        this.reverbWet.connect(this.outputNode);

        // 8. Live Stereo VU Meter Analysers
        this.vuSplitter = this.ctx.createChannelSplitter(2);
        this.vuAnalyserL = this.ctx.createAnalyser();
        this.vuAnalyserL.fftSize = 64;
        this.vuAnalyserR = this.ctx.createAnalyser();
        this.vuAnalyserR.fftSize = 64;

        this.outputNode.connect(this.vuSplitter);
        this.vuSplitter.connect(this.vuAnalyserL, 0);
        this.vuSplitter.connect(this.vuAnalyserR, 1);

        this.vuDataL = new Uint8Array(this.vuAnalyserL.frequencyBinCount);
        this.vuDataR = new Uint8Array(this.vuAnalyserR.frequencyBinCount);

        // Apply Initial Parameters
        this.applyStereoWidth(this.stereoWidth);
        this.applyDjFilter(this.djFilter);
        this.applyReverb(this.reverbPreset, this.reverbLevel);
        this.updatePannerPosition(this.orbitAngle);

        this.initialized = true;
        this.lastFrameTime = performance.now();
        this.rafId = requestAnimationFrame(this._animate);

        console.log('[LiveDJStudio] Web Audio 8D Spatial & Stereo Engine initialized');
      } catch (err) {
        console.error('[LiveDJStudio] Initialization failed:', err);
      }
    }

    // 8D Orbit Animation Frame
    _animate(time) {
      this.rafId = requestAnimationFrame(this._animate);
      const dt = Math.min(0.1, (time - this.lastFrameTime) / 1000);
      this.lastFrameTime = time;

      // Update 8D Orbit Angle
      if (this.orbitMode !== 'off' && this.orbitMode !== 'manual') {
        let speed = 0;
        if (this.orbitMode === 'slow') speed = (Math.PI * 2) / 16.0; // 16s cycle
        else if (this.orbitMode === 'club') speed = (Math.PI * 2) / 10.0; // 10s cycle
        else if (this.orbitMode === 'fast') speed = (Math.PI * 2) / 5.0; // 5s cycle

        this.orbitAngle = (this.orbitAngle + speed * dt) % (Math.PI * 2);
        this.updatePannerPosition(this.orbitAngle);

        if (typeof this.onAngleChange === 'function') {
          this.onAngleChange(this.orbitAngle, formatAzimuthText(this.orbitAngle, this.orbitMode));
        }
      } else if (this.orbitMode === 'off') {
        this.orbitAngle = 0;
        this.updatePannerPosition(0);
      }

      // Record Comet Tail Positions
      const curX = Math.sin(this.orbitAngle);
      const curY = -Math.cos(this.orbitAngle);
      this.cometTrail.push({ x: curX, y: curY, time });
      if (this.cometTrail.length > 24) this.cometTrail.shift();

      // Render Radar Canvas if attached
      if (this.radarCanvas) {
        this.renderRadar();
      }
    }

    // Update 3D Panner Coordinates
    updatePannerPosition(angle) {
      if (!this.pannerNode || !this.ctx) return;
      const now = this.ctx.currentTime || 0;

      // Web Audio Coordinates: Listener looks toward -Z
      // X = Right (+), Left (-)
      // Z = Behind (+), In Front (-)
      // Y = Up (+), Down (-)
      const x = this.orbitRadius * Math.sin(angle);
      const z = -this.orbitRadius * Math.cos(angle);
      const y = (this.orbitMode === 'off') ? 0 : 0.35 * Math.sin(angle * 2); // 3D elevation arch

      if (this.pannerNode.positionX) {
        this.pannerNode.positionX.setTargetAtTime(x, now, 0.03);
        this.pannerNode.positionY.setTargetAtTime(y, now, 0.03);
        this.pannerNode.positionZ.setTargetAtTime(z, now, 0.03);
      } else if (this.pannerNode.setPosition) {
        this.pannerNode.setPosition(x, y, z);
      }

      // Occlusion filter: roll off highs when sound is behind the head (Z > 0)
      if (this.occlusionFilter) {
        if (z > 0.2 && this.orbitMode !== 'off') {
          const factor = Math.min(1, z / this.orbitRadius);
          const cutoff = 22050 - factor * 14500; // Drops to ~7500 Hz behind head
          this.occlusionFilter.frequency.setTargetAtTime(cutoff, now, 0.04);
        } else {
          this.occlusionFilter.frequency.setTargetAtTime(22050, now, 0.04);
        }
      }
    }

    // Controls: 8D Orbit Mode
    set8DMode(mode) {
      this.orbitMode = mode;
      if (mode === 'off') {
        this.orbitAngle = 0;
        this.updatePannerPosition(0);
      }
      if (typeof this.onAngleChange === 'function') {
        this.onAngleChange(this.orbitAngle, formatAzimuthText(this.orbitAngle, this.orbitMode));
      }
    }

    // Controls: Manual Orbit Angle (Radians)
    setManualAngle(rad) {
      this.orbitMode = 'manual';
      this.orbitAngle = (rad + Math.PI * 2) % (Math.PI * 2);
      this.updatePannerPosition(this.orbitAngle);
      if (typeof this.onAngleChange === 'function') {
        this.onAngleChange(this.orbitAngle, formatAzimuthText(this.orbitAngle, this.orbitMode));
      }
    }

    // Controls: Stereo Expander Width (0.0 to 2.5)
    applyStereoWidth(width) {
      this.stereoWidth = Math.max(0, Math.min(2.5, width));
      if (!this.ctx || !this.sideBus) return;
      const now = this.ctx.currentTime || 0;

      // When width = 0: sideBus = 0 (Pure Mono)
      // When width = 1: sideBus = 1 (Natural Stereo)
      // When width > 1: sideBus > 1 (Expanded / Ultra-Wide)
      this.sideBus.gain.setTargetAtTime(this.stereoWidth, now, 0.03);
    }

    // Controls: DJ Resonance Filter Sweep (-1.0 to 1.0)
    applyDjFilter(val) {
      this.djFilter = Math.max(-1.0, Math.min(1.0, val));
      if (!this.ctx || !this.djFilterNode) return;
      const now = this.ctx.currentTime || 0;

      if (Math.abs(this.djFilter) < 0.03) {
        this.djFilterNode.type = 'allpass';
        this.djFilterNode.frequency.setTargetAtTime(1000, now, 0.03);
        this.djFilterNode.Q.setTargetAtTime(0.7, now, 0.03);
      } else if (this.djFilter < 0) {
        // Low-Pass Club Sweep (roll off highs)
        const progress = 1 + this.djFilter; // 0..1
        const freq = 250 + Math.pow(progress, 2.4) * 19500;
        const q = 1.2 + (-this.djFilter) * 3.2;
        this.djFilterNode.type = 'lowpass';
        this.djFilterNode.frequency.setTargetAtTime(freq, now, 0.03);
        this.djFilterNode.Q.setTargetAtTime(q, now, 0.03);
      } else {
        // High-Pass Buildup Sweep (roll off lows)
        const progress = this.djFilter; // 0..1
        const freq = 20 + Math.pow(progress, 2.0) * 5200;
        const q = 1.2 + this.djFilter * 3.2;
        this.djFilterNode.type = 'highpass';
        this.djFilterNode.frequency.setTargetAtTime(freq, now, 0.03);
        this.djFilterNode.Q.setTargetAtTime(q, now, 0.03);
      }
    }

    // Controls: DJ Bass Punch
    setBassPunch(enable) {
      this.bassPunch = !!enable;
      if (!this.ctx || !this.bassPunchNode) return;
      const now = this.ctx.currentTime || 0;
      this.bassPunchNode.gain.setTargetAtTime(this.bassPunch ? 4.8 : 0, now, 0.03);
    }

    // Controls: DJ Room Ambience (Reverb)
    applyReverb(preset, level) {
      this.reverbPreset = preset || 'off';
      if (level != null) this.reverbLevel = Math.max(0, Math.min(0.6, level));
      if (!this.ctx || !this.reverbWet || !this.reverbDry) return;
      const now = this.ctx.currentTime || 0;

      if (this.reverbPreset === 'off' || this.reverbLevel <= 0.01) {
        this.reverbDry.gain.setTargetAtTime(1.0, now, 0.03);
        this.reverbWet.gain.setTargetAtTime(0.0, now, 0.03);
        return;
      }

      // Check or generate impulse response buffer
      let buffer = this.reverbBuffers.get(this.reverbPreset);
      if (!buffer) {
        if (this.reverbPreset === 'studio') buffer = generateReverbImpulse(this.ctx, 0.75, 3.4);
        else if (this.reverbPreset === 'club') buffer = generateReverbImpulse(this.ctx, 1.8, 2.2);
        else if (this.reverbPreset === 'arena') buffer = generateReverbImpulse(this.ctx, 3.2, 1.6);
        if (buffer) this.reverbBuffers.set(this.reverbPreset, buffer);
      }

      if (buffer && this.reverbConvolver.buffer !== buffer) {
        this.reverbConvolver.buffer = buffer;
      }

      const wet = this.reverbLevel;
      const dry = Math.sqrt(Math.max(0, 1.0 - wet * 0.7));
      this.reverbDry.gain.setTargetAtTime(dry, now, 0.03);
      this.reverbWet.gain.setTargetAtTime(wet, now, 0.03);
    }

    // Real-Time VU Meter Reading
    getVuLevels() {
      if (!this.vuAnalyserL || !this.vuAnalyserR) return { l: 0, r: 0 };
      this.vuAnalyserL.getByteTimeDomainData(this.vuDataL);
      this.vuAnalyserR.getByteTimeDomainData(this.vuDataR);

      let sumL = 0, sumR = 0;
      for (let i = 0; i < this.vuDataL.length; i++) {
        const vL = (this.vuDataL[i] - 128) / 128;
        sumL += vL * vL;
        const vR = (this.vuDataR[i] - 128) / 128;
        sumR += vR * vR;
      }
      const rmsL = Math.sqrt(sumL / this.vuDataL.length);
      const rmsR = Math.sqrt(sumR / this.vuDataR.length);
      return {
        l: Math.min(1.0, rmsL * 3.4),
        r: Math.min(1.0, rmsR * 3.4)
      };
    }

    is8DActive() {
      return this.orbitMode !== 'off';
    }

    isDjActive() {
      return this.orbitMode !== 'off' ||
             Math.abs(this.stereoWidth - 1.0) > 0.08 ||
             Math.abs(this.djFilter) > 0.05 ||
             this.bassPunch ||
             this.reverbPreset !== 'off';
    }

    // Attach Interactive Radar Canvas
    attachRadarCanvas(canvas) {
      if (!canvas) return;
      this.radarCanvas = canvas;
      this.radarCtx = canvas.getContext('2d');
      this._bindRadarEvents();
    }

    detachRadarCanvas() {
      this.radarCanvas = null;
      this.radarCtx = null;
    }

    _bindRadarEvents() {
      if (!this.radarCanvas || this.radarCanvas._eventsBound) return;
      this.radarCanvas._eventsBound = true;

      const handlePointer = (e) => {
        const rect = this.radarCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const dx = clientX - rect.left - cx;
        const dy = clientY - rect.top - cy;

        // Angle in radians (0 = top, PI/2 = right, PI = bottom, 3PI/2 = left)
        const angle = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
        this.setManualAngle(angle);
      };

      this.radarCanvas.addEventListener('mousedown', (e) => {
        this.isDraggingRadar = true;
        handlePointer(e);
      });
      window.addEventListener('mousemove', (e) => {
        if (this.isDraggingRadar) handlePointer(e);
      });
      window.addEventListener('mouseup', () => {
        this.isDraggingRadar = false;
      });

      this.radarCanvas.addEventListener('touchstart', (e) => {
        this.isDraggingRadar = true;
        handlePointer(e);
      }, { passive: true });
      window.addEventListener('touchmove', (e) => {
        if (this.isDraggingRadar) handlePointer(e);
      }, { passive: true });
      window.addEventListener('touchend', () => {
        this.isDraggingRadar = false;
      });
    }

    // Render 360° Holographic DJ Radar
    renderRadar() {
      const c = this.radarCanvas;
      const ctx = this.radarCtx;
      if (!c || !ctx) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth || 220;
      const h = c.clientHeight || 220;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(cx, cy) - 14;

      // 1. Radar Background Glass Sphere
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR + 8);
      bgGrad.addColorStop(0, 'rgba(16, 22, 36, 0.95)');
      bgGrad.addColorStop(0.7, 'rgba(11, 15, 25, 0.98)');
      bgGrad.addColorStop(1, 'rgba(6, 9, 16, 1)');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR + 8, 0, Math.PI * 2);
      ctx.fill();

      // Outer Glow Rim
      ctx.strokeStyle = this.orbitMode !== 'off' ? 'rgba(139, 92, 246, 0.7)' : 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 2. Concentric Distance Rings (33%, 66%, 100%)
      const rings = [0.33, 0.66, 1.0];
      ctx.lineWidth = 1;
      rings.forEach((rRatio, idx) => {
        ctx.beginPath();
        ctx.strokeStyle = idx === 2 ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)';
        ctx.setLineDash(idx === 1 ? [4, 4] : []);
        ctx.arc(cx, cy, maxR * rRatio, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // 3. Radar Crosshairs
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - maxR);
      ctx.lineTo(cx, cy + maxR);
      ctx.moveTo(cx - maxR, cy);
      ctx.lineTo(cx + maxR, cy);
      ctx.stroke();

      // 4. Cardinal Labels (FRONT, RIGHT, REAR, LEFT)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('FRONT', cx, cy - maxR + 10);
      ctx.textBaseline = 'top';
      ctx.fillText('REAR', cx, cy + maxR - 10);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText('R', cx + maxR - 10, cy);
      ctx.textAlign = 'right';
      ctx.fillText('L', cx - maxR + 10, cy);

      // 5. Center Listener Head (🎧 with Forward Direction Arrow)
      const headR = 14;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.arc(cx, cy, headR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Headphones Icon in Center
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎧', cx, cy);

      // Forward Direction Triangle Indicator
      ctx.fillStyle = '#8b5cf6';
      ctx.beginPath();
      ctx.moveTo(cx, cy - headR - 6);
      ctx.lineTo(cx - 4, cy - headR - 1);
      ctx.lineTo(cx + 4, cy - headR - 1);
      ctx.closePath();
      ctx.fill();

      // 6. Comet Orbit Trail
      if (this.orbitMode !== 'off') {
        for (let i = 0; i < this.cometTrail.length; i++) {
          const pt = this.cometTrail[i];
          const trAlpha = (i / this.cometTrail.length) * 0.45;
          const trX = cx + pt.x * (maxR * 0.88);
          const trY = cy + pt.y * (maxR * 0.88);
          ctx.fillStyle = `rgba(139, 92, 246, ${trAlpha})`;
          ctx.beginPath();
          ctx.arc(trX, trY, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 7. Active Sound Source Orb
      const orbRadius = (this.orbitMode === 'off') ? (maxR * 0.35) : (maxR * 0.88);
      const orbX = cx + Math.sin(this.orbitAngle) * orbRadius;
      const orbY = cy - Math.cos(this.orbitAngle) * orbRadius;

      // Outer Energy Glow
      const orbGlow = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, 18);
      orbGlow.addColorStop(0, 'rgba(167, 139, 250, 0.9)');
      orbGlow.addColorStop(0.5, 'rgba(139, 92, 246, 0.45)');
      orbGlow.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = orbGlow;
      ctx.beginPath();
      ctx.arc(orbX, orbY, 18, 0, Math.PI * 2);
      ctx.fill();

      // Solid Satellite Core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(orbX, orbY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Sound Beam Line connecting listener head to sound orb
      ctx.strokeStyle = this.orbitMode !== 'off' ? 'rgba(167, 139, 250, 0.4)' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(orbX, orbY);
      ctx.stroke();
    }
  }

  // Export to window
  window.LiveDJStudio = LiveDJStudio;
})();
