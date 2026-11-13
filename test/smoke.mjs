import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ytm = require('../src/lib/ytm.js');

const c = (n, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'} [${n}] ${extra}`);

try {
  const all = await ytm.search('blinding lights');
  c('search all', all.songs.length > 0, `songs=${all.songs.length} videos=${all.videos.length} albums=${all.albums.length} artists=${all.artists.length} playlists=${all.playlists.length}`);

  const songs = await ytm.search('blinding lights', 'songs');
  c('search songs filter', songs.songs.length > 0, `${songs.songs.length} songs; first: ${songs.songs[0]?.title} — ${songs.songs[0]?.artist}`);
  const s0 = songs.songs[0];

  const albums = await ytm.search('after hours', 'albums');
  c('search albums filter', albums.albums.length > 0, `${albums.albums.length} albums; first: ${albums.albums[0]?.title}`);

  const al = await ytm.search('after hours', 'albums').then(r => r.albums[0]).then(a => ytm.album(a.id));
  c('album', al.tracks.length > 0, `"${al.title}" — ${al.artist} — ${al.tracks.length} tracks; t0: ${al.tracks[0]?.title} [${al.tracks[0]?.id}]`);

  const ar = await ytm.artist('UClYV6hHlupm_S_ObS1W-DYw');
  c('artist', ar.songs.length > 0 || ar.albums.length > 0, `"${ar.name}" songs=${ar.songs.length} albums=${ar.albums.length} singles=${ar.singles.length} videos=${ar.videos.length}`);

  const pl = await ytm.playlist('VLRDCLAK5uy_nCz51lvimQoR1Iedu0zDkh5HVJRVr2sYA');
  c('playlist', pl.tracks.length > 0, `"${pl.title}" — ${pl.tracks.length} tracks`);

  const st = await ytm.stream(s0.id);
  const head = await fetch(st.urls[0], { method: 'HEAD' });
  c('stream', head.status === 200, `${st.urls.length} urls; HEAD=${head.status}; bitrate-url ok`);

  const sugg = await ytm.suggestions('blinding');
  c('suggestions', sugg.length > 0, sugg.slice(0, 3).join(' | '));

  const ly = await ytm.lyrics({ id: s0.id, title: s0.title, artist: s0.artist });
  c('lyrics', !!(ly.synced || ly.plain), ly.synced ? `synced ${ly.synced.length} lines` : ly.plain ? `plain ${ly.plain.length} chars` : 'none');

  console.log('SMOKE PASS');
  process.exit(0);
} catch (e) {
  console.error('SMOKE FAIL:', e && e.message ? e.message : e);
  process.exit(1);
}
