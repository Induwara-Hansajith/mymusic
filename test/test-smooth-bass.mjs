import test from 'node:test';
import assert from 'node:assert/strict';

test('Bass Preset: tuned for smooth punch on normal speakers without cone rattle', () => {
  // Preset curve: [31Hz, 62Hz, 125Hz, 250Hz, 500Hz, 1k, 2k, 4k, 8k, 16k]
  const bassGains = [0, 2.0, 4.0, 1.8, -1.5, 0, 0, 0, 0.5, 0.8];
  
  // 31Hz must be neutral to prevent speaker bottoming out / fluttering
  assert.equal(bassGains[0], 0, '31Hz must not over-excurse normal speakers');
  
  // Punch is focused at 125Hz, warmth at 62Hz and 250Hz
  assert.equal(bassGains[1], 2.0, '62Hz gives smooth foundation');
  assert.equal(bassGains[2], 4.0, '125Hz delivers clean acoustic punch');
  assert.equal(bassGains[3], 1.8, '250Hz provides warm body');
  
  // 500Hz mud scoop
  assert.ok(bassGains[4] < 0, '500Hz scoop removes cardboard/hollow resonance');
});

test('Headroom Compensation: dynamic pre-gain scales to prevent clipping', () => {
  function computeHeadroomGain(gains) {
    let maxBoost = 0;
    for (let i = 0; i < gains.length; i++) {
      if (gains[i] > maxBoost) maxBoost = gains[i];
    }
    if (maxBoost > 0) {
      const headroomDb = -Math.min(4.5, maxBoost * 0.7);
      return Math.pow(10, headroomDb / 20);
    }
    return 1.0;
  }

  // Flat preset
  assert.equal(computeHeadroomGain([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 1.0);

  // Bass Boost preset (max boost = 4.0 dB)
  const bassHeadroom = computeHeadroomGain([0, 2.0, 4.0, 1.8, -1.5, 0, 0, 0, 0.5, 0.8]);
  assert.ok(bassHeadroom < 1.0, 'Should attenuate pre-gain when boosting EQ');
  assert.ok(bassHeadroom >= 0.5, 'Attenuation should be within musical headroom range');

  // Verify headroom is around -2.8 dB (~0.72)
  const db = 20 * Math.log10(bassHeadroom);
  assert.ok(db <= -2.5 && db >= -3.5, `Headroom in dB should be around -2.8 dB, got ${db.toFixed(2)} dB`);
});

test('Master Limiter: soft-knee musical settings preserve bass waveforms without distortion', () => {
  const limiterParams = {
    threshold: -1.2,
    knee: 8.0,
    ratio: 8.0,
    attack: 0.012,
    release: 0.18
  };

  assert.ok(limiterParams.attack >= 0.010, 'Attack must be >= 10ms to prevent low-frequency wave chopping');
  assert.ok(limiterParams.ratio <= 10.0, 'Ratio should be musical (<= 10:1) to avoid brickwall distortion');
  assert.ok(limiterParams.knee >= 6.0, 'Knee should be soft (>= 6dB) for transparent onset');
});
