import test from 'node:test';
import assert from 'node:assert/strict';
import ytm from '../src/lib/ytm.js';

test('Thumbnail Quality: Google user content thumbnail URLs upgrade to high resolution', () => {
  const url60 = 'https://yt3.googleusercontent.com/R_cjQK3wwLPEzri1jerx-79zgzGocoKvwGU3NMONaTsaMM0Idd641pfB8r5jgfpn6I8JAoFtf9RBIcI=w60-h60-l90-rj';
  const url120 = 'https://lh3.googleusercontent.com/some_album_hash=w120-h120-l90-rj';
  const urlAvatar = 'https://yt3.ggpht.com/a/default-user=s60-c-k-c0x00ffffff-no-rj';

  function upgradeThumbUrl(url, highRes = true) {
    if (!url || typeof url !== 'string') return '';
    if (/googleusercontent\.com|ggpht\.com/i.test(url)) {
      if (/=w\d+-h\d+/i.test(url)) {
        return url.replace(/=w\d+-h\d+[^?]*/i, highRes ? '=w1024-h1024-l90-rj' : '=w544-h544-l90-rj');
      }
      if (/=s\d+/i.test(url)) {
        return url.replace(/=s\d+[^?]*/i, highRes ? '=s1024-l90-rj' : '=s544-l90-rj');
      }
      return url;
    }
    if (/ytimg\.com|youtube\.com\/vi/i.test(url)) {
      const clean = url.split('?')[0];
      if (clean.includes('/default.jpg') || clean.includes('/mqdefault.jpg')) {
        return clean.replace(/\/(?:default|mqdefault)\.jpg$/i, '/hqdefault.jpg');
      }
      return clean;
    }
    return url;
  }

  const up60 = upgradeThumbUrl(url60);
  assert.equal(up60.includes('=w1024-h1024-l90-rj'), true, 'Should upgrade =w60-h60 to =w1024-h1024');
  assert.equal(up60.includes('=w60-h60'), false);

  const up120 = upgradeThumbUrl(url120);
  assert.equal(up120.includes('=w1024-h1024-l90-rj'), true, 'Should upgrade =w120-h120 to =w1024-h1024');

  const upAvatar = upgradeThumbUrl(urlAvatar);
  assert.equal(upAvatar.includes('=s1024-l90-rj'), true, 'Should upgrade =s60 to =s1024');
});

test('Thumbnail Quality: YouTube video thumbnails strip downscale tokens and upgrade low-res defaults', () => {
  const videoThumbWithSqp = 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg?sqp=-oaymwEWCJADEOEBIAQqCggAEOADGC0guwJIWg&rs=AMzJL3kbhOvz5GOWNb6cfx3BbfF3mAKwmw';
  const mqDefault = 'https://i.ytimg.com/vi/4NRXx6U8ABQ/mqdefault.jpg';

  function upgradeThumbUrl(url, highRes = true) {
    if (!url || typeof url !== 'string') return '';
    if (/googleusercontent\.com|ggpht\.com/i.test(url)) {
      if (/=w\d+-h\d+/i.test(url)) {
        return url.replace(/=w\d+-h\d+[^?]*/i, highRes ? '=w1024-h1024-l90-rj' : '=w544-h544-l90-rj');
      }
      if (/=s\d+/i.test(url)) {
        return url.replace(/=s\d+[^?]*/i, highRes ? '=s1024-l90-rj' : '=s544-l90-rj');
      }
      return url;
    }
    if (/ytimg\.com|youtube\.com\/vi/i.test(url)) {
      const clean = url.split('?')[0];
      if (clean.includes('/default.jpg') || clean.includes('/mqdefault.jpg')) {
        return clean.replace(/\/(?:default|mqdefault)\.jpg$/i, '/hqdefault.jpg');
      }
      return clean;
    }
    return url;
  }

  const cleanHq = upgradeThumbUrl(videoThumbWithSqp);
  assert.equal(cleanHq, 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg', 'Should strip sqp downscale compression tokens');
  assert.equal(cleanHq.includes('?sqp='), false);

  const upgradedMq = upgradeThumbUrl(mqDefault);
  assert.equal(upgradedMq, 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg', 'Should upgrade mqdefault to hqdefault');
});

test('Thumbnail Quality: Fullscreen view selects maximum 1200x1200 or maxresdefault artwork', () => {
  function getFullscreenThumbUrl(url) {
    if (!url || typeof url !== 'string') return '';
    if (/googleusercontent\.com|ggpht\.com/i.test(url)) {
      if (/=w\d+-h\d+/i.test(url)) return url.replace(/=w\d+-h\d+[^?]*/i, '=w1200-h1200-l90-rj');
      if (/=s\d+/i.test(url)) return url.replace(/=s\d+[^?]*/i, '=s1200-l90-rj');
    }
    if (/ytimg\.com|youtube\.com\/vi/i.test(url)) {
      const clean = url.split('?')[0];
      const match = clean.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
      if (match && match[1]) {
        return `https://i.ytimg.com/vi/${match[1]}/maxresdefault.jpg`;
      }
    }
    return url;
  }

  const gUrl = 'https://yt3.googleusercontent.com/some_album_hash=w60-h60-l90-rj';
  const fsG = getFullscreenThumbUrl(gUrl);
  assert.equal(fsG.includes('=w1200-h1200-l90-rj'), true, 'Fullscreen Google artwork should be 1200x1200');

  const ytUrl = 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg?sqp=123';
  const fsYt = getFullscreenThumbUrl(ytUrl);
  assert.equal(fsYt, 'https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg', 'Fullscreen video artwork should target maxresdefault.jpg');
});

test('Thumbnail Quality: ytm.search results carry high-resolution artwork automatically', async () => {
  const r = await ytm.search('blinding lights');
  assert.ok(r.songs && r.songs.length > 0);
  const song = r.songs.find(s => s.type === 'song');
  if (song && song.thumb) {
    if (song.thumb.includes('googleusercontent.com')) {
      assert.ok(song.thumb.includes('=w1024-h1024') || song.thumb.includes('=s1024'), 'Song thumbnail should be 1024x1024');
      assert.equal(song.thumb.includes('=w60-h60'), false, 'Should not contain 60x60 thumbnail');
    }
  }

  const video = r.songs.find(s => s.type === 'video');
  if (video && video.thumb && video.thumb.includes('ytimg.com')) {
    assert.equal(video.thumb.includes('?sqp='), false, 'Video thumbnail should not contain sqp downscale query');
  }
});
