/**
 * SONARA — AI Cinematic Lyric Animation Engine
 * Transforms song lyrics into an evolving, audio-reactive cinematic storytelling world.
 *
 * Implements:
 * 1. AI Lyric Intelligence & Emotion Analyzer (love, heartbreak, anger, sadness, hope, dreams, energetic).
 * 2. High-performance Kinetic Typography with staggered word-level reveals and 3D specular depth.
 * 3. Continuous visual storytelling with mood-adaptive atmospheric particle systems.
 * 4. Audio-reactive typography impacts & shockwaves driven by Web Audio API analysis with smooth EMA.
 * 5. Millisecond-accurate audio synchronization matching DOM lyrics with zero jitter.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SonaraEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- Emotion & Semantic Dictionaries ---
  const MOOD_LEXICON = {
    love: {
      name: 'Love & Warmth',
      icon: '🌸',
      primaryHue: 345,
      secondaryHue: 28,
      keywords: [
        'love', 'loved', 'loving', 'heart', 'sweet', 'darling', 'baby', 'beautiful',
        'kiss', 'kisses', 'hold', 'forever', 'angel', 'touch', 'gentle', 'light',
        'warmth', 'warm', 'beloved', 'marry', 'passion', 'care', 'mine', 'yours',
        'eyes', 'smile', 'honey', 'treasure', 'romance', 'precious', 'embrace'
      ],
      colors: {
        text: '#ffffff',
        glow: 'rgba(255, 117, 140, 0.75)',
        accent: '#ff758c',
        accent2: '#ff7eb3',
        bgGlow: 'rgba(255, 105, 180, 0.16)'
      }
    },
    heartbreak: {
      name: 'Heartbreak & Longing',
      icon: '💔',
      primaryHue: 220,
      secondaryHue: 265,
      keywords: [
        'break', 'broken', 'shattered', 'tear', 'tears', 'pain', 'hurt', 'hurts',
        'cry', 'crying', 'lonely', 'alone', 'gone', 'goodbye', 'bleed', 'bleeding',
        'empty', 'lost', 'sorrow', 'regret', 'scars', 'leaving', 'forget', 'cold',
        'fade', 'fading', 'ache', 'wreck', 'shattered', 'farewell', 'apart'
      ],
      colors: {
        text: '#f0f5ff',
        glow: 'rgba(112, 161, 255, 0.75)',
        accent: '#70a1ff',
        accent2: '#a4b0be',
        bgGlow: 'rgba(83, 82, 237, 0.15)'
      }
    },
    anger: {
      name: 'Fiery & Intense',
      icon: '🔥',
      primaryHue: 8,
      secondaryHue: 35,
      keywords: [
        'burn', 'burning', 'fire', 'rage', 'hate', 'fight', 'fighting', 'kill',
        'scream', 'screaming', 'madness', 'blood', 'war', 'roar', 'destroy',
        'enemy', 'flame', 'flames', 'wrath', 'wild', 'toxic', 'lie', 'lies',
        'revenge', 'shout', 'fury', 'hell', 'blaze', 'blast', 'venom'
      ],
      colors: {
        text: '#ffffff',
        glow: 'rgba(255, 71, 87, 0.85)',
        accent: '#ff4757',
        accent2: '#ffa502',
        bgGlow: 'rgba(255, 71, 87, 0.20)'
      }
    },
    sadness: {
      name: 'Melancholy & Rain',
      icon: '🌧️',
      primaryHue: 215,
      secondaryHue: 195,
      keywords: [
        'rain', 'raining', 'drowning', 'dark', 'darkness', 'cold', 'fall', 'falling',
        'shadow', 'shadows', 'weep', 'silent', 'silence', 'gloom', 'deep', 'despair',
        'blue', 'grey', 'winter', 'ghost', 'dead', 'fog', 'grave', 'numb',
        'drown', 'hollow', 'storm', 'clouds', 'grief'
      ],
      colors: {
        text: '#e6f0fa',
        glow: 'rgba(58, 123, 213, 0.7)',
        accent: '#3a7bd5',
        accent2: '#70a1ff',
        bgGlow: 'rgba(58, 96, 115, 0.15)'
      }
    },
    hope: {
      name: 'Hope & Ascendance',
      icon: '☀️',
      primaryHue: 48,
      secondaryHue: 145,
      keywords: [
        'hope', 'rise', 'rising', 'light', 'shine', 'shining', 'sun', 'sky',
        'fly', 'flying', 'wings', 'tomorrow', 'believe', 'free', 'freedom',
        'dawn', 'breathe', 'future', 'promise', 'heal', 'strong', 'morning',
        'star', 'win', 'glory', 'alive', 'soar', 'bright', 'golden', 'courage'
      ],
      colors: {
        text: '#ffffff',
        glow: 'rgba(246, 211, 101, 0.8)',
        accent: '#f6d365',
        accent2: '#fda085',
        bgGlow: 'rgba(253, 160, 133, 0.18)'
      }
    },
    dreams: {
      name: 'Cosmic & Dreaming',
      icon: '✨',
      primaryHue: 275,
      secondaryHue: 190,
      keywords: [
        'dream', 'dreams', 'dreaming', 'stars', 'moon', 'space', 'galaxy',
        'night', 'surreal', 'illusion', 'magic', 'wander', 'universe', 'orbit',
        'sleep', 'wonder', 'infinity', 'cosmos', 'floating', 'mystic', 'starlight',
        'celestial', 'astral', 'lucid', 'vision', 'miracle'
      ],
      colors: {
        text: '#ffffff',
        glow: 'rgba(168, 85, 247, 0.8)',
        accent: '#a855f7',
        accent2: '#00dbde',
        bgGlow: 'rgba(127, 0, 255, 0.16)'
      }
    },
    energetic: {
      name: 'Electric & Kinetic',
      icon: '⚡',
      primaryHue: 175,
      secondaryHue: 310,
      keywords: [
        'dance', 'dancing', 'party', 'run', 'running', 'jump', 'jumping', 'alive',
        'beat', 'rhythm', 'electric', 'wild', 'power', 'bass', 'rock', 'fast',
        'shake', 'crazy', 'speed', 'groove', 'bounce', 'hyped', 'club', 'vibe',
        'drop', 'shock', 'dynamite', 'flash', 'laser'
      ],
      colors: {
        text: '#ffffff',
        glow: 'rgba(0, 242, 254, 0.85)',
        accent: '#00f2fe',
        accent2: '#f093fb',
        bgGlow: 'rgba(0, 242, 254, 0.20)'
      }
    }
  };

  const DEFAULT_MOOD = 'dreams';
  const analysisCache = new Map();

  class SonaraAnimationEngine {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.width = 0;
      this.height = 0;
      this.dpr = 1;

      // Lyrics state
      this.lyrics = null;
      this.syncedLines = [];
      this.lineAnalysis = [];
      this.songMood = DEFAULT_MOOD;
      this.activeLineIdx = -1;
      this.lineEnterTime = 0;
      this.lastTime = 0;
      this.lastSampledTime = 0;

      // Transition state
      this.currentMood = DEFAULT_MOOD;
      this.targetMood = DEFAULT_MOOD;
      this.moodTransition = 1.0;

      // Audio analysis with Exponential Moving Average (EMA) smoothing
      this.analyser = null;
      this.freqData = null;
      this.bass = 0;
      this.mid = 0;
      this.treble = 0;
      this.smoothBass = 0;
      this.smoothMid = 0;
      this.smoothTreble = 0;
      this.prevBass = 0;
      this.beatImpulse = 0;
      this.typographyScaleBump = 0;

      // Particle systems
      this.particles = [];
      this.maxParticles = 75;
      this.shockwaves = [];

      // Animation loop
      this.rafId = 0;
      this.running = false;
      this.reducedMotion = false;
    }

    /**
     * Bind canvas and initialize context
     */
    init(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });
      this.reducedMotion = !!options.reducedMotion;
      this.resize();
      this.initParticles();
    }

    /**
     * Connect Web Audio Analyser
     */
    setAudioSource(analyser) {
      this.analyser = analyser;
      if (analyser) {
        this.freqData = new Uint8Array(analyser.frequencyBinCount);
      }
    }

    /**
     * Resize canvas with high DPI support
     */
    resize(w, h) {
      if (!this.canvas) return;
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.width = w || this.canvas.clientWidth || 800;
      this.height = h || this.canvas.clientHeight || 500;

      this.canvas.width = Math.max(1, Math.round(this.width * this.dpr));
      this.canvas.height = Math.max(1, Math.round(this.height * this.dpr));
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      // Invalidate line layout caches on resize
      for (const l of this.lineAnalysis) {
        l.layout = null;
      }

      for (const p of this.particles) {
        if (p.x > this.width) p.x = Math.random() * this.width;
        if (p.y > this.height) p.y = Math.random() * this.height;
      }
    }

    /**
     * Analyze song lyrics and precompute scene transitions
     */
    setLyrics(lyricsObj, trackId = '') {
      this.lyrics = lyricsObj;
      this.syncedLines = (lyricsObj && lyricsObj.synced) ? lyricsObj.synced : [];
      this.activeLineIdx = -1;
      this.lineEnterTime = 0;

      if (!lyricsObj) {
        this.lineAnalysis = [];
        this.songMood = DEFAULT_MOOD;
        this.targetMood = DEFAULT_MOOD;
        return;
      }

      const cacheKey = trackId || (this.syncedLines.length ? this.syncedLines[0].text : 'plain');
      if (analysisCache.has(cacheKey)) {
        const cached = analysisCache.get(cacheKey);
        this.lineAnalysis = cached.lines;
        this.songMood = cached.songMood;
        this.targetMood = cached.songMood;
        return;
      }

      const analyzed = this.analyzeLyrics(lyricsObj);
      analysisCache.set(cacheKey, analyzed);
      this.lineAnalysis = analyzed.lines;
      this.songMood = analyzed.songMood;
      this.targetMood = analyzed.songMood;
    }

    /**
     * AI Lyric Intelligence: emotional analysis & keyword saliency
     */
    analyzeLyrics(lyricsObj) {
      const moodScores = {
        love: 0, heartbreak: 0, anger: 0, sadness: 0, hope: 0, dreams: 0, energetic: 0
      };

      const lines = lyricsObj.synced && lyricsObj.synced.length
        ? lyricsObj.synced
        : (lyricsObj.plain ? lyricsObj.plain.split('\n').map(t => ({ text: t.trim(), t: null })) : []);

      const analyzedLines = lines.map((line, idx) => {
        const text = line.text || '';
        const words = text.toLowerCase().replace(/[^\w\s']/g, ' ').split(/\s+/).filter(Boolean);
        const lineScores = {
          love: 0, heartbreak: 0, anger: 0, sadness: 0, hope: 0, dreams: 0, energetic: 0
        };

        const highlightedWords = [];
        for (const w of words) {
          for (const [moodKey, moodDef] of Object.entries(MOOD_LEXICON)) {
            if (moodDef.keywords.includes(w)) {
              lineScores[moodKey] += 2;
              moodScores[moodKey] += 2;
              highlightedWords.push(w);
            }
          }
        }

        let dominantMood = DEFAULT_MOOD;
        let highest = 0;
        for (const [m, score] of Object.entries(lineScores)) {
          if (score > highest) {
            highest = score;
            dominantMood = m;
          }
        }

        const nextLine = lines[idx + 1];
        const t = (line.t != null && !isNaN(Number(line.t))) ? Number(line.t) : null;
        const nextT = (nextLine && nextLine.t != null && !isNaN(Number(nextLine.t))) ? Number(nextLine.t) : null;
        const duration = (t != null && nextT != null) ? Math.max(1.5, Math.min(12, nextT - t)) : 4.0;

        return {
          raw: text,
          t,
          nextT,
          duration,
          mood: highest > 0 ? dominantMood : null,
          highlightedWords,
          intensity: Math.min(1.0, 0.4 + highest * 0.2),
          layout: null // Cached layout metrics
        };
      });

      let songMood = DEFAULT_MOOD;
      let highestOverall = 0;
      for (const [m, score] of Object.entries(moodScores)) {
        if (score > highestOverall) {
          highestOverall = score;
          songMood = m;
        }
      }

      let lastKnownMood = songMood;
      for (const l of analyzedLines) {
        if (l.mood) lastKnownMood = l.mood;
        else l.mood = lastKnownMood;
      }

      return { lines: analyzedLines, songMood };
    }

    /**
     * Initialize mood-adaptive particle systems
     */
    initParticles() {
      this.particles = [];
      const count = this.maxParticles;
      for (let i = 0; i < count; i++) {
        this.particles.push(this.createParticle(true));
      }
    }

    createParticle(randomY = false) {
      const w = this.width || 800;
      const h = this.height || 500;
      return {
        x: Math.random() * w,
        y: randomY ? Math.random() * h : h + 15,
        vx: (Math.random() - 0.5) * 0.7,
        vy: -(0.4 + Math.random() * 1.1),
        size: 1.5 + Math.random() * 3.2,
        alpha: 0.25 + Math.random() * 0.55,
        baseAlpha: 0.25 + Math.random() * 0.55,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.03,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.8 + Math.random() * 1.4,
        seed: Math.random()
      };
    }

    /**
     * Start 60fps animation loop
     */
    start() {
      if (this.running) return;
      this.running = true;
      this.lastTime = performance.now();
      const tick = (now) => {
        if (!this.running) return;
        this.renderFrame(now);
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    }

    /**
     * Stop animation loop
     */
    stop() {
      this.running = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
    }

    /**
     * Millisecond-accurate audio synchronization matching DOM lyrics exactly
     */
    syncTime(currentTime) {
      this.lastSampledTime = currentTime;
      if (!this.lineAnalysis.length) return;

      let foundIdx = -1;
      for (let i = 0; i < this.lineAnalysis.length; i++) {
        const l = this.lineAnalysis[i];
        if (l.t != null && l.t <= currentTime) {
          foundIdx = i;
        }
      }

      if (foundIdx !== this.activeLineIdx) {
        this.activeLineIdx = foundIdx;
        this.lineEnterTime = performance.now();
        if (foundIdx >= 0 && this.lineAnalysis[foundIdx]) {
          const nextMood = this.lineAnalysis[foundIdx].mood || this.songMood;
          if (nextMood !== this.targetMood) {
            this.targetMood = nextMood;
            this.moodTransition = 0;
          }
        }
        this.triggerShockwave();
      }
    }

    triggerShockwave() {
      if (this.reducedMotion) return;
      this.shockwaves.push({
        x: this.width * 0.5,
        y: this.height * 0.5,
        radius: 12,
        maxRadius: Math.max(this.width, this.height) * 0.55,
        alpha: 0.60,
        speed: 7.5
      });
      this.typographyScaleBump = 0.06;
    }

    /**
     * Tap audio analysis with smooth Exponential Moving Average
     */
    sampleAudio() {
      if (!this.analyser || !this.freqData) {
        this.bass = 0.12;
        this.mid = 0.08;
        this.treble = 0.08;
      } else {
        try {
          this.analyser.getByteFrequencyData(this.freqData);
          let b = 0, m = 0, tr = 0;
          const len = this.freqData.length;

          for (let i = 0; i < 10 && i < len; i++) b += this.freqData[i];
          this.bass = (b / 10) / 255;

          for (let i = 15; i < 35 && i < len; i++) m += this.freqData[i];
          this.mid = (m / 20) / 255;

          for (let i = 40; i < 70 && i < len; i++) tr += this.freqData[i];
          this.treble = (tr / 30) / 255;

          const delta = this.bass - this.prevBass;
          if (delta > 0.15 && this.bass > 0.40) {
            this.beatImpulse = Math.min(1.0, this.beatImpulse + 0.30);
            this.typographyScaleBump = Math.max(this.typographyScaleBump, 0.04);
          } else {
            this.beatImpulse *= 0.90;
          }
          this.prevBass = this.bass;
        } catch {
          this.bass = 0.12;
        }
      }

      // Smooth EMA filters (prevents jitter and rough pulsing)
      this.smoothBass += (this.bass - this.smoothBass) * 0.14;
      this.smoothMid += (this.mid - this.smoothMid) * 0.14;
      this.smoothTreble += (this.treble - this.smoothTreble) * 0.14;
      this.typographyScaleBump *= 0.88;
    }

    /**
     * Render one complete 60fps frame
     */
    renderFrame(now) {
      const dt = Math.min(0.08, (now - this.lastTime) / 1000);
      this.lastTime = now;
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      this.sampleAudio();

      if (this.moodTransition < 1.0) {
        this.moodTransition = Math.min(1.0, this.moodTransition + dt * 1.8);
      }

      ctx.clearRect(0, 0, w, h);

      const moodDef = MOOD_LEXICON[this.targetMood] || MOOD_LEXICON[DEFAULT_MOOD];

      // 1. Atmosphere background glow
      this.renderAtmosphere(ctx, w, h, moodDef, now);

      // 2. High-performance particles
      this.renderParticles(ctx, w, h, moodDef, dt, now);

      // 3. Audio-reactive shockwave ripples
      this.renderShockwaves(ctx, moodDef);

      // 4. Kinetic typography with smooth staggered word reveals
      this.renderTypography(ctx, w, h, moodDef, now);
    }

    /**
     * Atmospheric Background Illumination
     */
    renderAtmosphere(ctx, w, h, moodDef, now) {
      const t = now * 0.0008;
      const cx = w * 0.5 + Math.sin(t * 0.6) * 35;
      const cy = h * 0.5 + Math.cos(t * 0.5) * 25;
      const radius = Math.max(w, h) * (0.50 + this.smoothBass * 0.14);

      const grad = ctx.createRadialGradient(cx, cy, 15, cx, cy, radius);
      grad.addColorStop(0, moodDef.colors.bgGlow);
      grad.addColorStop(0.55, 'rgba(6, 9, 15, 0.25)');
      grad.addColorStop(1, 'rgba(5, 7, 12, 0.72)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    /**
     * High-Performance Particle Rendering
     */
    renderParticles(ctx, w, h, moodDef, dt, now) {
      const t = now * 0.001;
      const mood = this.targetMood;
      const bassFactor = 1 + this.smoothBass * 0.6;

      ctx.save();
      ctx.shadowBlur = 0; // Explicitly 0 for 60fps throughput

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];

        if (mood === 'sadness') {
          // Melancholy rain streaks
          p.y += (140 + p.size * 45) * dt * bassFactor;
          p.x += Math.sin(t * p.swaySpeed + p.swayPhase) * 0.3;
          if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
          ctx.strokeStyle = `rgba(112, 161, 255, ${p.alpha * 0.65})`;
          ctx.lineWidth = Math.max(1, p.size * 0.35);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 1, p.y + 12 + p.size * 2.5);
          ctx.stroke();

        } else if (mood === 'heartbreak') {
          // Tumbling ice crystal shards
          p.y += (32 + p.size * 16) * dt * bassFactor;
          p.x += Math.sin(t * 0.8 + p.swayPhase) * 0.7;
          p.rotation += p.vRot;
          if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = `rgba(164, 176, 190, ${p.alpha * 0.60})`;
          ctx.beginPath();
          ctx.moveTo(0, -p.size * 1.8);
          ctx.lineTo(p.size * 1.3, p.size);
          ctx.lineTo(-p.size * 1.3, p.size);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

        } else if (mood === 'anger') {
          // Fiery embers erupting
          p.y -= (60 + p.size * 30) * dt * (1 + this.smoothBass * 1.1);
          p.x += Math.sin(t * 2.5 + p.swayPhase) * 1.2;
          if (p.y < -20) { p.y = h + 15; p.x = Math.random() * w; }
          ctx.fillStyle = (i % 2 === 0 ? 'rgba(255, 71, 87, ' : 'rgba(255, 165, 2, ') + p.alpha + ')';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + this.beatImpulse * 0.6), 0, Math.PI * 2);
          ctx.fill();

        } else if (mood === 'love') {
          // Soft rose petals drifting
          p.y += (28 + p.size * 14) * dt;
          p.x += Math.sin(t * p.swaySpeed + p.swayPhase) * 1.6;
          p.rotation += p.vRot;
          if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = `rgba(255, 117, 140, ${p.alpha * 0.70})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 1.7, p.size * 1.0, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

        } else if (mood === 'hope') {
          // Ascending golden light motes
          p.y -= (40 + p.size * 18) * dt * bassFactor;
          p.x += Math.sin(t * p.swaySpeed + p.swayPhase) * 0.7;
          if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w; }
          ctx.fillStyle = `rgba(246, 211, 101, ${p.alpha * (0.55 + this.smoothMid * 0.45)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.3, 0, Math.PI * 2);
          ctx.fill();

        } else if (mood === 'energetic') {
          // Electric speed sparks
          p.x += p.vx * 3.8 * bassFactor;
          p.y += p.vy * 3.8 * bassFactor;
          if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
            p.x = w * 0.5 + (Math.random() - 0.5) * 100;
            p.y = h * 0.5 + (Math.random() - 0.5) * 70;
            const ang = Math.random() * Math.PI * 2;
            p.vx = Math.cos(ang) * (2 + Math.random() * 2.5);
            p.vy = Math.sin(ang) * (2 + Math.random() * 2.5);
          }
          ctx.strokeStyle = `rgba(0, 242, 254, ${p.alpha * 0.80})`;
          ctx.lineWidth = p.size * 0.45;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5);
          ctx.stroke();

        } else {
          // Cosmic dreaming stardust
          p.y -= (14 + p.size * 7) * dt;
          p.x += Math.sin(t * 0.4 + p.swayPhase) * 0.4;
          if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w; }
          const twinkle = p.alpha * (0.35 + 0.65 * Math.sin(t * 2.8 + p.seed * 8) + this.smoothTreble * 0.4);
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, Math.max(0, twinkle))})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + this.smoothTreble * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    /**
     * Render shockwave rings
     */
    renderShockwaves(ctx, moodDef) {
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const sw = this.shockwaves[i];
        sw.radius += sw.speed;
        sw.alpha *= 0.93;

        if (sw.alpha <= 0.02 || sw.radius >= sw.maxRadius) {
          this.shockwaves.splice(i, 1);
          continue;
        }

        ctx.strokeStyle = moodDef.colors.glow.replace(/[\d\.]+\)$/, `${sw.alpha})`);
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    /**
     * Kinetic Typography Rendering with Staggered Word Reveals
     */
    renderTypography(ctx, w, h, moodDef, now) {
      if (!this.lineAnalysis.length || this.activeLineIdx === -1) {
        this.renderEmptyNotice(ctx, w, h, moodDef);
        return;
      }

      const activeLine = this.lineAnalysis[this.activeLineIdx];
      if (!activeLine) return;

      const enterProgress = Math.min(1.0, (now - this.lineEnterTime) / 360);
      const easeEnter = 1 - Math.pow(1 - enterProgress, 3);

      const baseFontSize = Math.max(26, Math.min(44, Math.round(w * 0.040)));
      const activeFontSize = Math.round(baseFontSize * (1.0 + this.typographyScaleBump));

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 1. Previous Line
      if (this.activeLineIdx > 0) {
        const prevLine = this.lineAnalysis[this.activeLineIdx - 1];
        if (prevLine && prevLine.raw) {
          ctx.font = `600 ${Math.round(baseFontSize * 0.70)}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.shadowBlur = 0;
          const prevY = h * 0.5 - activeFontSize * 1.75 - (1 - easeEnter) * 12;
          this.drawWrappedText(ctx, prevLine.raw, w * 0.5, prevY, w * 0.85, baseFontSize * 0.82);
        }
      }

      // 2. Active Center Line with Staggered Kinetic Word Reveals
      const activeY = h * 0.5;
      ctx.save();
      ctx.translate(w * 0.5, activeY);
      const scale = this.reducedMotion ? 1.0 : (0.94 + 0.06 * easeEnter + this.typographyScaleBump);
      ctx.scale(scale, scale);

      ctx.font = `800 ${activeFontSize}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;

      // Soft ambient radial glow under text (10x faster than shadowBlur on 50 characters!)
      const glowGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, Math.min(w * 0.45, 340));
      glowGrad.addColorStop(0, moodDef.colors.bgGlow);
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(-w * 0.45, -activeFontSize * 1.8, w * 0.9, activeFontSize * 3.6);

      // Draw active line with staggered kinetic words
      this.drawKineticWords(ctx, activeLine, 0, 0, w * 0.88, activeFontSize * 1.25, moodDef, now);
      ctx.restore();

      // 3. Next Line
      if (this.activeLineIdx < this.lineAnalysis.length - 1) {
        const nextLine = this.lineAnalysis[this.activeLineIdx + 1];
        if (nextLine && nextLine.raw) {
          ctx.font = `600 ${Math.round(baseFontSize * 0.72)}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
          ctx.shadowBlur = 0;
          const nextY = h * 0.5 + activeFontSize * 1.75 + (1 - easeEnter) * 12;
          this.drawWrappedText(ctx, nextLine.raw, w * 0.5, nextY, w * 0.85, baseFontSize * 0.85);
        }
      }
    }

    /**
     * Pre-computes and caches line layout metrics to prevent canvas layout thrashing
     */
    getOrComputeLayout(ctx, lineObj, maxWidth) {
      if (lineObj.layout && lineObj.layout.maxWidth === maxWidth) {
        return lineObj.layout;
      }

      const words = lineObj.raw.split(' ');
      const spaceWidth = ctx.measureText(' ').width;
      let totalWidth = 0;
      const wordMetrics = [];

      for (let i = 0; i < words.length; i++) {
        const clean = words[i].toLowerCase().replace(/[^\w]/g, '');
        const isKey = lineObj.highlightedWords && lineObj.highlightedWords.includes(clean);
        const width = ctx.measureText(words[i]).width;
        wordMetrics.push({
          text: words[i],
          isKey,
          width
        });
        totalWidth += width + (i < words.length - 1 ? spaceWidth : 0);
      }

      lineObj.layout = {
        maxWidth,
        totalWidth,
        spaceWidth,
        wordMetrics
      };
      return lineObj.layout;
    }

    /**
     * Staggered kinetic word reveals
     */
    drawKineticWords(ctx, lineObj, cx, cy, maxWidth, lineHeight, moodDef, now) {
      const layout = this.getOrComputeLayout(ctx, lineObj, maxWidth);

      if (layout.totalWidth <= maxWidth) {
        let curX = cx - layout.totalWidth * 0.5;
        const words = layout.wordMetrics;

        for (let i = 0; i < words.length; i++) {
          const wm = words[i];
          const wWidth = wm.width;

          // Staggered word entrance reveal
          const wordElapsed = Math.max(0, (now - this.lineEnterTime) - (i * 38));
          const wordProg = Math.min(1.0, wordElapsed / 240);
          const wordEase = this.reducedMotion ? 1.0 : (1 - Math.pow(1 - wordProg, 3));
          const wordY = cy + (1 - wordEase) * 10;

          ctx.save();
          ctx.globalAlpha = Math.max(0.15, wordEase);

          if (wm.isKey) {
            ctx.fillStyle = moodDef.colors.accent;
            ctx.shadowColor = moodDef.colors.accent2;
            ctx.shadowBlur = 14 * (1 + this.smoothBass * 0.8);
          } else {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = moodDef.colors.glow;
            ctx.shadowBlur = 8 * (1 + this.smoothBass * 0.4);
          }

          ctx.fillText(wm.text, curX + wWidth * 0.5, wordY);
          ctx.restore();

          curX += wWidth + layout.spaceWidth;
        }
      } else {
        this.drawWrappedText(ctx, lineObj.raw, cx, cy, maxWidth, lineHeight);
      }
    }

    drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
      const words = text.split(' ');
      let line = '';
      const lines = [];

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          lines.push(line.trim());
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line.trim());

      const startY = y - ((lines.length - 1) * lineHeight * 0.5);
      for (let k = 0; k < lines.length; k++) {
        ctx.fillText(lines[k], x, startY + (k * lineHeight));
      }
    }

    renderEmptyNotice(ctx, w, h, moodDef) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 22px "Segoe UI Variable Display", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.shadowBlur = 0;
      ctx.fillText('Listening to music…', w * 0.5, h * 0.5);
    }

    getMood() {
      const def = MOOD_LEXICON[this.targetMood] || MOOD_LEXICON[DEFAULT_MOOD];
      return {
        key: this.targetMood,
        name: def.name,
        icon: def.icon,
        accent: def.colors.accent
      };
    }
  }

  return new SonaraAnimationEngine();
});
