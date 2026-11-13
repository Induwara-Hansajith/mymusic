const { contextBridge, ipcRenderer } = require('electron');

const CHANNELS = new Set([
  'ytm:search', 'ytm:suggestions', 'ytm:home', 'ytm:album', 'ytm:artist',
  'ytm:playlist', 'ytm:stream', 'ytm:lyrics', 'ytm:translate', 'ytm:radio',
  'library:get', 'library:mutate',
  'window:setMiniMode', 'presence:update',
  'download:start', 'download:list', 'download:reveal',
  'import:url', 'import:csv', 'import:match',
  'player:status'
]);

const EVENTS = new Set([
  'cmd:toggle', 'cmd:next', 'cmd:prev'
]);

contextBridge.exposeInMainWorld('api', {
  invoke: (channel, payload) => {
    if (!CHANNELS.has(channel)) return Promise.resolve({ ok: false, error: 'unknown channel' });
    return ipcRenderer.invoke(channel, payload);
  },
  on: (event, listener) => {
    if (!EVENTS.has(event)) return () => {};
    const wrapped = (_e, payload) => listener(payload);
    ipcRenderer.on(event, wrapped);
    return () => ipcRenderer.removeListener(event, wrapped);
  }
});
