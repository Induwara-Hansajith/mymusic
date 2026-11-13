import { Innertube } from 'youtubei.js';

const yt = await Innertube.create();
const T = (t) => !t ? '' : typeof t === 'string' ? t : t.text || (t.runs || []).map(r => r.text).join('');
const cut = (o, n = 700) => JSON.stringify(o)?.slice(0, n);

// album contents rows
const al = await yt.music.getAlbum('MPREb_YWjvGjCFaW6');
console.log('== album contents[0]:', cut(al.contents?.[0], 1000));
console.log('== album header:', cut(al.header, 400));

// playlist contents rows
const pl = await yt.music.getPlaylist('VLRDCLAK5uy_nCz51lvimQoR1Iedu0zDkh5HVJRVr2sYA');
console.log('== pl contents[0]:', cut(pl.contents?.[0], 1000));
console.log('== pl header:', cut(pl.header, 400));

// artist shelf header structure
const a0 = await yt.music.getArtist('UClYV6hHlupm_S_ObS1W-DYw');
const sec = (a0.sections || [])[2];
console.log('== artist shelf keys:', Object.keys(sec || {}));
console.log('== artist shelf header:', cut(sec?.header, 500));

// home shelf title fields
const h = await yt.music.getHomeFeed();
const s0 = (h.sections || [])[0];
console.log('== home shelf keys:', Object.keys(s0 || {}));
console.log('== home shelf title-ish:', cut({ header: s0?.header, title: s0?.title }, 400));
