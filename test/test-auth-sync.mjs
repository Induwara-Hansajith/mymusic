import test from 'node:test';
import assert from 'node:assert/strict';
import store from '../src/lib/store.js';
import authSync from '../src/lib/auth-sync.js';

test('AuthSync: Engine initializes with store without throwing', () => {
  authSync.init(store);
  const userState = authSync.getUser();
  assert.equal(typeof userState, 'object', 'User state must be an object');
  assert.equal(typeof userState.loggedIn, 'boolean', 'loggedIn must be boolean');
  assert.equal(typeof userState.sync, 'object', 'sync status must be an object');
});

test('AuthSync: Merge Algorithm merges favorites without duplicates', () => {
  const localLib = {
    favorites: [
      { id: 'track_1', title: 'Song 1', artist: 'Artist A' },
      { id: 'track_2', title: 'Song 2', artist: 'Artist B' }
    ]
  };
  const remoteRecord = {
    favorites: [
      { id: 'track_2', title: 'Song 2 (Remote)', artist: 'Artist B' },
      { id: 'track_3', title: 'Song 3', artist: 'Artist C' }
    ]
  };

  const merged = authSync.mergeLibraries(localLib, remoteRecord);
  assert.equal(merged.favorites.length, 3, 'Should have exactly 3 unique tracks');
  const ids = merged.favorites.map(t => t.id);
  assert.deepEqual(ids, ['track_1', 'track_2', 'track_3'], 'Must preserve track order and deduplicate');
});

test('AuthSync: Merge Algorithm merges playlists and unions tracks', () => {
  const localLib = {
    playlists: [
      { id: 'pl_1', name: 'Chill Vibes', tracks: [{ id: 't1', title: 'T1' }, { id: 't2', title: 'T2' }] },
      { id: 'pl_2', name: 'Local Only', tracks: [{ id: 't5', title: 'T5' }] }
    ]
  };
  const remoteRecord = {
    playlists: [
      { id: 'pl_1', name: 'Chill Vibes Updated', tracks: [{ id: 't2', title: 'T2' }, { id: 't3', title: 'T3' }] },
      { id: 'pl_3', name: 'Cloud Playlist', tracks: [{ id: 't4', title: 'T4' }] }
    ]
  };

  const merged = authSync.mergeLibraries(localLib, remoteRecord);
  assert.equal(merged.playlists.length, 3, 'Should contain all 3 playlists');

  const p1 = merged.playlists.find(p => p.id === 'pl_1');
  assert.ok(p1, 'Playlist pl_1 must exist');
  assert.equal(p1.tracks.length, 3, 'pl_1 tracks should be union of [t1, t2, t3]');
  assert.deepEqual(p1.tracks.map(t => t.id), ['t1', 't2', 't3']);

  const p2 = merged.playlists.find(p => p.id === 'pl_2');
  assert.ok(p2, 'Local playlist pl_2 must be preserved');

  const p3 = merged.playlists.find(p => p.id === 'pl_3');
  assert.ok(p3, 'Remote playlist pl_3 must be added');
});

test('AuthSync: Merge Algorithm reconciles play stats and settings', () => {
  const localLib = {
    settings: { volume: 0.7, eqPreset: 'Flat', automix: false },
    playStats: { totalPlays: 25, totalSeconds: 5000, tracks: { t1: { plays: 5 } } },
    lyricsOffsets: { t1: 200 }
  };
  const remoteRecord = {
    settings: { volume: 0.9, eqPreset: 'Bass Boost', automix: true },
    play_stats: { totalPlays: 40, totalSeconds: 8000, tracks: { t2: { plays: 10 } } },
    lyrics_offsets: { t2: -150 }
  };

  const merged = authSync.mergeLibraries(localLib, remoteRecord);

  // Settings: cloud theme/eq/automix takes preference, volume stays local
  assert.equal(merged.settings.volume, 0.7, 'Device volume should remain local');
  assert.equal(merged.settings.eqPreset, 'Bass Boost', 'EQ preset should sync from cloud');
  assert.equal(merged.settings.automix, true, 'Automix preference should sync');

  // Stats: maximum values preserved
  assert.equal(merged.playStats.totalPlays, 40);
  assert.equal(merged.playStats.totalSeconds, 8000);
  assert.ok(merged.playStats.tracks.t1 && merged.playStats.tracks.t2, 'Both track stats preserved');

  // Lyrics offsets
  assert.equal(merged.lyricsOffsets.t1, 200);
  assert.equal(merged.lyricsOffsets.t2, -150);
});

test('AuthSync: Demo / Offline Account Lifecycle (Sign Up, Sync, Sign Out)', async () => {
  // Set to demo mode for deterministic offline testing
  authSync.setConfig({ demoMode: true });

  const res = await authSync.signUp({
    email: 'cloud.user@mymusic.app',
    password: 'securepassword123',
    name: 'Cloud Tester'
  });

  assert.equal(res.ok, true, 'SignUp should succeed in demo mode');
  assert.equal(authSync.isLoggedIn(), true, 'User should be marked as logged in');

  const currentUser = authSync.getUser();
  assert.equal(currentUser.loggedIn, true);
  assert.equal(currentUser.user.email, 'cloud.user@mymusic.app');
  assert.equal(currentUser.user.name, 'Cloud Tester');

  // Sync test
  const syncRes = await authSync.syncNow();
  assert.equal(syncRes.ok, true, 'SyncNow should succeed');

  // Store mutation should not throw and should notify sync engine
  const initialFavCount = store.all().favorites.length;
  store.mutate({
    type: 'fav.toggle',
    track: { id: 'test_sync_track', title: 'Sync Song', artist: 'Sync Artist' }
  });
  assert.ok(store.all().favorites.some(t => t.id === 'test_sync_track'), 'Local store mutation must succeed');

  // Sign out
  const signOutRes = await authSync.signOut();
  assert.equal(signOutRes.ok, true);
  assert.equal(authSync.isLoggedIn(), false, 'Should be logged out');

  // Verify zero data loss in guest mode
  assert.ok(
    store.all().favorites.some(t => t.id === 'test_sync_track'),
    'Local library data MUST NOT be wiped on sign out'
  );

  // Clean up test track
  store.mutate({
    type: 'fav.toggle',
    track: { id: 'test_sync_track' }
  });
});

test('AuthSync: Full Account Management (Profile, Password, Force Sync, Deletion)', async () => {
  authSync.setConfig({ demoMode: true });

  await authSync.signUp({
    email: 'admin.manager@mymusic.app',
    password: 'initialpassword123',
    name: 'Initial Name'
  });

  assert.equal(authSync.isLoggedIn(), true);

  // 1. Update Profile Name
  const profRes = await authSync.updateProfile({ name: 'Updated Rockstar' });
  assert.equal(profRes.ok, true);
  assert.equal(authSync.getUser().user.name, 'Updated Rockstar');

  // 2. Update Password
  const passRes = await authSync.updatePassword({ newPassword: 'brandnewpassword456' });
  assert.equal(passRes.ok, true);

  // 3. Force Push & Force Pull
  const pushRes = await authSync.forcePush();
  assert.equal(pushRes.ok, true);

  const pullRes = await authSync.forcePull();
  assert.equal(pullRes.ok, true);

  // 4. Delete Cloud Data
  const clearRes = await authSync.deleteCloudData();
  assert.equal(clearRes.ok, true);

  // 5. Delete Account
  const delRes = await authSync.deleteAccount();
  assert.equal(delRes.ok, true);
  assert.equal(authSync.isLoggedIn(), false, 'Should be signed out after account deletion');
});
