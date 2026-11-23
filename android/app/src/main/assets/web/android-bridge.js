// Android Native Web Bridge for My Music
(function() {
  'use strict';

  const callbacks = new Map();
  const listeners = new Map();
  let reqCounter = 0;

  function loadLocalStore() {
    try {
      const saved = localStorage.getItem('mymusic_library_store');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('[bridge] failed to load local store:', e);
    }
    return {
      favorites: [],
      playlists: [],
      recent: [],
      settings: {
        volume: 0.8,
        repeat: 'off',
        shuffle: false,
        viz: 'liquid',
        radio: true,
        speed: 1.0,
        pitchLock: true,
        eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        eqPreset: 'Flat',
        wallpaper: null,
        wallpaperDim: 60,
        accentHue: 'auto',
        ambientColors: true,
        lyricsStyle: 'random',
        automix: false, lowResourceMode: false
      },
      lyricsOffsets: {},
      lastQueue: null,
      playStats: { totalPlays: 0, totalSeconds: 0, tracks: {}, artists: {} }
    };
  }

  function saveLocalStore(store) {
    try {
      localStorage.setItem('mymusic_library_store', JSON.stringify(store));
    } catch (e) {
      console.warn('[bridge] failed to save local store:', e);
    }
  }

  let localStore = loadLocalStore();

  window.api = {
    invoke: function(channel, payload) {
      payload = payload || {};

      if (channel === 'library:get') {
        return Promise.resolve({ ok: true, data: localStore });
      }

      if (channel === 'library:mutate') {
        mutateLocalStore(payload);
        saveLocalStore(localStore);
        if (window.AndroidNative && window.AndroidNative.postMessage) {
          window.AndroidNative.postMessage('store_sync', 'library:mutate', JSON.stringify(localStore));
        }
        return Promise.resolve({ ok: true, data: localStore });
      }

      if (channel === 'window:setMiniMode') {
        return Promise.resolve({ ok: true, data: false });
      }

      if (channel === 'presence:update') {
        return Promise.resolve({ ok: true, data: null });
      }

      if (channel === 'updates:check' || channel === 'updates:get-status') {
        return Promise.resolve({ ok: true, data: { updateAvailable: false, status: 'idle' } });
      }

      if (channel === 'updates:install' || channel === 'updates:defer') {
        return Promise.resolve({ ok: true, data: true });
      }

      return new Promise(function(resolve, reject) {
        const id = 'req_' + (++reqCounter) + '_' + Date.now();
        callbacks.set(id, { resolve, reject, channel });

        if (window.AndroidNative && window.AndroidNative.postMessage) {
          try {
            window.AndroidNative.postMessage(id, channel, JSON.stringify(payload));
          } catch (err) {
            callbacks.delete(id);
            reject(err);
          }
        } else {
          console.warn('[bridge] AndroidNative not available for channel:', channel);
          callbacks.delete(id);
          reject(new Error('AndroidNative not bound'));
        }
      });
    },

    on: function(event, listener) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(listener);
      return function() {
        const set = listeners.get(event);
        if (set) set.delete(listener);
      };
    }
  };

  window.__onAndroidResult = function(id, success, jsonResult) {
    const cb = callbacks.get(id);
    if (!cb) return;
    callbacks.delete(id);

    try {
      const parsed = typeof jsonResult === 'string' ? JSON.parse(jsonResult) : jsonResult;
      if (success) {
        cb.resolve(parsed);
      } else {
        cb.reject(new Error((parsed && parsed.error) || 'Native call failed'));
      }
    } catch (e) {
      if (success) cb.resolve(jsonResult);
      else cb.reject(e);
    }
  };

  window.__onAndroidEvent = function(event, jsonPayload) {
    const set = listeners.get(event);
    if (!set || set.size === 0) return;

    let data = null;
    try {
      data = typeof jsonPayload === 'string' ? JSON.parse(jsonPayload) : jsonPayload;
    } catch (e) {
      data = jsonPayload;
    }

    set.forEach(function(fn) {
      try { fn(data); } catch (err) { console.error('[bridge] listener error:', err); }
    });
  };

  function sameTrack(a, b) {
    if (!a || !b) return false;
    if (a.id && b.id && a.id === b.id) return true;
    if (a.localPath && b.localPath && a.localPath === b.localPath) return true;
    return false;
  }

  function mutateLocalStore(p) {
    const d = localStore;
    switch (p.type) {
      case 'fav.toggle': {
        const i = d.favorites.findIndex(t => sameTrack(t, p.track));
        if (i >= 0) d.favorites.splice(i, 1);
        else if (p.track) d.favorites.unshift(p.track);
        break;
      }
      case 'playlist.create': {
        const id = 'pl_' + Date.now();
        d.playlists.unshift({ id, name: (p.name || 'New Playlist').slice(0, 60), tracks: [], createdAt: Date.now() });
        break;
      }
      case 'playlist.delete': {
        d.playlists = d.playlists.filter(pl => pl.id !== p.id);
        break;
      }
      case 'playlist.rename': {
        const pl = d.playlists.find(x => x.id === p.id);
        if (pl) pl.name = (p.name || pl.name).slice(0, 60);
        break;
      }
      case 'playlist.add': {
        const pl = d.playlists.find(x => x.id === p.id);
        if (pl && p.track && !pl.tracks.some(t => sameTrack(t, p.track))) {
          pl.tracks.push(p.track);
        }
        break;
      }
      case 'playlist.remove': {
        const pl = d.playlists.find(x => x.id === p.id);
        if (pl) pl.tracks = pl.tracks.filter(t => !sameTrack(t, p.track));
        break;
      }
      case 'recent.add': {
        if (!p.track) break;
        d.recent = d.recent.filter(t => !sameTrack(t, p.track));
        d.recent.unshift(p.track);
        if (d.recent.length > 100) d.recent.length = 100;
        break;
      }
      case 'settings.set': {
        const patch = p.patch || {};
        Object.assign(d.settings, patch);
        break;
      }
      case 'lastQueue.save': {
        d.lastQueue = { tracks: p.tracks || [], index: p.index || 0, time: p.time || 0 };
        break;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    const backdrop = document.createElement('div');
    backdrop.id = 'sidebarBackdrop';
    document.body.appendChild(backdrop);

    function toggleMobileSidebar(open) {
      const sb = document.getElementById('sidebar');
      const bd = document.getElementById('sidebarBackdrop');
      if (!sb || !bd) return;
      const isOpen = open !== undefined ? open : !sb.classList.contains('mobile-open');
      if (isOpen) {
        sb.classList.add('mobile-open');
        bd.classList.add('mobile-open');
      } else {
        sb.classList.remove('mobile-open');
        bd.classList.remove('mobile-open');
      }
    }

    backdrop.addEventListener('click', function() {
      toggleMobileSidebar(false);
    });

    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.addEventListener('click', function(e) {
        if (e.target.closest('.navbtn') || e.target.closest('.plbtn')) {
          if (window.innerWidth <= 768) {
            toggleMobileSidebar(false);
          }
        }
      });
    }

    const navBtns = document.querySelector('.nav-btns');
    if (navBtns) {
      const menuBtn = document.createElement('button');
      menuBtn.id = 'btnMobileMenu';
      menuBtn.className = 'iconbtn';
      menuBtn.title = 'Menu';
      menuBtn.innerHTML = '<svg class="ic" viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="currentColor"/></svg>';
      menuBtn.style.marginRight = '4px';
      menuBtn.addEventListener('click', function() {
        toggleMobileSidebar();
      });
      navBtns.insertBefore(menuBtn, navBtns.firstChild);
    }

    const playerbar = document.getElementById('playerbar');
    if (playerbar) {
      playerbar.addEventListener('click', function(e) {
        if (window.innerWidth > 768) return;
        if (e.target.closest('button') || e.target.closest('input')) return;
        const np = document.getElementById('nowPlayingOverlay');
        if (np) {
          np.classList.remove('hidden');
          if (!document.getElementById('btnCloseNpMobile')) {
            const closeBtn = document.createElement('button');
            closeBtn.id = 'btnCloseNpMobile';
            closeBtn.className = 'mobile-close-np';
            closeBtn.innerHTML = '<svg class="ic" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" fill="currentColor"/></svg>';
            closeBtn.addEventListener('click', function() {
              np.classList.add('hidden');
            });
            np.appendChild(closeBtn);
          }
        }
      });
    }
  });

  console.log('[bridge] My Music Android bridge loaded');
})();

