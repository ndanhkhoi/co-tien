// Renders the app icon (an 8-ball on felt) to PNGs without dependencies.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, px) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const clamp = (v) => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function render(size, maskable) {
  const px = Buffer.alloc(size * size * 4);
  const ss = 3;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let acc = [0, 0, 0, 0];
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const u = (x + (sx + 0.5) / ss) / size, v = (y + (sy + 0.5) / ss) / size;
      // Rounded square felt (full bleed when maskable).
      const r = maskable ? 0 : 0.2;
      const qx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0), qy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0);
      const inside = Math.hypot(qx, qy) <= r || maskable;
      if (!inside) continue;
      const d = Math.hypot(u - 0.5, v - 0.42);
      let col = mix([31, 122, 74], [7, 34, 22], clamp(d * 1.5));
      const scale = maskable ? 0.3 : 0.36;
      const bx = (u - 0.5) / scale, by = (v - 0.5) / scale;
      const shadow = Math.hypot(bx - 0.1, (by - 0.95) * 3.2);
      if (shadow < 1) col = mix(col, [0, 0, 0], 0.45 * (1 - shadow));
      const rr = Math.hypot(bx, by);
      if (rr < 1) {
        const z = Math.sqrt(1 - rr * rr);
        const lit = clamp(0.25 + 0.75 * (-0.35 * bx - 0.5 * by + 0.8 * z));
        let base = [20, 20, 20];
        const cd = Math.hypot(bx + 0.05, by + 0.12);
        if (cd < 0.42) {
          base = [246, 243, 232];
          // "8": two stacked rings.
          const r1 = Math.hypot((bx + 0.05) / 0.9, by + 0.24), r2 = Math.hypot((bx + 0.05) / 0.9, by + 0.01);
          if (Math.abs(r1 - 0.105) < 0.04 || Math.abs(r2 - 0.125) < 0.045) base = [17, 17, 17];
        }
        col = base.map((c) => c * (0.35 + 0.8 * lit));
        const spec = Math.pow(clamp(-0.3 * bx - 0.45 * by + 0.84 * z), 60);
        col = mix(col, [255, 255, 255], clamp(spec * 0.9));
      }
      acc = [acc[0] + col[0], acc[1] + col[1], acc[2] + col[2], acc[3] + 255];
    }
    const n = ss * ss;
    const a = acc[3] / n;
    const i = (y * size + x) * 4;
    px[i] = a ? acc[0] / (acc[3] / 255) : 0; px[i + 1] = a ? acc[1] / (acc[3] / 255) : 0; px[i + 2] = a ? acc[2] / (acc[3] / 255) : 0; px[i + 3] = a;
  }
  return png(size, px);
}
const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const s of [32, 180, 192, 512]) writeFileSync(new URL(`icon-${s}.png`, out), render(s, false));
writeFileSync(new URL('icon-maskable-512.png', out), render(512, true));
writeFileSync(new URL('favicon.svg', out), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1f7a4a"/><circle cx="32" cy="32" r="22" fill="#151515"/><circle cx="31" cy="29" r="9.5" fill="#f6f3e8"/><text x="31" y="33.5" font-family="sans-serif" font-weight="800" font-size="13" text-anchor="middle" fill="#111">8</text><ellipse cx="24" cy="20" rx="6" ry="3.5" fill="#fff" opacity=".45" transform="rotate(-30 24 20)"/></svg>`);
console.log('icons written');
