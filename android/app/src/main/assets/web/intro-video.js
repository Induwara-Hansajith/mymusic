/**
 * MyMusic v1.1.8 Premiere Introduction Video & Cinematic Experience
 * Showcases the v1.1.8 Milestone Release and announces Linux packaging & Cross-Platform Cloud Sync.
 */
(() => {
  const INTRO_VERSION = '1.1.8';
  const STORAGE_KEY = 'mymusic_intro_seen_v118';
  const TOTAL_DURATION = 46; // seconds

  const CHAPTERS = [
    { start: 0,  end: 8,  id: 'genesis', title: 'v1.1.8 Premiere' },
    { start: 8,  end: 20, id: 'crossplatform', title: 'Linux & Cloud Sync' },
    { start: 20, end: 30, id: 'cloudauth', title: 'Google Sign-In' },
    { start: 30, end: 38, id: 'sonara', title: 'Sonara & AutoMix' },
    { start: 38, end: 46, id: 'launch', title: 'Launch Experience' }
  ];

  let isPlaying = false;
  let isMuted = false;
  let currentTime = 0;
  let lastTimestamp = 0;
  let animFrameId = null;
  let audioCtx = null;
  let synthGain = null;
  let activeOscillators = [];
  let canvas = null;
  let ctx = null;
  let stars = [];
  let packets = [];
  let activeChapterIndex = 0;

  // Initialize starfield particles
  function initParticles() {
    stars = [];
    for (let i = 0; i < 160; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 1600,
        y: (Math.random() - 0.5) * 900,
        z: Math.random() * 1000 + 50,
        size: Math.random() * 2 + 1,
        color: ['#8b5cf6', '#06b6d4', '#ec4899', '#3b82f6', '#ffffff'][Math.floor(Math.random() * 5)]
      });
    }

    packets = [];
    for (let i = 0; i < 18; i++) {
      packets.push({
        progress: Math.random(),
        speed: 0.005 + Math.random() * 0.009,
        source: Math.floor(Math.random() * 3), // 0: Desktop, 1: Laptop, 2: Phone
        color: ['#06b6d4', '#8b5cf6', '#10b981'][Math.floor(Math.random() * 3)]
      });
    }
  }

  // Web Audio ambient harmonic soundtrack
  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
      
      const comp = audioCtx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-24, audioCtx.currentTime);
      comp.knee.setValueAtTime(30, audioCtx.currentTime);
      comp.ratio.setValueAtTime(12, audioCtx.currentTime);
      comp.attack.setValueAtTime(0.003, audioCtx.currentTime);
      comp.release.setValueAtTime(0.25, audioCtx.currentTime);

      synthGain = audioCtx.createGain();
      synthGain.gain.setValueAtTime(isMuted ? 0 : 0.18, audioCtx.currentTime);

      synthGain.connect(comp);
      comp.connect(audioCtx.destination);
    } catch (e) {
      console.warn('[IntroVideo] Web Audio initialization deferred:', e);
    }
  }

  const CHORD_MAP = [
    // Scene 1: Deep cosmic ambient C Maj9
    [65.41, 130.81, 196.00, 246.94, 293.66, 329.63],
    // Scene 2: Uplifting expanding F Maj9 (Cross-platform revelation)
    [87.31, 174.61, 261.63, 329.63, 392.00, 523.25],
    // Scene 3: Bright technological G Maj7 (Google Cloud Auth)
    [98.00, 196.00, 293.66, 369.99, 440.00, 587.33],
    // Scene 4: Punchy rhythmic A Min9 (Sonara Bass & AutoMix)
    [110.00, 220.00, 261.63, 329.63, 392.00, 493.88],
    // Scene 5: Grand resolving C Maj (Ready to Launch)
    [65.41, 130.81, 261.63, 329.63, 392.00, 523.25, 659.25]
  ];

  function playChordForChapter(chapterIdx) {
    if (!audioCtx || isMuted) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    // Smoothly fade out current oscillators
    const now = audioCtx.currentTime;
    activeOscillators.forEach(osc => {
      try {
        osc.gainNode.gain.cancelScheduledValues(now);
        osc.gainNode.gain.setValueAtTime(osc.gainNode.gain.value, now);
        osc.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        osc.stop(now + 0.85);
      } catch {}
    });
    activeOscillators = [];

    const freqs = CHORD_MAP[chapterIdx] || CHORD_MAP[0];
    freqs.forEach((freq, i) => {
      try {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();

        // Sub bass is sine, mid-high harmonics are subtle saw or warm triangle
        osc.type = i === 0 ? 'sine' : (i % 2 === 0 ? 'triangle' : 'sine');
        osc.frequency.setValueAtTime(freq, now);

        // Gentle volume distribution
        const targetVol = i === 0 ? 0.35 : (0.12 / Math.sqrt(i + 1));
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(targetVol, now + 1.2 + (i * 0.15));

        osc.connect(g);
        g.connect(synthGain);
        osc.start(now);

        activeOscillators.push(osc);
        osc.gainNode = g;
      } catch {}
    });
  }

  function stopAllAudio() {
    if (!audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      activeOscillators.forEach(osc => {
        try {
          osc.gainNode.gain.cancelScheduledValues(now);
          osc.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
          osc.stop(now + 0.35);
        } catch {}
      });
      activeOscillators = [];
    } catch {}
  }

  // Draw procedural 3D motion graphics on canvas
  function renderCanvas() {
    if (!canvas || !ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.fillStyle = '#0a0d16';
    ctx.fillRect(0, 0, w, h);

    const time = currentTime;
    const chapIdx = activeChapterIndex;

    // 1. Ambient Glow Backlight
    const glowColors = [
      'rgba(139, 92, 246, 0.25)', // Violet
      'rgba(6, 182, 212, 0.32)',  // Cyan
      'rgba(59, 130, 246, 0.28)', // Blue
      'rgba(236, 72, 153, 0.28)', // Pink/Neon
      'rgba(16, 185, 129, 0.30)'  // Emerald
    ];
    const grad = ctx.createRadialGradient(cx, cy, 50, cx, cy, Math.max(w, h) * 0.65);
    grad.addColorStop(0, glowColors[chapIdx] || glowColors[0]);
    grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.4)');
    grad.addColorStop(1, 'rgba(10, 13, 22, 0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. Starfield flight simulation
    const speed = 1.8 + Math.sin(time * 0.8) * 0.6;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.z -= speed;
      if (s.z <= 1) {
        s.z = 1000;
        s.x = (Math.random() - 0.5) * 1600;
        s.y = (Math.random() - 0.5) * 900;
      }
      const k = 250 / s.z;
      const px = s.x * k + cx;
      const py = s.y * k + cy;

      if (px >= 0 && px <= w && py >= 0 && py <= h) {
        const alpha = Math.min(1, (1000 - s.z) / 400);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(px, py, s.size * k * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // 3. Scene-specific motion elements
    if (chapIdx === 0) {
      // Scene 1: Sonic Rings Pulse
      const ringCount = 4;
      for (let r = 0; r < ringCount; r++) {
        const ringProg = ((time * 0.8 + r * (1 / ringCount)) % 1);
        const radius = ringProg * 280 + 40;
        const alpha = (1 - ringProg) * 0.45;
        ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy - 30, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (chapIdx === 1) {
      // Scene 2: Cross-Platform Interconnected Nodes
      const cloudX = cx;
      const cloudY = cy - 40;

      const devices = [
        { name: 'Windows Desktop', x: cx - 240, y: cy + 40, icon: '🖥️' },
        { name: 'Laptop / Ultrabook', x: cx + 240, y: cy + 40, icon: '💻' },
        { name: 'Mobile / Tablet', x: cx, y: cy + 140, icon: '📱' }
      ];

      // Draw connection lines to Cloud Core
      devices.forEach((dev, i) => {
        const pulse = Math.sin(time * 3 + i) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(6, 182, 212, ${0.4 + pulse * 0.4})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -time * 25;
        ctx.beginPath();
        ctx.moveTo(cloudX, cloudY);
        ctx.lineTo(dev.x, dev.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Device Node Box
        ctx.fillStyle = 'rgba(19, 23, 35, 0.85)';
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(dev.x - 70, dev.y - 25, 140, 50, 10);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 12px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.fillText(`${dev.icon} ${dev.name}`, dev.x, dev.y + 5);
      });

      // Moving Data Packets
      packets.forEach(pkt => {
        pkt.progress = (pkt.progress + pkt.speed) % 1;
        const targetDev = devices[pkt.source];
        const px = cloudX + (targetDev.x - cloudX) * pkt.progress;
        const py = cloudY + (targetDev.y - cloudY) * pkt.progress;

        ctx.fillStyle = pkt.color;
        ctx.shadowColor = pkt.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Central Cloud Hub Node
      const hubPulse = Math.sin(time * 4) * 8;
      ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.beginPath();
      ctx.arc(cloudX, cloudY, 65 + hubPulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cloudX, cloudY, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = '28px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('☁️', cloudX, cloudY + 9);
    } else if (chapIdx === 2) {
      // Scene 3: Google & Supabase Cloud Security Shield
      const shieldY = cy - 35;
      const pulse = Math.sin(time * 3) * 6;

      ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, shieldY, 80 + pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Digital Lock Hexagon
      ctx.fillStyle = 'rgba(19, 23, 35, 0.9)';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i + (time * 0.2);
        const hx = cx + Math.cos(ang) * 60;
        const hy = shieldY + Math.sin(ang) * 60;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 30px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('⚡', cx, shieldY + 10);
    } else if (chapIdx === 3) {
      // Scene 4: Sonara Audio Equalizer Spectrum
      const bars = 24;
      const barW = 12;
      const spacing = 8;
      const totalW = bars * (barW + spacing);
      const startX = cx - totalW / 2;
      const baseLine = cy + 40;

      for (let b = 0; b < bars; b++) {
        const wave = Math.sin(time * 6 + b * 0.4) * 0.5 + 0.5;
        const wave2 = Math.cos(time * 4 - b * 0.3) * 0.5 + 0.5;
        const hVal = (wave * 0.6 + wave2 * 0.4) * 90 + 12;

        const bx = startX + b * (barW + spacing);
        const by = baseLine - hVal;

        const barGrad = ctx.createLinearGradient(bx, by, bx, baseLine);
        barGrad.addColorStop(0, '#ec4899');
        barGrad.addColorStop(0.5, '#8b5cf6');
        barGrad.addColorStop(1, '#06b6d4');

        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.roundRect(bx, by, barW, hVal, 4);
        ctx.fill();
      }
    } else if (chapIdx === 4) {
      // Scene 5: Celebration Vortex
      const vortexRays = 12;
      for (let r = 0; r < vortexRays; r++) {
        const ang = (Math.PI * 2 / vortexRays) * r + (time * 0.4);
        const dist = 120 + Math.sin(time * 2 + r) * 30;
        const rx = cx + Math.cos(ang) * dist;
        const ry = cy - 30 + Math.sin(ang) * dist;

        ctx.fillStyle = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b'][r % 4];
        ctx.beginPath();
        ctx.arc(rx, ry, 5 + Math.sin(time * 4 + r) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Sync HTML scene overlays and timeline controls with current playback time
  function updateDOMState() {
    // Determine active chapter
    let nextChapIdx = 0;
    for (let i = 0; i < CHAPTERS.length; i++) {
      if (currentTime >= CHAPTERS[i].start && currentTime < CHAPTERS[i].end) {
        nextChapIdx = i;
        break;
      }
    }
    if (currentTime >= TOTAL_DURATION) {
      nextChapIdx = CHAPTERS.length - 1;
    }

    if (nextChapIdx !== activeChapterIndex) {
      activeChapterIndex = nextChapIdx;
      playChordForChapter(activeChapterIndex);

      // Toggle active scene card
      document.querySelectorAll('.intro-scene-card').forEach((card, idx) => {
        card.classList.toggle('active', idx === activeChapterIndex);
      });

      // Update active chapter chip in bottom bar
      document.querySelectorAll('.intro-chapter-chip').forEach((chip, idx) => {
        chip.classList.toggle('active', idx === activeChapterIndex);
      });
    }

    // Update scrubber progress bar
    const progressPct = Math.min(100, Math.max(0, (currentTime / TOTAL_DURATION) * 100));
    const fillEl = document.getElementById('introProgressFill');
    const handleEl = document.getElementById('introProgressHandle');
    if (fillEl) fillEl.style.width = `${progressPct}%`;
    if (handleEl) handleEl.style.left = `${progressPct}%`;

    // Timecode string
    const timeEl = document.getElementById('introTimecode');
    if (timeEl) {
      const curM = Math.floor(currentTime / 60);
      const curS = Math.floor(currentTime % 60);
      const totM = Math.floor(TOTAL_DURATION / 60);
      const totS = Math.floor(TOTAL_DURATION % 60);
      timeEl.textContent = `${curM}:${curS.toString().padStart(2, '0')} / ${totM}:${totS.toString().padStart(2, '0')}`;
    }
  }

  function loop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    if (isPlaying) {
      currentTime += dt;
      if (currentTime >= TOTAL_DURATION) {
        currentTime = TOTAL_DURATION;
        pause();
      }
      updateDOMState();
    }

    renderCanvas();
    animFrameId = requestAnimationFrame(loop);
  }

  function play() {
    isPlaying = true;
    lastTimestamp = performance.now();
    initAudio();
    playChordForChapter(activeChapterIndex);

    const playBtn = document.getElementById('introPlayPauseBtn');
    if (playBtn) {
      playBtn.innerHTML = `
        <svg viewBox="0 0 24 24" class="ic" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>
      `;
      playBtn.setAttribute('title', 'Pause');
    }
  }

  function pause() {
    isPlaying = false;
    stopAllAudio();

    const playBtn = document.getElementById('introPlayPauseBtn');
    if (playBtn) {
      playBtn.innerHTML = `
        <svg viewBox="0 0 24 24" class="ic" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      `;
      playBtn.setAttribute('title', 'Play');
    }
  }

  function togglePlay() {
    if (isPlaying) pause();
    else {
      if (currentTime >= TOTAL_DURATION) currentTime = 0;
      play();
    }
  }

  function seekTo(timeSec) {
    currentTime = Math.max(0, Math.min(TOTAL_DURATION, timeSec));
    updateDOMState();
    if (isPlaying) {
      playChordForChapter(activeChapterIndex);
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    if (synthGain && audioCtx) {
      synthGain.gain.setValueAtTime(isMuted ? 0 : 0.18, audioCtx.currentTime);
    }
    const muteBtn = document.getElementById('introMuteBtn');
    if (muteBtn) {
      muteBtn.innerHTML = isMuted ? `
        <svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
      ` : `
        <svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      `;
      muteBtn.setAttribute('title', isMuted ? 'Unmute Audio' : 'Mute Audio');
    }
  }

  function closeIntro() {
    pause();
    stopAllAudio();
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    const modal = document.getElementById('introModal');
    if (modal) {
      modal.classList.add('fading-out');
      setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('fading-out');
        modal.innerHTML = '';
      }, 350);
    }

    try {
      localStorage.setItem(STORAGE_KEY, INTRO_VERSION);
    } catch {}
  }

  function openIntroModal(opts = {}) {
    const modal = document.getElementById('introModal');
    if (!modal) return;

    initParticles();
    currentTime = 0;
    activeChapterIndex = 0;

    modal.innerHTML = `
      <div class="intro-theater">
        <!-- Top status bar -->
        <div class="intro-topbar">
          <div class="intro-brand">
            <span class="intro-badge-pulse"></span>
            <span class="intro-title-text">MyMusic 1.1.8</span>
            <span class="intro-tag">WORLD PREMIERE</span>
          </div>
          <div class="intro-top-actions">
            <button id="introMuteBtn" class="intro-icon-btn" title="Toggle Sound">
              <svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            </button>
            <button id="introCloseBtn" class="intro-close-btn" title="Skip to App">
              <span>Skip</span>
              <svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Cinema stage container -->
        <div class="intro-stage" id="introStage">
          <canvas id="introCanvas" width="1280" height="720"></canvas>

          <!-- Scene 1: The Evolution Begins -->
          <div class="intro-scene-card active" data-scene="0">
            <div class="intro-card-pill">MILESTONE RELEASE</div>
            <h1 class="intro-hero-title">The Evolution of Sound</h1>
            <p class="intro-hero-desc">Welcome to <strong>MyMusic 1.1.8</strong>. Engineered for audiophiles, optimized for speed, and crafted without compromises.</p>
          </div>

          <!-- Scene 2: Cross Platform Sync Announcement -->
          <div class="intro-scene-card" data-scene="1">
            <div class="intro-card-pill highlight">LINUX & CROSS-PLATFORM</div>
            <h1 class="intro-hero-title">Linux Release & Cloud Sync</h1>
            <p class="intro-hero-desc">Break free from desktop boundaries. Now available natively on Linux (AppImage, deb, tar.gz) and Windows. Your playlists, favorites, listening stats, and queue synchronize seamlessly in the cloud.</p>
            <div class="intro-feature-row">
              <div class="intro-feature-chip">🐧 Linux & Windows Native</div>
              <div class="intro-feature-chip">⚡ Real-time Supabase Cloud</div>
              <div class="intro-feature-chip">🔄 Smart Library Merge</div>
            </div>
          </div>

          <!-- Scene 3: Google Sign-In & Unified Cloud Accounts -->
          <div class="intro-scene-card" data-scene="2">
            <div class="intro-card-pill">SEAMLESS CLOUD AUTH</div>
            <h1 class="intro-hero-title">One-Tap Google Sign-In</h1>
            <p class="intro-hero-desc">Connect your account with Google or email in seconds. Enjoy instant automatic backups, device handoff, and frictionless profile synchronization.</p>
          </div>

          <!-- Scene 4: Sonara Audio & AutoMix Engine -->
          <div class="intro-scene-card" data-scene="3">
            <div class="intro-card-pill">PRO STUDIO ACOUSTICS</div>
            <h1 class="intro-hero-title">Sonara Audio & Smooth Bass</h1>
            <p class="intro-hero-desc">Engineered 10-band studio equalization with Smooth Bass speaker calibration, headroom compensation to eliminate clipping, and Apple-grade AutoMix DJ transitions.</p>
          </div>

          <!-- Scene 5: Launch Experience -->
          <div class="intro-scene-card" data-scene="4">
            <div class="intro-card-pill highlight">GET STARTED</div>
            <h1 class="intro-hero-title">Your Stage Awaits</h1>
            <p class="intro-hero-desc">Experience v1.1.8 today. Connect your cloud account or begin exploring right away.</p>
            <div class="intro-cta-actions">
              <button id="introAuthActionBtn" class="intro-primary-btn">
                <svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Connect Cloud Account
              </button>
              <button id="introEnterAppBtn" class="intro-secondary-btn">
                Start Listening
              </button>
            </div>
          </div>
        </div>

        <!-- Video Player Scrubbing & Transport Controls -->
        <div class="intro-transport-bar">
          <!-- Scrubber Timeline with Chapter Ticks -->
          <div class="intro-scrubber-track" id="introScrubber">
            <div class="intro-scrubber-fill" id="introProgressFill"></div>
            <div class="intro-scrubber-handle" id="introProgressHandle"></div>
            <div class="intro-chapter-markers">
              <div class="intro-marker" style="left: 0%" title="Genesis"></div>
              <div class="intro-marker" style="left: 17.39%" title="Cross-Platform"></div>
              <div class="intro-marker" style="left: 43.47%" title="Google Auth"></div>
              <div class="intro-marker" style="left: 65.21%" title="Sonara Audio"></div>
              <div class="intro-marker" style="left: 82.60%" title="Launch"></div>
            </div>
          </div>

          <!-- Bottom Control Bar -->
          <div class="intro-control-row">
            <div class="intro-ctrl-left">
              <button id="introPlayPauseBtn" class="intro-transport-btn" title="Pause">
                <svg viewBox="0 0 24 24" class="ic" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              </button>
              <button id="introReplayBtn" class="intro-transport-btn" title="Replay from Beginning">
                <svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
              </button>
              <span id="introTimecode" class="intro-timecode">0:00 / 0:46</span>
            </div>

            <!-- Chapter Jump Buttons -->
            <div class="intro-chapters-nav">
              ${CHAPTERS.map((c, i) => `
                <button class="intro-chapter-chip ${i === 0 ? 'active' : ''}" data-chap="${i}">
                  ${c.title}
                </button>
              `).join('')}
            </div>

            <div class="intro-ctrl-right">
              <button id="introExploreBtn" class="intro-action-pill" title="Explore App">
                <span>Enter App</span>
                <svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');

    canvas = document.getElementById('introCanvas');
    if (canvas) {
      ctx = canvas.getContext('2d');
      // Responsive canvas resolution
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width * (window.devicePixelRatio || 1);
        canvas.height = rect.height * (window.devicePixelRatio || 1);
      }
    }

    // Attach control listeners
    const playBtn = document.getElementById('introPlayPauseBtn');
    if (playBtn) playBtn.onclick = () => togglePlay();

    const replayBtn = document.getElementById('introReplayBtn');
    if (replayBtn) replayBtn.onclick = () => seekTo(0);

    const muteBtn = document.getElementById('introMuteBtn');
    if (muteBtn) muteBtn.onclick = () => toggleMute();

    const closeBtn = document.getElementById('introCloseBtn');
    if (closeBtn) closeBtn.onclick = () => closeIntro();

    const exploreBtn = document.getElementById('introExploreBtn');
    if (exploreBtn) exploreBtn.onclick = () => closeIntro();

    const enterBtn = document.getElementById('introEnterAppBtn');
    if (enterBtn) enterBtn.onclick = () => closeIntro();

    const authBtn = document.getElementById('introAuthActionBtn');
    if (authBtn) {
      authBtn.onclick = () => {
        closeIntro();
        if (typeof window.openAuthModal === 'function') {
          window.openAuthModal('signin');
        }
      };
    }

    // Scrubber click/drag listener
    const scrubber = document.getElementById('introScrubber');
    if (scrubber) {
      const handleScrub = (e) => {
        const rect = scrubber.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        seekTo(fraction * TOTAL_DURATION);
      };

      scrubber.onmousedown = (e) => {
        handleScrub(e);
        const onMouseMove = (ev) => handleScrub(ev);
        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      };
    }

    // Chapter chips click
    document.querySelectorAll('.intro-chapter-chip').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.chap, 10);
        if (CHAPTERS[idx]) {
          seekTo(CHAPTERS[idx].start);
        }
      };
    });

    // Keyboard navigation
    const keyHandler = (e) => {
      if (modal.classList.contains('hidden')) {
        window.removeEventListener('keydown', keyHandler);
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'Escape') {
        closeIntro();
      }
    };
    window.addEventListener('keydown', keyHandler);

    // Start video animation loop and audio
    isPlaying = true;
    lastTimestamp = performance.now();
    play();
    if (!animFrameId) {
      animFrameId = requestAnimationFrame(loop);
    }
  }

  // Check whether to show intro on first launch of v1.1.7
  function checkV117Intro() {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen !== INTRO_VERSION) {
        // Subtle delay so the app window renders underneath gracefully
        setTimeout(() => {
          openIntroModal();
        }, 650);
      }
    } catch (e) {
      console.warn('[IntroVideo] Storage check error:', e);
    }
  }

  // Export functions to window
  window.checkV117Intro = checkV117Intro;
  window.openV117Intro = openIntroModal;
  window.checkV118Intro = checkV117Intro;
  window.openV118Intro = openIntroModal;
})();
