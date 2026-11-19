import test from 'node:test';
import assert from 'node:assert/strict';
import SonaraEngine from '../src/renderer/sonara-engine.js';

test('SonaraEngine: Emotional analysis detects Love & Warmth', () => {
  const lyrics = {
    synced: [
      { t: 0, text: 'I love you my beautiful darling forever and always' },
      { t: 5, text: 'Your sweet smile warms my heart with gentle light' }
    ]
  };

  const analyzed = SonaraEngine.analyzeLyrics(lyrics);
  assert.equal(analyzed.songMood, 'love');
  assert.equal(analyzed.lines.length, 2);
  assert.ok(analyzed.lines[0].highlightedWords.includes('love'));
  assert.ok(analyzed.lines[0].highlightedWords.includes('darling'));
  assert.ok(analyzed.lines[0].highlightedWords.includes('forever'));
});

test('SonaraEngine: Emotional analysis detects Heartbreak & Longing', () => {
  const lyrics = {
    synced: [
      { t: 0, text: 'My heart is broken and shattered into scars' },
      { t: 4, text: 'Now I cry alone lonely tears in the cold emptiness' }
    ]
  };

  const analyzed = SonaraEngine.analyzeLyrics(lyrics);
  assert.equal(analyzed.songMood, 'heartbreak');
  assert.ok(analyzed.lines[0].highlightedWords.includes('broken'));
  assert.ok(analyzed.lines[0].highlightedWords.includes('shattered'));
});

test('SonaraEngine: Emotional analysis detects Anger & Fire', () => {
  const lyrics = {
    synced: [
      { t: 0, text: 'Burn with rage and fight the burning fire' },
      { t: 3, text: 'Screaming fury against the toxic madness and hate' }
    ]
  };

  const analyzed = SonaraEngine.analyzeLyrics(lyrics);
  assert.equal(analyzed.songMood, 'anger');
  assert.ok(analyzed.lines[0].highlightedWords.includes('burn'));
  assert.ok(analyzed.lines[0].highlightedWords.includes('rage'));
  assert.ok(analyzed.lines[0].highlightedWords.includes('fire'));
});

test('SonaraEngine: Emotional analysis detects Sadness & Rain', () => {
  const lyrics = {
    synced: [
      { t: 0, text: 'Cold rain falls into the dark deep gloom' },
      { t: 4, text: 'Weep in silent sorrow under shadows of despair' }
    ]
  };

  const analyzed = SonaraEngine.analyzeLyrics(lyrics);
  assert.equal(analyzed.songMood, 'sadness');
  assert.ok(analyzed.lines[0].highlightedWords.includes('rain'));
  assert.ok(analyzed.lines[0].highlightedWords.includes('dark'));
});

test('SonaraEngine: Emotional analysis detects Hope & Ascendance', () => {
  const lyrics = {
    synced: [
      { t: 0, text: 'Rise toward the light and spread your golden wings' },
      { t: 4, text: 'Believe in tomorrow as the morning dawn shines free' }
    ]
  };

  const analyzed = SonaraEngine.analyzeLyrics(lyrics);
  assert.equal(analyzed.songMood, 'hope');
  assert.ok(analyzed.lines[0].highlightedWords.includes('rise'));
  assert.ok(analyzed.lines[0].highlightedWords.includes('light'));
  assert.ok(analyzed.lines[0].highlightedWords.includes('wings'));
});

test('SonaraEngine: Emotional analysis detects Cosmic & Dreams', () => {
  const lyrics = {
    synced: [
      { t: 0, text: 'Dreaming among the stars and cosmic moon' },
      { t: 4, text: 'Floating through infinity in starlight wonder' }
    ]
  };

  const analyzed = SonaraEngine.analyzeLyrics(lyrics);
  assert.equal(analyzed.songMood, 'dreams');
  assert.ok(analyzed.lines[0].highlightedWords.includes('dreaming'));
  assert.ok(analyzed.lines[0].highlightedWords.includes('stars'));
  assert.ok(analyzed.lines[0].highlightedWords.includes('moon'));
});

test('SonaraEngine: Synchronization & Seeking', () => {
  const lyrics = {
    synced: [
      { t: 10, text: 'Line one starts at ten seconds' },
      { t: 16, text: 'Line two starts at sixteen seconds' },
      { t: 22, text: 'Line three starts at twenty-two seconds' }
    ]
  };

  SonaraEngine.setLyrics(lyrics, 'test-track-123');
  assert.equal(SonaraEngine.syncedLines.length, 3);

  // Before line 1
  SonaraEngine.syncTime(5);
  assert.equal(SonaraEngine.activeLineIdx, -1);

  // During line 1
  SonaraEngine.syncTime(12);
  assert.equal(SonaraEngine.activeLineIdx, 0);

  // Jump / seek to line 3
  SonaraEngine.syncTime(23);
  assert.equal(SonaraEngine.activeLineIdx, 2);

  // After song
  SonaraEngine.syncTime(50);
  assert.equal(SonaraEngine.activeLineIdx, 2);
});

test('SonaraEngine: Plain lyrics fallback parsing', () => {
  const lyrics = {
    plain: 'First line of plain song\nSecond line of plain song\nThird line'
  };

  SonaraEngine.setLyrics(lyrics, 'test-plain-456');
  assert.equal(SonaraEngine.lineAnalysis.length, 3);
  assert.equal(SonaraEngine.lineAnalysis[0].raw, 'First line of plain song');
});

test('SonaraEngine: Particle creation and shockwave trigger', () => {
  SonaraEngine.width = 1200;
  SonaraEngine.height = 800;
  SonaraEngine.shockwaves = [];
  SonaraEngine.initParticles();
  assert.equal(SonaraEngine.particles.length, SonaraEngine.maxParticles);

  SonaraEngine.triggerShockwave();
  assert.equal(SonaraEngine.shockwaves.length, 1);
  assert.equal(SonaraEngine.shockwaves[0].x, 600);
  assert.equal(SonaraEngine.shockwaves[0].y, 400);
});
