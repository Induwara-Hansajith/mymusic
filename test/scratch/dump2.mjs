import { Innertube } from 'youtubei.js';

const yt = await Innertube.create();

const info = await yt.getInfo('J7p4bzqLvCw');
const sd = info.streaming_data;
const audio = [...(sd.formats || []), ...(sd.adaptive_formats || [])].filter(f => f.has_audio && !f.has_video).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
const f0 = audio[0];
console.log('top fmt itag', f0.itag, f0.mime_type);
try {
  const url = f0.decipher();
  console.log('decipher OK:', String(url).slice(0, 90));
  console.log('HEAD:', (await fetch(url, { method: 'HEAD' })).status);
} catch (e) {
  console.log('decipher FAILED:', e && e.message ? e.message : String(e));
  try {
    const u2 = f0.url || (typeof sd.url === 'function' ? sd.url() : null);
    console.log('fallback url?', u2 ? String(u2).slice(0, 90) : 'none');
    if (u2) console.log('HEAD:', (await fetch(u2, { method: 'HEAD' })).status);
  } catch (e2) { console.log('fallback FAILED:', e2.message); }
}

// built-in lyrics + home feed
try {
  const ly = await yt.music.getLyrics('J7p4bzqLvCw');
  console.log('== getLyrics keys:', Object.keys(ly || {}), '| text len:', (ly?.content || ly?.lyrics || '').length);
} catch (e) { console.log('getLyrics FAIL:', e.message); }

try {
  const h = await yt.music.getHomeFeed();
  const secs = h?.sections || h?.contents || [];
  console.log('== getHomeFeed shelves:', secs.length);
  if (secs[0]) console.log('shelf0:', JSON.stringify({ title: secs[0].title, n: secs[0].contents?.length, types: [...new Set((secs[0].contents || []).map(c => c.type))] }).slice(0, 400));
} catch (e) { console.log('getHomeFeed FAIL:', e.message); }
