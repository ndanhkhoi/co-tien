import { Texture } from 'pixi.js';
import type { TableGeom } from '../core/table';
import type { CueDef, TableSkin } from '../game/content/gear';

// Procedural art painted once into canvases, then uploaded as textures.

const hex = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

function mix(c1: number, c2: number, t: number): number {
  const r = ((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t;
  const g = ((c1 >> 8) & 255) * (1 - t) + ((c2 >> 8) & 255) * t;
  const b = (c1 & 255) * (1 - t) + (c2 & 255) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext('2d')!];
}

/** Seeded noise so the cloth and wood grain look identical every rebuild. */
function noiseRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface TableArt {
  texture: Texture;
  /** Pixel size of the texture in table metres. */
  pxPerM: number;
  /** Outer half extents (metres) including rails. */
  hx: number;
  hy: number;
}

const images = new Map<string, HTMLImageElement | 'loading' | 'missing'>();

/** Painted art for canvas drawing: returns the image once loaded, else starts loading and calls onReady later. */
export function artImage(url: string, onReady: () => void): HTMLImageElement | null {
  const got = images.get(url);
  if (got instanceof HTMLImageElement) return got;
  if (got === undefined) {
    images.set(url, 'loading');
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      images.set(url, img);
      onReady();
    };
    img.onerror = () => images.set(url, 'missing');
    img.src = url;
  }
  return null;
}

/**
 * Paints the whole table: wooden frame, cloth bed with lamp falloff, pocket holes,
 * cloth-covered cushions with a lit nose, diamonds and the foot spot.
 */
export function paintTable(t: TableGeom, skin: TableSkin, pxPerM: number, railImg: HTMLImageElement | null = null, details: Partial<Record<'corner' | 'side' | 'sight', HTMLImageElement | null>> = {}): TableArt {
  const rail = t.railWidth;
  const hx = t.L / 2 + rail;
  const hy = t.W / 2 + rail;
  const [c, g] = canvas(hx * 2 * pxPerM, hy * 2 * pxPerM);
  const X = (x: number) => (x + hx) * pxPerM;
  const Y = (y: number) => (y + hy) * pxPerM;
  const S = (m: number) => m * pxPerM;
  const rnd = noiseRng(7);

  // --- Wooden frame ---
  const corner = S(0.05);
  g.save();
  g.beginPath();
  g.roundRect(0, 0, c.width, c.height, corner);
  // Ink-washed wood: matte, a little lighter at the top like a brush wash.
  const wood = g.createLinearGradient(0, 0, 0, c.height);
  wood.addColorStop(0, hex(mix(skin.rail, 0xffffff, 0.06)));
  wood.addColorStop(0.5, hex(skin.rail));
  wood.addColorStop(1, hex(skin.railDark));
  g.fillStyle = wood;
  g.fill();
  g.clip();
  if (railImg) {
    // The sect's painted rail strip, tiled along each side (rotated for the short rails).
    const th = S(rail);
    const tw = th * (railImg.width / railImg.height);
    const strip = (len: number) => {
      for (let x = 0; x < len; x += tw) g.drawImage(railImg, x, 0, tw, th);
    };
    strip(c.width);
    g.save();
    g.translate(c.width, c.height);
    g.rotate(Math.PI);
    strip(c.width);
    g.restore();
    g.save();
    g.translate(0, c.height);
    g.rotate(-Math.PI / 2);
    strip(c.height);
    g.restore();
    g.save();
    g.translate(c.width, 0);
    g.rotate(Math.PI / 2);
    strip(c.height);
    g.restore();
  }
  // Grain streaks (only on the plain wood frame).
  for (let i = 0; i < (railImg ? 0 : 260); i++) {
    const y = rnd() * c.height;
    const x = rnd() * c.width;
    const len = S(0.2 + rnd() * 0.9);
    g.strokeStyle = hex(rnd() < 0.5 ? skin.railDark : mix(skin.rail, 0xffffff, 0.25), 0.08 + rnd() * 0.1);
    g.lineWidth = Math.max(1, S(0.002 + rnd() * 0.004));
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + len * 0.3, y + S(0.006) * (rnd() - 0.5), x + len * 0.6, y - S(0.006) * (rnd() - 0.5), x + len, y);
    g.stroke();
  }
  // Polished top highlight and inner bevel.
  const sheen = g.createLinearGradient(0, 0, 0, S(rail));
  sheen.addColorStop(0, 'rgba(255,255,255,0.05)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, c.width, S(rail));
  g.restore();
  g.lineWidth = Math.max(1, S(0.004));
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.beginPath();
  g.roundRect(g.lineWidth / 2, g.lineWidth / 2, c.width - g.lineWidth, c.height - g.lineWidth, corner);
  g.stroke();

  // --- Cloth bed (extends under the cushions) ---
  const cushionDepth = 0.05;
  const bx0 = X(-t.L / 2 - cushionDepth);
  const by0 = Y(-t.W / 2 - cushionDepth);
  const bw = S(t.L + 2 * cushionDepth);
  const bh = S(t.W + 2 * cushionDepth);
  g.fillStyle = hex(skin.cloth);
  g.fillRect(bx0, by0, bw, bh);
  // Felt fibres.
  const img = g.getImageData(bx0, by0, bw, bh);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 14;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, bx0, by0);
  // Lamp falloff: bright centre, darker edges.
  const lamp = g.createRadialGradient(X(0), Y(0), S(0.1), X(0), Y(0), S(t.L * 0.62));
  lamp.addColorStop(0, 'rgba(0,0,0,0)');
  lamp.addColorStop(0.65, 'rgba(0,0,0,0)');
  lamp.addColorStop(1, hex(skin.clothDark, 0.35));
  g.fillStyle = lamp;
  g.fillRect(bx0, by0, bw, bh);

  // Pool tables mark only the foot spot.
  if (t.kind === 'pool') {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.arc(X(t.footSpot.x), Y(t.footSpot.y), Math.max(1.5, S(0.006)), 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = 'rgba(255,255,255,0.4)';
    for (const sp of [t.headSpot, t.centerSpot, t.footSpot]) {
      g.beginPath();
      g.arc(X(sp.x), Y(sp.y), Math.max(1.5, S(0.005)), 0, Math.PI * 2);
      g.fill();
    }
  }

  // --- Pocket holes ---
  for (const p of t.pockets) {
    if (details[p.kind]) continue;
    const hole = g.createRadialGradient(X(p.hx), Y(p.hy), S(p.hr * 0.1), X(p.hx), Y(p.hy), S(p.hr));
    // Ink pooled in the hole, feathering out at the rim.
    hole.addColorStop(0, '#0b0a09');
    hole.addColorStop(0.8, '#14110f');
    hole.addColorStop(1, 'rgba(20,17,15,0.85)');
    g.fillStyle = hole;
    g.beginPath();
    g.arc(X(p.hx), Y(p.hy), S(p.hr), 0, Math.PI * 2);
    g.fill();
  }

  // --- Cushions ---
  const cushionCol = mix(skin.cloth, 0x000000, 0.12);
  if (t.kind === 'pool') {
    // Every three consecutive segments are [nose, jawP, jawQ].
    for (let i = 0; i < t.segments.length; i += 3) {
      const nose = t.segments[i];
      const jp = t.segments[i + 1];
      const jq = t.segments[i + 2];
      g.fillStyle = hex(cushionCol);
      g.beginPath();
      g.moveTo(X(jp.bx), Y(jp.by));
      g.lineTo(X(nose.ax), Y(nose.ay));
      g.lineTo(X(nose.bx), Y(nose.by));
      g.lineTo(X(jq.bx), Y(jq.by));
      g.closePath();
      g.fill();
      // Lit nose line.
      g.strokeStyle = hex(mix(skin.cloth, 0xffffff, 0.18), 0.55);
      g.lineWidth = Math.max(1, S(0.004));
      g.beginPath();
      g.moveTo(X(jp.bx), Y(jp.by));
      g.lineTo(X(nose.ax), Y(nose.ay));
      g.lineTo(X(nose.bx), Y(nose.by));
      g.lineTo(X(jq.bx), Y(jq.by));
      g.stroke();
    }
  } else {
    g.fillStyle = hex(cushionCol);
    g.fillRect(bx0, by0, bw, S(cushionDepth));
    g.fillRect(bx0, Y(t.W / 2), bw, S(cushionDepth));
    g.fillRect(bx0, by0, S(cushionDepth), bh);
    g.fillRect(X(t.L / 2), by0, S(cushionDepth), bh);
    g.strokeStyle = hex(mix(skin.cloth, 0xffffff, 0.22), 0.9);
    g.lineWidth = Math.max(1, S(0.004));
    g.strokeRect(X(-t.L / 2), Y(-t.W / 2), S(t.L), S(t.W));
  }
  // Soft shadow the cushion casts on the bed.
  const sh = Math.max(2, S(0.02));
  const edges: [number, number, number, number, number, number, number, number][] = [
    [X(-t.L / 2), Y(-t.W / 2), S(t.L), sh, 0, Y(-t.W / 2), 0, Y(-t.W / 2) + sh],
    [X(-t.L / 2), Y(t.W / 2) - sh, S(t.L), sh, 0, Y(t.W / 2), 0, Y(t.W / 2) - sh],
    [X(-t.L / 2), Y(-t.W / 2), sh, S(t.W), X(-t.L / 2), 0, X(-t.L / 2) + sh, 0],
    [X(t.L / 2) - sh, Y(-t.W / 2), sh, S(t.W), X(t.L / 2), 0, X(t.L / 2) - sh, 0],
  ];
  for (const [x, y, w, h, x0, y0, x1, y1] of edges) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, 'rgba(0,0,0,0.28)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
  }

  // --- Pocket liners (leather rims on the wood) ---
  for (const p of t.pockets) {
    const image = details[p.kind];
    if (image) {
      g.save();
      g.translate(X(p.hx), Y(p.hy));
      // Assets face down into the bed at the top rail; corner orientation follows the diagonal.
      g.rotate(p.kind === 'corner' ? Math.atan2(-Math.sign(p.hy), -Math.sign(p.hx)) - Math.PI / 2 : p.hy < 0 ? 0 : Math.PI);
      g.drawImage(image, -S(p.hr), -S(p.hr), S(p.hr * 2), S(p.hr * 2));
      g.restore();
      continue;
    }
    g.strokeStyle = 'rgba(20,14,10,0.9)';
    g.lineWidth = Math.max(2, S(0.012));
    g.beginPath();
    g.arc(X(p.hx), Y(p.hy), S(p.hr + 0.004), 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = Math.max(1, S(0.003));
    g.beginPath();
    g.arc(X(p.hx), Y(p.hy), S(p.hr + 0.011), Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
  }

  // --- Diamonds: vermilion seal dots, like the red marks on an ink painting ---
  for (const dm of t.diamonds) {
    if (details.sight) {
      const size = S(t.kind === 'pool' ? 0.017 : 0.011);
      g.save();
      g.translate(X(dm.x), Y(dm.y));
      if (Math.abs(dm.x) > t.L / 2) g.rotate(Math.PI / 2);
      g.drawImage(details.sight, -size / 2, -size / 2, size, size);
      g.restore();
      continue;
    }
    g.fillStyle = '#b23a26';
    g.beginPath();
    g.arc(X(dm.x), Y(dm.y), Math.max(1.6, S(0.0055)), 0, Math.PI * 2);
    g.fill();
  }

  return { texture: Texture.from(c), pxPerM, hx, hy };
}

/** Black digits 1–15 on a 4×4 atlas, centred in each cell (6 and 9 underlined). */
export function paintNumberAtlas(): Texture {
  const cell = 128;
  const [c, g] = canvas(cell * 4, cell * 4);
  g.fillStyle = '#000';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let n = 1; n <= 15; n++) {
    const cx = ((n - 1) % 4) * cell + cell / 2;
    const cy = Math.floor((n - 1) / 4) * cell + cell / 2;
    g.font = `600 ${n >= 10 ? 70 : 82}px "Be Vietnam Pro", system-ui, sans-serif`;
    g.fillText(String(n), cx, cy + 4);
    if (n === 6 || n === 9) g.fillRect(cx - 18, cy + 38, 36, 7);
  }
  return Texture.from(c);
}

/** Soft round shadow. */
export function paintShadow(): Texture {
  const s = 128;
  const [c, g] = canvas(s, s);
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(0,0,0,0.65)');
  gr.addColorStop(0.55, 'rgba(0,0,0,0.35)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
  return Texture.from(c);
}

/** Soft glowing dot for particles and highlights. */
export function paintGlow(): Texture {
  const s = 64;
  const [c, g] = canvas(s, s);
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
  return Texture.from(c);
}

/**
 * Cue stick drawn horizontally with the tip at x = 0 (pointing left), 1.47 m (58 in) long.
 * Returns texture plus the pixel scale so the view can size it in metres.
 */
export function paintCue(cue: CueDef, pxPerM: number, img: HTMLImageElement | null = null): { texture: Texture; length: number; thick: number } {
  const L = 1.47;
  const tipR = 0.0065;
  const buttR = 0.0145;
  const w = L * pxPerM;
  const h = buttR * 2 * pxPerM + 4;
  const [c, g] = canvas(w, h);
  const cy = h / 2;
  const rAt = (u: number) => (tipR + (buttR - tipR) * Math.pow(u, 0.8)) * pxPerM;
  if (img) {
    // Painted sect cue: tip on the left like the procedural one, squeezed to the real taper.
    g.save();
    g.beginPath();
    g.moveTo(0, cy - rAt(0));
    g.lineTo(w, cy - rAt(1));
    g.lineTo(w, cy + rAt(1));
    g.lineTo(0, cy + rAt(0));
    g.closePath();
    g.clip();
    g.drawImage(img, 0, cy - rAt(1), w, rAt(1) * 2);
    g.restore();
    return { texture: Texture.from(c), length: L, thick: buttR * 2 + 4 / pxPerM };
  }
  const col = cue.colors;
  const band = (u0: number, u1: number, fill: string | CanvasGradient) => {
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(u0 * w, cy - rAt(u0));
    g.lineTo(u1 * w, cy - rAt(u1));
    g.lineTo(u1 * w, cy + rAt(u1));
    g.lineTo(u0 * w, cy + rAt(u0));
    g.closePath();
    g.fill();
  };
  const shade = (base: number) => {
    const gr = g.createLinearGradient(0, cy - buttR * pxPerM, 0, cy + buttR * pxPerM);
    gr.addColorStop(0, hex(mix(base, 0xffffff, 0.35)));
    gr.addColorStop(0.35, hex(base));
    gr.addColorStop(1, hex(mix(base, 0x000000, 0.45)));
    return gr;
  };
  band(0, 0.008, '#3d6fa8'); // chalked tip
  band(0.008, 0.028, shade(col.ferrule));
  band(0.028, 0.5, shade(col.shaft));
  band(0.5, 0.515, shade(col.accent)); // joint collar
  band(0.515, 0.66, shade(mix(col.butt, col.shaft, 0.35)));
  // Inlay points on the forearm.
  g.fillStyle = hex(col.butt);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(0.53 * w, cy);
    g.lineTo(0.66 * w, cy + s * rAt(0.66) * 0.95);
    g.lineTo(0.66 * w, cy + s * rAt(0.66) * 0.2);
    g.closePath();
    g.fill();
  }
  band(0.66, 0.67, shade(col.accent));
  band(0.67, 0.86, shade(col.wrap));
  // Wrap texture.
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 1;
  for (let x = 0.67 * w; x < 0.86 * w; x += 3) {
    g.beginPath();
    g.moveTo(x, cy - rAt(0.76));
    g.lineTo(x + 2, cy + rAt(0.76));
    g.stroke();
  }
  band(0.86, 0.87, shade(col.accent));
  band(0.87, 0.985, shade(col.butt));
  band(0.985, 1, '#111');
  return { texture: Texture.from(c), length: L, thick: buttR * 2 + 4 / pxPerM };
}
