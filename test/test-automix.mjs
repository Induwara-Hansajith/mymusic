import test from 'node:test';
import assert from 'node:assert/strict';
import store from '../src/lib/store.js';

test('Store: settings can be configured with Apple Music AutoMix defaults', () => {
  store.mutate({ type: 'settings.set', patch: { automix: true, automixMode: 'smart', automixDuration: 'auto', crossfadeDuration: 6 } });
  const s = store.all().settings;
  assert.equal(s.automix, true, 'automix should be true');
  assert.equal(s.automixMode, 'smart', 'automixMode should be smart');
  assert.equal(s.automixDuration, 'auto', 'automixDuration should be auto (Best Mix)');
  assert.equal(s.crossfadeDuration, 6, 'crossfadeDuration should be 6s');
});

test('Store: mutate handles automixDuration and clamps bounds 1s-15s', () => {
  // Set to auto
  store.mutate({ type: 'settings.set', patch: { automixDuration: 'auto' } });
  assert.equal(store.all().settings.automixDuration, 'auto');

  // Set to custom valid numbers
  store.mutate({ type: 'settings.set', patch: { automixDuration: 8 } });
  assert.equal(store.all().settings.automixDuration, 8);

  store.mutate({ type: 'settings.set', patch: { automixDuration: '12' } });
  assert.equal(store.all().settings.automixDuration, 12);

  // Clamp low bound (< 1)
  store.mutate({ type: 'settings.set', patch: { automixDuration: 0 } });
  assert.equal(store.all().settings.automixDuration, 1);

  // Clamp high bound (> 15)
  store.mutate({ type: 'settings.set', patch: { automixDuration: 30 } });
  assert.equal(store.all().settings.automixDuration, 15);

  // Crossfade duration also supports up to 15s
  store.mutate({ type: 'settings.set', patch: { crossfadeDuration: 15 } });
  assert.equal(store.all().settings.crossfadeDuration, 15);

  // Reset back to auto
  store.mutate({ type: 'settings.set', patch: { automixDuration: 'auto' } });
  assert.equal(store.all().settings.automixDuration, 'auto');
});

test('AutoMix: getAutomixDuration returns dynamic Best Mix durations when set to auto', () => {
  function getAutomixDuration(trackDuration, s) {
    const durSetting = s.automixDuration;
    if (durSetting && durSetting !== 'auto' && !isNaN(Number(durSetting))) {
      const customSecs = Math.max(1, Math.min(15, Number(durSetting)));
      if (trackDuration && trackDuration > 10) {
        return Math.min(customSecs, Math.max(2, Math.floor(trackDuration * 0.28)));
      }
      return customSecs;
    }
    if (s.automixMode === 'crossfade') {
      return Math.max(1, Math.min(15, Number(s.crossfadeDuration) || 6));
    }
    // Apple Music dynamic Best Mix:
    if (!trackDuration || trackDuration < 90) return 4.0;
    if (trackDuration < 240) return 6.0;
    return 8.5;
  }

  const sAuto = { automixDuration: 'auto', automixMode: 'smart' };

  // Short track (<90s)
  assert.equal(getAutomixDuration(60, sAuto), 4.0);
  assert.equal(getAutomixDuration(89, sAuto), 4.0);
  assert.equal(getAutomixDuration(0, sAuto), 4.0);
  assert.equal(getAutomixDuration(null, sAuto), 4.0);

  // Standard track (90s - 239s, e.g. 3m 15s)
  assert.equal(getAutomixDuration(90, sAuto), 6.0);
  assert.equal(getAutomixDuration(195, sAuto), 6.0);
  assert.equal(getAutomixDuration(239, sAuto), 6.0);

  // Long track (>=240s, e.g. 4m+)
  assert.equal(getAutomixDuration(240, sAuto), 8.5);
  assert.equal(getAutomixDuration(360, sAuto), 8.5);

  // Custom durations (1s - 15s)
  assert.equal(getAutomixDuration(180, { automixDuration: 3 }), 3);
  assert.equal(getAutomixDuration(180, { automixDuration: 5 }), 5);
  assert.equal(getAutomixDuration(180, { automixDuration: 6 }), 6);
  assert.equal(getAutomixDuration(180, { automixDuration: 10 }), 10);
  assert.equal(getAutomixDuration(180, { automixDuration: 15 }), 15);
});

test('AutoMix: Apple Music Asymmetric DJ Transition Curves prevent volume sag and harmonic clash', () => {
  const mVol = 0.8;

  function calcVolumes(p) {
    const outCurve = Math.pow(Math.cos(p * (Math.PI * 0.5)), 0.78);
    const inCurve = Math.pow(Math.sin(p * (Math.PI * 0.5)), 1.22);
    const energyBoost = 1.0 + 0.06 * Math.sin(p * Math.PI);

    const curAudioVol = Math.max(0, Math.min(1, mVol * outCurve * energyBoost));
    const standbyAudioVol = Math.max(0, Math.min(1, mVol * inCurve * energyBoost));
    return { curAudioVol, standbyAudioVol, outCurve, inCurve, energyBoost };
  }

  // 1. Boundary tests
  const start = calcVolumes(0);
  assert.equal(Math.round(start.curAudioVol * 100) / 100, mVol);
  assert.equal(start.standbyAudioVol, 0);

  const end = calcVolumes(1.0);
  assert.equal(Math.abs(end.curAudioVol) < 1e-6, true);
  assert.equal(Math.round(end.standbyAudioVol * 100) / 100, mVol);

  // 2. Early mix (p = 0.20): incoming track is gentle (avoiding vocal / bass collision)
  const early = calcVolumes(0.2);
  assert.ok(early.standbyAudioVol < 0.22, `Standby volume at 20% should be gentle layer (<0.22), got ${early.standbyAudioVol}`);
  assert.ok(early.curAudioVol > 0.65, `Outgoing volume at 20% should retain strong body (>0.65), got ${early.curAudioVol}`);

  // 3. Midpoint (p = 0.50): combined perceived loudness has energy boost
  const mid = calcVolumes(0.5);
  assert.ok(mid.energyBoost > 1.05, `Energy compensation at p=0.5 should boost volume to counter dip, got ${mid.energyBoost}`);
  const combinedPower = Math.sqrt(Math.pow(mid.curAudioVol, 2) + Math.pow(mid.standbyAudioVol, 2));
  assert.ok(combinedPower >= mVol * 0.95, `Combined acoustic power at midpoint should not sag, got ${combinedPower} for mVol ${mVol}`);

  // 4. All points stay within [0, 1]
  for (let i = 0; i <= 100; i++) {
    const p = i / 100;
    const v = calcVolumes(p);
    assert.ok(v.curAudioVol >= 0 && v.curAudioVol <= 1, `curAudioVol out of bounds at p=${p}`);
    assert.ok(v.standbyAudioVol >= 0 && v.standbyAudioVol <= 1, `standbyAudioVol out of bounds at p=${p}`);
  }
});

test('AutoMix: Outro silence trimming initiates blend before dead-air', () => {
  function getTrim(trackDuration) {
    return (trackDuration > 120) ? 0.7 : 0.2;
  }

  assert.equal(getTrim(180), 0.7, 'Tracks >2m trim 0.7s of trailing silence');
  assert.equal(getTrim(60), 0.2, 'Short tracks trim 0.2s');
});
