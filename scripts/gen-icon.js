// Basit PNG simgesi üretici (bağımlılık yok) — tray.png oluşturur.
// zlib ve elle yazılmış CRC32 kullanır.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** size x size RGBA gradyan + yuvarlak köşe + "W" benzeri işaret */
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const r = size * 0.22; // köşe yarıçapı
  const set = (x, y, R, G, B, A = 255) => {
    const i = (y * size + x) * 4;
    px[i] = R; px[i + 1] = G; px[i + 2] = B; px[i + 3] = A;
  };
  // yuvarlak köşe maskesi
  const inside = (x, y) => {
    const cx = Math.min(Math.max(x, r), size - 1 - r);
    const cy = Math.min(Math.max(y, r), size - 1 - r);
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inside(x, y)) continue;
      // siyah-gri dikey gradyan
      const t = y / (size - 1);
      const base = Math.round(24 + t * 60);
      set(x, y, base, base, base + 4);
    }
  }
  // "W" işareti: 4 çapraz çizgi
  const stroke = Math.max(2, Math.round(size * 0.09));
  const margin = size * 0.24;
  const top = size * 0.28;
  const bottom = size * 0.74;
  const midX = size / 2;
  const seg = (x0, y0, x1, y1) => {
    const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) * 2;
    for (let s = 0; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps;
      const y = y0 + ((y1 - y0) * s) / steps;
      for (let dy = -stroke; dy <= stroke; dy++) {
        for (let dx = -stroke; dx <= stroke; dx++) {
          if (dx * dx + dy * dy > stroke * stroke) continue;
          const xi = Math.round(x + dx), yi = Math.round(y + dy);
          if (xi >= 0 && xi < size && yi >= 0 && yi < size && inside(xi, yi)) {
            set(xi, yi, 238, 238, 244);
          }
        }
      }
    }
  };
  const quarter = (size - margin * 2) / 3;
  seg(margin, top, margin + quarter, bottom);
  seg(margin + quarter, bottom, midX, top + (bottom - top) * 0.35);
  seg(midX, top + (bottom - top) * 0.35, size - margin - quarter, bottom);
  seg(size - margin - quarter, bottom, size - margin, top);
  return px;
}

function toPng(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit derinliği
  ihdr[9] = 6;  // RGBA
  // tarayıcı satırları: filter byte (0) + pikseller
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const outDir = path.join(__dirname, '..', 'renderer', 'assets');
fs.mkdirSync(outDir, { recursive: true });
const png64 = toPng(drawIcon(64), 64);
const png256 = toPng(drawIcon(256), 256);
fs.writeFileSync(path.join(outDir, 'tray.png'), png64);
fs.writeFileSync(path.join(outDir, 'icon.png'), png256);
fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.png'), (fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true }), png256));
console.log('OK:', path.join(outDir, 'tray.png'), png64.length, 'bytes');
console.log('OK:', path.join(outDir, 'icon.png'), png256.length, 'bytes (256x256)');
