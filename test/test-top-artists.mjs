// test/test-top-artists.mjs
// Automated tests for Top Artist Pictures & Store Resolution
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

async function run() {
  console.log('[TEST] Starting Top Artist pictures verification...');

  // 1. Test ytm.artistThumb
  const ytmUrl = pathToFileURL(path.join(appRoot, 'src', 'lib', 'ytm.js')).href;
  const ytm = await import(ytmUrl);
  assert(typeof ytm.artistThumb === 'function', 'ytm.artistThumb must be exported');

  // Test with known artist ID (The Weeknd)
  const res1 = await ytm.artistThumb('The Weeknd', 'UClYV6hHlupm_S_ObS1W-DYw');
  assert(res1 && res1.thumb, 'Must resolve thumbnail for The Weeknd');
  assert(res1.id === 'UClYV6hHlupm_S_ObS1W-DYw', 'Must preserve artistId');
  console.log('PASS: Direct artistId resolution ->', res1.thumb);

  // Test with multi-artist name without ID (KAROL G, rusowsky)
  const res2 = await ytm.artistThumb('KAROL G, rusowsky');
  assert(res2 && res2.thumb, 'Must resolve thumbnail for multi-artist search');
  console.log('PASS: Multi-artist name search ->', res2.thumb);

  // 2. Test store backfilling and mutations
  const storeUrl = pathToFileURL(path.join(appRoot, 'src', 'lib', 'store.js')).href;
  const storeModule = await import(storeUrl);
  const store = storeModule.default || storeModule;
  const initial = store.all();
  assert(initial.playStats, 'playStats must exist in store');

  // Test stats.artistUpdate
  store.mutate({
    type: 'stats.artistUpdate',
    artist: 'Test Artist 123',
    thumb: 'https://example.com/test-artist.jpg',
    id: 'UCTest123'
  });

  const updated = store.all();
  const a = updated.playStats.artists && updated.playStats.artists['Test Artist 123'];
  assert(a, 'Artist entry must exist after stats.artistUpdate');
  assert(a.thumb === 'https://example.com/test-artist.jpg', 'Artist thumb must be saved');
  assert(a.id === 'UCTest123', 'Artist id must be saved');
  console.log('PASS: Store stats.artistUpdate persists artist thumb and id');

  // Clean up test entry
  delete updated.playStats.artists['Test Artist 123'];

  console.log('\n======================================');
  console.log('ALL TOP ARTIST PICTURE TESTS PASSED!');
  console.log('======================================');
}

run().catch((e) => {
  console.error('[TEST FAIL]', e);
  process.exit(1);
});
