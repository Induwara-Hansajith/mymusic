import test from 'node:test';
import assert from 'node:assert/strict';
import SonaraEngine from '../src/renderer/sonara-engine.js';

test('SonaraEngine: clear() resets all line analysis, active indices, and lyric state', () => {
  const songA = {
    synced: [
      { t: 0, text: 'Song A line 1' },
      { t: 5, text: 'Song A line 2' }
    ]
  };

  SonaraEngine.setLyrics(songA, 'track-A');
  SonaraEngine.syncTime(2);
  assert.equal(SonaraEngine.activeLineIdx, 0);
  assert.equal(SonaraEngine.lineAnalysis.length, 2);

  // Clear on track change
  SonaraEngine.clear();
  assert.equal(SonaraEngine.lyrics, null);
  assert.equal(SonaraEngine.trackId, null);
  assert.equal(SonaraEngine.lineAnalysis.length, 0);
  assert.equal(SonaraEngine.activeLineIdx, -1);
  assert.equal(SonaraEngine.statusText, 'Loading lyrics…');

  // Syncing while cleared does not trigger any lines
  SonaraEngine.syncTime(2);
  assert.equal(SonaraEngine.activeLineIdx, -1);
});

test('SonaraEngine: Track change does not retain or animate previous song lyrics while loading', () => {
  const songA = {
    synced: [
      { t: 0, text: 'I am dancing in the rain with you' },
      { t: 8, text: 'Every moment feels like magic' }
    ]
  };

  SonaraEngine.setLyrics(songA, 'track-A');
  SonaraEngine.syncTime(1);
  assert.equal(SonaraEngine.activeLineIdx, 0);
  assert.equal(SonaraEngine.lineAnalysis[0].raw, 'I am dancing in the rain with you');

  // Song changes to track B (which is currently fetching lyrics from network)
  SonaraEngine.clear();
  SonaraEngine.statusText = 'Loading lyrics…';

  // Audio begins playing track B at t = 0
  SonaraEngine.syncTime(0);
  assert.equal(SonaraEngine.activeLineIdx, -1);
  assert.equal(SonaraEngine.lineAnalysis.length, 0);
  assert.equal(SonaraEngine.statusText, 'Loading lyrics…');
});

test('SonaraEngine: Content-scoped cache key prevents cross-track lyric poisoning', () => {
  const songA = {
    synced: [
      { t: 0, text: 'Old lyrics from song A' }
    ]
  };

  const songB = {
    synced: [
      { t: 0, text: 'Brand new lyrics from song B' }
    ]
  };

  // Suppose track-B was passed with stale songA lyrics during a transition race
  SonaraEngine.setLyrics(songA, 'track-B');
  assert.equal(SonaraEngine.lineAnalysis[0].raw, 'Old lyrics from song A');

  // Later, real lyrics for track-B arrive
  SonaraEngine.setLyrics(songB, 'track-B');
  assert.equal(SonaraEngine.lineAnalysis[0].raw, 'Brand new lyrics from song B');
  assert.notEqual(SonaraEngine.lineAnalysis[0].raw, 'Old lyrics from song A');
});

test('SonaraEngine: Empty and instrumental tracks display clean status without stale text', () => {
  const songA = {
    synced: [
      { t: 0, text: 'Previous track lyrics' }
    ]
  };

  SonaraEngine.setLyrics(songA, 'track-A');
  assert.equal(SonaraEngine.lineAnalysis.length, 1);

  // Switch to instrumental / no lyrics track
  SonaraEngine.setLyrics({ synced: null, plain: null }, 'track-instrumental');
  assert.equal(SonaraEngine.lineAnalysis.length, 0);
  assert.equal(SonaraEngine.activeLineIdx, -1);
  assert.equal(SonaraEngine.statusText, 'No lyrics found for this track');

  SonaraEngine.syncTime(15);
  assert.equal(SonaraEngine.activeLineIdx, -1);
});
