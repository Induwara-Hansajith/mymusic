import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'build', 'thumbar');
fs.mkdirSync(outDir, { recursive: true });

function createPng(width, height, drawFn) {
  // RGBA buffer with filter byte per scanline
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(height * stride, 0);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * stride;
    raw[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      raw[pixelOffset] = r;
      raw[pixelOffset + 1] = g;
      raw[pixelOffset + 2] = b;
      raw[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(raw);

  function crc32(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
  }
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
    table[i] = c;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const W = 24;
const H = 24;
const white = [255, 255, 255, 255];
const trans = [0, 0, 0, 0];

// Play triangle: x from 7 to 18, centered vertically
const playPng = createPng(W, H, (x, y) => {
  if (x >= 7 && x <= 18) {
    const halfH = Math.round((x - 7) * 0.85);
    if (Math.abs(y - 12) <= halfH) return white;
  }
  return trans;
});
fs.writeFileSync(path.join(outDir, 'play.png'), playPng);

// Pause bars: two rects
const pausePng = createPng(W, H, (x, y) => {
  if (y >= 6 && y <= 18) {
    if ((x >= 7 && x <= 10) || (x >= 14 && x <= 17)) return white;
  }
  return trans;
});
fs.writeFileSync(path.join(outDir, 'pause.png'), pausePng);

// Next: triangle + bar
const nextPng = createPng(W, H, (x, y) => {
  if (y >= 6 && y <= 18) {
    if (x >= 17 && x <= 19) return white;
  }
  if (x >= 6 && x <= 15) {
    const halfH = Math.round((x - 6) * 0.7);
    if (Math.abs(y - 12) <= halfH) return white;
  }
  return trans;
});
fs.writeFileSync(path.join(outDir, 'next.png'), nextPng);

// Prev: bar + triangle
const prevPng = createPng(W, H, (x, y) => {
  if (y >= 6 && y <= 18) {
    if (x >= 5 && x <= 7) return white;
  }
  if (x >= 9 && x <= 18) {
    const halfH = Math.round((18 - x) * 0.7);
    if (Math.abs(y - 12) <= halfH) return white;
  }
  return trans;
});
fs.writeFileSync(path.join(outDir, 'prev.png'), prevPng);

console.log('Thumbar icons generated successfully in', outDir);
