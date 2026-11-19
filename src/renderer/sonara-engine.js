/**
 * SONARA — AI Cinematic Lyric Animation Engine
 * Transforms song lyrics into an evolving, audio-reactive cinematic storytelling world.
 *
 * Implements:
 * 1. AI Lyric Intelligence & Emotion Analyzer (love, heartbreak, anger, sadness, hope, dreams, energetic).
 * 2. Cinematic Kinetic Typography with 3D depth, entrance reveals, and word-level emphasis.
 * 3. Continuous visual storytelling with mood-adaptive atmospheric particle systems.
 * 4. Audio-reactive typography impacts & shockwaves driven by Web Audio API analysis.
 * 5. Accurate synchronization with seeking support and deterministic fallbacks.
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
        bgGlow: 'rgba(255, 105, 180, 0.15)'
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
        bgGlow: 'rgba(83, 82, 237, 0.14)'
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
        bgGlow: 'rgba(255, 71, 87, 0.18)'
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
        bgGlow: 'rgba(58, 96, 115, 0.14)'
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
        bgGlow: 'rgba(253, 160, 133, 0.16)'
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
        bgGlow: 'rgba(127, 0, 255, 0.15)'
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
        bgGlow: 'rgba(0, 242, 254, 0.18)'
      }
    }
  };

  const DEFAULT_MOOD = 'dreams';

  // --- Intelligence Analysis Cache ---
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

      // Transition state
      this.currentMood = DEFAULT_MOOD;
      this.targetMood = DEFAULT_MOOD;
      this.moodTransition = 1.0; // 0 to 1

      // Audio analysis
      this.analyser = null;
      this.freqData = null;
      this.bass = 0;
      this.mid = 0;
      this.treble = 0;
      this.prevBass = 0;
      this.beatImpulse = 0;
      this.typographyScaleBump = 0;

      // Particle systems
      this.particles = [];
      this.maxParticles = 85;
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
      this.ctx = canvas.getContext('2d');
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

      // Re-scatter particles inside new bounds
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

      // Check in-memory cache
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
        : (lyricsObj.plain ? lyricsObj.plain.split('\n').map(t => ({ text: t.trim() })) : []);

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

        // Determine dominant mood for this line
        let dominantMood = DEFAULT_MOOD;
        let highest = 0;
        for (const [m, score] of Object.entries(lineScores)) {
          if (score > highest) {
            highest = score;
            dominantMood = m;
          }
        }

        // Calculate line duration if synced
        const nextLine = lines[idx + 1];
        const t = line.t != null ? Number(line.t) : 0;
        const nextT = (nextLine && nextLine.t != null) ? Number(nextLine.t) : t + 4.5;
        const duration = Math.max(1.5, Math.min(12, nextT - t));

        return {
          raw: text,
          t,
          nextT,
          duration,
          mood: highest > 0 ? dominantMood : null,
          highlightedWords,
          intensity: Math.min(1.0, 0.4 + highest * 0.2)
        };
      });

      // Overall song dominant mood
      let songMood = DEFAULT_MOOD;
      let highestOverall = 0;
      for (const [m, score] of Object.entries(moodScores)) {
        if (score > highestOverall) {
          highestOverall = score;
          songMood = m;
        }
      }

      // Propagate smooth mood continuity for lines with zero score
      let lastKnownMood = songMood;
      for (const l of analyzedLines) {
        if (l.mood) {
          lastKnownMood = l.mood;
        } else {
          l.mood = lastKnownMood;
        }
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
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(0.5 + Math.random() * 1.2),
        size: 1.5 + Math.random() * 3.5,
        alpha: 0.2 + Math.random() * 0.6,
        baseAlpha: 0.2 + Math.random() * 0.6,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.04,
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.8 + Math.random() * 1.5,
        seed: Math.random()
      };
    }

    /**
     * Start animation loop
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
     * Update audio synchronization
     */
    syncTime(currentTime) {
      if (!this.lineAnalysis.length) return;

      let foundIdx = -1;
      for (let i = 0; i < this.lineAnalysis.length; i++) {
        const l = this.lineAnalysis[i];
        if (currentTime >= l.t - 0.15 && currentTime < l.nextT) {
          foundIdx = i;
          break;
        }
      }

      if (foundIdx === -1 && currentTime >= this.lineAnalysis[this.lineAnalysis.length - 1].t) {
        foundIdx = this.lineAnalysis.length - 1;
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
        // Emit shockwave on lyric entrance
        this.triggerShockwave();
      }
    }

    triggerShockwave() {
      if (this.reducedMotion) return;
      this.shockwaves.push({
        x: this.width * 0.5,
        y: this.height * 0.5,
        radius: 10,
        maxRadius: Math.max(this.width, this.height) * 0.6,
        alpha: 0.65,
        speed: 8.5
      });
      this.typographyScaleBump = 0.08;
    }

    /**
     * Tap audio analysis
     */
    sampleAudio() {
      if (!this.analyser || !this.freqData) {
        this.bass = 0.15;
        this.mid = 0.1;
        this.treble = 0.1;
        return;
      }

      try {
        this.analyser.getByteFrequencyData(this.freqData);
        let b = 0, m = 0, tr = 0;
        const len = this.freqData.length;

        // Bass bins (0 - 10)
        for (let i = 0; i < 10 && i < len; i++) b += this.freqData[i];
        this.bass = (b / 10) / 255;

        // Mid bins (15 - 35)
        for (let i = 15; i < 35 && i < len; i++) m += this.freqData[i];
        this.mid = (m / 20) / 255;

        // Treble bins (40 - 70)
        for (let i = 40; i < 70 && i < len; i++) tr += this.freqData[i];
        this.treble = (tr / 30) / 255;

        // Beat detection
        const delta = this.bass - this.prevBass;
        if (delta > 0.16 && this.bass > 0.42) {
          this.beatImpulse = Math.min(1.0, this.beatImpulse + 0.35);
          this.typographyScaleBump = Math.max(this.typographyScaleBump, 0.05);
        } else {
          this.beatImpulse *= 0.88;
        }
        this.prevBass = this.bass;
      } catch {
        this.bass = 0.15;
      }
    }

    /**
     * Render one complete frame
     */
    renderFrame(now) {
      const dt = Math.min(0.1, (now - this.lastTime) / 1000);
      this.lastTime = now;
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      this.sampleAudio();

      // Smooth mood transition
      if (this.moodTransition < 1.0) {
        this.moodTransition = Math.min(1.0, this.moodTransition + dt * 1.5);
      }
      this.typographyScaleBump *= 0.92;

      ctx.clearRect(0, 0, w, h);

      const moodDef = MOOD_LEXICON[this.targetMood] || MOOD_LEXICON[DEFAULT_MOOD];

      // 1. Atmospheric Ambient Lighting & Vignette
      this.renderAtmosphere(ctx, w, h, moodDef, now);

      // 2. Mood Particles
      this.renderParticles(ctx, w, h, moodDef, dt, now);

      // 3. Shockwave rings
      this.renderShockwaves(ctx, moodDef);

      // 4. Kinetic Typography
      this.renderTypography(ctx, w, h, moodDef, now);
    }

    /**
     * Atmospheric Background Illumination
     */
    renderAtmosphere(ctx, w, h, moodDef, now) {
      const t = now * 0.001;
      const cx = w * 0.5 + Math.sin(t * 0.5) * 40;
      const cy = h * 0.5 + Math.cos(t * 0.4) * 30;
      const radius = Math.max(w, h) * (0.55 + this.bass * 0.18);

      const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, radius);
      grad.addColorStop(0, moodDef.colors.bgGlow);
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    /**
     * Mood-Specific Particle Rendering
     */
    renderParticles(ctx, w, h, moodDef, dt, now) {
      const t = now * 0.001;
      const mood = this.targetMood;

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];

        // Specific particle behavior per emotional mood
        if (mood === 'sadness') {
          // Downward rain streaks
          p.y += (120 + p.size * 50) * dt * (1 + this.bass * 0.5);
          p.x += Math.sin(t * p.swaySpeed + p.swayPhase) * 0.4;
          if (p.y > h + 20) {
            p.y = -20;
            p.x = Math.random() * w;
          }
          ctx.strokeStyle = `rgba(112, 161, 255, ${p.alpha * 0.75})`;
          ctx.lineWidth = Math.max(1, p.size * 0.4);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 2, p.y + 14 + p.size * 3);
          ctx.stroke();

        } else if (mood === 'heartbreak') {
          // Tumbling ice crystal shards
          p.y += (35 + p.size * 18) * dt * (1 + this.bass * 0.4);
          p.x += Math.sin(t + p.swayPhase) * 0.8;
          p.rotation += p.vRot;
          if (p.y > h + 20) {
            p.y = -20;
            p.x = Math.random() * w;
          }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = `rgba(164, 176, 190, ${p.alpha * 0.65})`;
          ctx.beginPath();
          ctx.moveTo(0, -p.size * 2);
          ctx.lineTo(p.size * 1.5, p.size);
          ctx.lineTo(-p.size * 1.5, p.size);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

        } else if (mood === 'anger') {
          // Erupting turbulent fiery embers
          p.y -= (65 + p.size * 35) * dt * (1 + this.bass * 1.2);
          p.x += (Math.random() - 0.5) * 4.5 + Math.sin(t * 3 + p.swayPhase) * 1.5;
          if (p.y < -20) {
            p.y = h + 15;
            p.x = Math.random() * w;
          }
          ctx.fillStyle = (i % 2 === 0 ? 'rgba(255, 71, 87, ' : 'rgba(255, 165, 2, ') + p.alpha + ')';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + this.beatImpulse * 0.8), 0, Math.PI * 2);
          ctx.fill();

        } else if (mood === 'love') {
          // Drifting soft rose petals
          p.y += (30 + p.size * 15) * dt;
          p.x += Math.sin(t * p.swaySpeed + p.swayPhase) * 1.8;
          p.rotation += p.vRot;
          if (p.y > h + 20) {
            p.y = -20;
            p.x = Math.random() * w;
          }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = `rgba(255, 117, 140, ${p.alpha * 0.75})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 1.8, p.size * 1.1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

        } else if (mood === 'hope') {
          // Ascending golden light motes
          p.y -= (45 + p.size * 20) * dt * (1 + this.bass * 0.6);
          p.x += Math.sin(t * p.swaySpeed + p.swayPhase) * 0.8;
          if (p.y < -20) {
            p.y = h + 20;
            p.x = Math.random() * w;
          }
          ctx.fillStyle = `rgba(246, 211, 101, ${p.alpha * (0.6 + this.mid * 0.5)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.4, 0, Math.PI * 2);
          ctx.fill();

        } else if (mood === 'energetic') {
          // High speed electric sparks
          p.x += p.vx * 4.5 * (1 + this.bass * 1.5);
          p.y += p.vy * 4.5 * (1 + this.bass * 1.5);
          if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
            p.x = w * 0.5 + (Math.random() - 0.5) * 120;
            p.y = h * 0.5 + (Math.random() - 0.5) * 80;
            const ang = Math.random() * Math.PI * 2;
            p.vx = Math.cos(ang) * (2 + Math.random() * 3);
            p.vy = Math.sin(ang) * (2 + Math.random() * 3);
          }
          ctx.strokeStyle = `rgba(0, 242, 254, ${p.alpha * 0.85})`;
          ctx.lineWidth = p.size * 0.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
          ctx.stroke();

        } else {
          // Default: Dreams / Cosmic stardust
          p.y -= (15 + p.size * 8) * dt;
          p.x += Math.sin(t * 0.5 + p.swayPhase) * 0.5;
          if (p.y < -20) {
            p.y = h + 20;
            p.x = Math.random() * w;
          }
          const twinkle = p.alpha * (0.4 + 0.6 * Math.sin(t * 3 + p.seed * 10) + this.treble * 0.5);
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, twinkle)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + this.treble * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    /**
     * Render audio-reactive shockwaves
     */
    renderShockwaves(ctx, moodDef) {
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const sw = this.shockwaves[i];
        sw.radius += sw.speed;
        sw.alpha *= 0.94;

        if (sw.alpha <= 0.02 || sw.radius >= sw.maxRadius) {
          this.shockwaves.splice(i, 1);
          continue;
        }

        ctx.strokeStyle = moodDef.colors.glow.replace(/[\d\.]+\)$/, `${sw.alpha})`);
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    /**
     * Cinematic Kinetic Typography Rendering
     */
    renderTypography(ctx, w, h, moodDef, now) {
      if (!this.lineAnalysis.length || this.activeLineIdx === -1) {
        this.renderEmptyNotice(ctx, w, h, moodDef);
        return;
      }

      const activeLine = this.lineAnalysis[this.activeLineIdx];
      if (!activeLine) return;

      const enterProgress = Math.min(1.0, (now - this.lineEnterTime) / 380);
      const easeEnter = 1 - Math.pow(1 - enterProgress, 3); // Cubic ease out

      // Active font sizing with responsive bounds
      const baseFontSize = Math.max(26, Math.min(46, Math.round(w * 0.042)));
      const activeFontSize = Math.round(baseFontSize * (1.0 + this.typographyScaleBump));

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 1. Previous Line (floating gently upward)
      if (this.activeLineIdx > 0) {
        const prevLine = this.lineAnalysis[this.activeLineIdx - 1];
        if (prevLine && prevLine.raw) {
          ctx.font = `600 ${Math.round(baseFontSize * 0.72)}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.shadowBlur = 0;
          const prevY = h * 0.5 - activeFontSize * 1.85 - (1 - easeEnter) * 15;
          this.drawWrappedText(ctx, prevLine.raw, w * 0.5, prevY, w * 0.85, baseFontSize * 0.85);
        }
      }

      // 2. Active Center Line (Dramatic presence, glow, keyword highlight)
      const activeY = h * 0.5;
      ctx.save();
      ctx.translate(w * 0.5, activeY);
      const scale = this.reducedMotion ? 1.0 : (0.92 + 0.08 * easeEnter + this.typographyScaleBump);
      ctx.scale(scale, scale);

      ctx.font = `800 ${activeFontSize}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;

      // Multi-layer specular glow
      ctx.shadowColor = moodDef.colors.glow;
      ctx.shadowBlur = 28 * (1 + this.bass * 0.8);
      ctx.fillStyle = moodDef.colors.text;

      // Draw active line with keyword coloring
      this.drawStylizedLine(ctx, activeLine, 0, 0, w * 0.88, activeFontSize * 1.25, moodDef);
      ctx.restore();

      // 3. Next Line (previewing softly below)
      if (this.activeLineIdx < this.lineAnalysis.length - 1) {
        const nextLine = this.lineAnalysis[this.activeLineIdx + 1];
        if (nextLine && nextLine.raw) {
          ctx.font = `600 ${Math.round(baseFontSize * 0.75)}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.shadowBlur = 0;
          const nextY = h * 0.5 + activeFontSize * 1.85 + (1 - easeEnter) * 15;
          this.drawWrappedText(ctx, nextLine.raw, w * 0.5, nextY, w * 0.85, baseFontSize * 0.9);
        }
      }
    }

    /**
     * Draw active line with per-word emotional highlighting
     */
    drawStylizedLine(ctx, lineObj, cx, cy, maxWidth, lineHeight, moodDef) {
      const text = lineObj.raw;
      const words = text.split(' ');
      const wordsMeta = words.map(w => {
        const clean = w.toLowerCase().replace(/[^\w]/g, '');
        const isKey = lineObj.highlightedWords && lineObj.highlightedWords.includes(clean);
        return { text: w, isKey };
      });

      // Measure total width
      const spaceWidth = ctx.measureText(' ').width;
      let totalWidth = 0;
      for (let i = 0; i < wordsMeta.length; i++) {
        totalWidth += ctx.measureText(wordsMeta[i].text).width + (i < wordsMeta.length - 1 ? spaceWidth : 0);
      }

      // If text fits in one line, center and draw with keyword accents
      if (totalWidth <= maxWidth) {
        let curX = cx - totalWidth * 0.5;
        for (const wm of wordsMeta) {
          const wWidth = ctx.measureText(wm.text).width;
          if (wm.isKey) {
            ctx.fillStyle = moodDef.colors.accent;
            ctx.shadowColor = moodDef.colors.accent2;
            ctx.shadowBlur = 35 * (1 + this.bass * 1.2);
          } else {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = moodDef.colors.glow;
            ctx.shadowBlur = 24 * (1 + this.bass * 0.5);
          }
          ctx.fillText(wm.text, curX + wWidth * 0.5, cy);
          curX += wWidth + spaceWidth;
        }
      } else {
        // Fallback for long multi-line lyrics: balanced wrap
        this.drawWrappedText(ctx, text, cx, cy, maxWidth, lineHeight);
      }
    }

    /**
     * Helper: wrap text into balanced lines
     */
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
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.shadowBlur = 0;
      ctx.fillText('Listening to music…', w * 0.5, h * 0.5);
    }

    /**
     * Get active mood details
     */
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
