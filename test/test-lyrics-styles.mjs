import test from 'node:test';
import assert from 'node:assert/strict';
import store from '../src/lib/store.js';

test('Store: settings.lyricsStyle defaults and accepts valid values', async () => {
  const initial = store.all();
  assert.ok(initial.settings);

  // Set to apple-music
  await store.mutate({ type: 'settings.set', patch: { lyricsStyle: 'apple-music' } });
  let s = store.all().settings;
  assert.equal(s.lyricsStyle, 'apple-music');

  // Set to cinematic
  await store.mutate({ type: 'settings.set', patch: { lyricsStyle: 'cinematic' } });
  s = store.all().settings;
  assert.equal(s.lyricsStyle, 'cinematic');

  // Set to karaoke
  await store.mutate({ type: 'settings.set', patch: { lyricsStyle: 'karaoke' } });
  s = store.all().settings;
  assert.equal(s.lyricsStyle, 'karaoke');

  // Set to minimal
  await store.mutate({ type: 'settings.set', patch: { lyricsStyle: 'minimal' } });
  s = store.all().settings;
  assert.equal(s.lyricsStyle, 'minimal');

  // Reject invalid style (should keep minimal)
  await store.mutate({ type: 'settings.set', patch: { lyricsStyle: 'invalid-exploit-style' } });
  s = store.all().settings;
  assert.equal(s.lyricsStyle, 'minimal');

  // Reset back to cinematic
  await store.mutate({ type: 'settings.set', patch: { lyricsStyle: 'cinematic' } });
});
