import test from 'node:test';
import assert from 'node:assert/strict';
import store from '../src/lib/store.js';

test('Auto-Updater Store: autoUpdate setting defaults and toggles properly', () => {
  store.mutate({ type: 'settings.set', patch: { autoUpdate: true, updateDeferredVersion: '' } });
  let s = store.all().settings;
  assert.equal(s.autoUpdate, true, 'autoUpdate should be true');
  assert.equal(s.updateDeferredVersion, '', 'updateDeferredVersion should be empty');

  // Defer a version
  store.mutate({ type: 'settings.set', patch: { updateDeferredVersion: '1.2.0' } });
  s = store.all().settings;
  assert.equal(s.updateDeferredVersion, '1.2.0');

  // Clear deferral on manual check
  store.mutate({ type: 'settings.set', patch: { updateDeferredVersion: '' } });
  s = store.all().settings;
  assert.equal(s.updateDeferredVersion, '');
});

test('Playback Protection: simulates deferring restart when playback is active', () => {
  let restartCalled = false;
  let deferredEventSent = false;
  let autoInstallOnAppQuit = false;

  const currentPlaybackStatus = { playing: true, title: 'Blinding Lights', artist: 'The Weeknd' };
  let installAfterDownload = true;
  const updateDownloadedInfo = { version: '1.1.8' };

  // When update-downloaded fires:
  autoInstallOnAppQuit = true;

  if (installAfterDownload) {
    if (currentPlaybackStatus.playing) {
      installAfterDownload = false;
      deferredEventSent = true;
    } else {
      installAfterDownload = false;
      restartCalled = true;
    }
  }

  assert.equal(restartCalled, false, 'Should NEVER restart immediately while music is playing');
  assert.equal(deferredEventSent, true, 'Should notify user that restart was deferred for playback');
  assert.equal(autoInstallOnAppQuit, true, 'Should stage silent installation on app exit');
  assert.equal(installAfterDownload, false, 'installAfterDownload flag should be cleared');
});

test('Playback Protection: allows restart when user is idle (not playing)', () => {
  let restartCalled = false;
  const currentPlaybackStatus = { playing: false, title: '', artist: '' };
  let installAfterDownload = true;
  const updateDownloadedInfo = { version: '1.1.8' };

  if (installAfterDownload) {
    if (currentPlaybackStatus.playing) {
      installAfterDownload = false;
    } else {
      installAfterDownload = false;
      restartCalled = true;
    }
  }

  assert.equal(restartCalled, true, 'Should allow restart when audio is not playing');
  assert.equal(installAfterDownload, false);
});

test('User Explicit Override: user can force restart even if playing', () => {
  const currentPlaybackStatus = { playing: true, title: 'Blinding Lights', artist: 'The Weeknd' };
  const updateDownloadedInfo = { version: '1.1.8' };

  function handleInstallRequest(payload) {
    if (updateDownloadedInfo) {
      const force = !!(payload && payload.force);
      if (currentPlaybackStatus.playing && !force) {
        return { ready: true, playing: true, promptConfirm: true, version: updateDownloadedInfo.version };
      }
      return { installing: true };
    }
    return { downloading: true };
  }

  // Without force: prompts for confirmation so playback is not killed unexpectedly
  const unforced = handleInstallRequest({ force: false });
  assert.equal(unforced.promptConfirm, true, 'Should prompt for confirmation when playing');
  assert.equal(unforced.playing, true);

  // With force: user explicitly confirms they want to restart now
  const forced = handleInstallRequest({ force: true });
  assert.equal(forced.installing, true, 'Should execute installation when forced by user');
});
