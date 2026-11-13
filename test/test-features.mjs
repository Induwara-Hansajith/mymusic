import assert from 'assert';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const downloader = require('../src/lib/downloader.js');
const importer = require('../src/lib/importer.js');
const store = require('../src/lib/store.js');

console.log('[TEST] Running Hidara Feature Unit Tests');

// 1. Downloader tests
const dlDir = downloader.getDownloadDir();
assert(typeof dlDir === 'string' && dlDir.length > 0, 'download dir valid');
assert(fs.existsSync(dlDir), 'download dir exists on disk');

const dlList = await downloader.list();
assert(Array.isArray(dlList), 'download list returns array');
console.log('PASS [downloader] directory:', dlDir, '| existing items:', dlList.length);

// 2. Importer tests
const csvSample = `Title, Artist, Album
Blinding Lights, The Weeknd, After Hours
Starboy, The Weeknd, Starboy
As It Was, Harry Styles, Harry's House
Dua Lipa - Levitating
`;
const parsed = importer.parseCsv(csvSample);
assert(parsed.length === 4, `expected 4 rows, got ${parsed.length}`);
assert(parsed[0].title === 'Blinding Lights' && parsed[0].artist === 'The Weeknd', 'row 0 parsed');
assert(parsed[1].title === 'Starboy' && parsed[1].artist === 'The Weeknd', 'row 1 parsed');
assert(parsed[3].artist === 'Dua Lipa' && parsed[3].title === 'Levitating', 'row 3 hyphen parsed');
console.log('PASS [importer] parsed CSV / text list:', parsed.length, 'rows');

// 3. Store settings & stats tests
const state = store.all();
assert(state.settings, 'settings exists');
assert(state.settings.eq && state.settings.eq.length === 10, '10-band EQ defaults exist');
assert(typeof state.settings.speed === 'number', 'speed setting exists');
assert(typeof state.settings.pitchLock === 'boolean', 'pitchLock setting exists');
assert(state.settings.wallpaper !== undefined, 'wallpaper setting exists');
assert(state.settings.closeToTray !== undefined, 'closeToTray setting exists');
assert(state.playStats, 'playStats exists');

// Mutate stats
const testTrack = {
  id: 'test_' + Date.now(),
  title: 'Test Song',
  artist: 'Test Artist',
  thumb: 'https://example.com/thumb.jpg',
  duration: 180
};

const updatedState = store.mutate({
  type: 'stats.record',
  track: testTrack,
  seconds: 45
});

assert(updatedState.playStats.totalPlays >= 1, 'stats.record incremented totalPlays');
assert(updatedState.playStats.totalSeconds >= 45, 'stats.record incremented totalSeconds');
assert(updatedState.playStats.tracks[testTrack.id], 'track recorded in stats');
assert(updatedState.playStats.tracks[testTrack.id].plays === 1, 'track play count is 1');
assert(updatedState.playStats.artists['Test Artist'], 'artist recorded in stats');
console.log('PASS [store] settings & listening analytics recording verified');

console.log('ALL FEATURE UNIT TESTS PASSED!');
