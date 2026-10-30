import { Texture } from 'pixi.js';
import type { CueDef } from '../game/content/gear';
import { makePaintContext, mixColour, paintBed, paintFrame, paintPlaySurface, rgba, type PaintTableArgs } from './art-paint';

// Procedural art painted once into canvases, then uploaded as textures.

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext('2d')!];
}

/** Seeded noise so the felt tile is identical every rebuild. */
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

let feltTile: HTMLCanvasElement | null = null;

/** A 256 px tile of light and dark specks (±7 levels per channel, like the old per-pixel pass). */
export function feltNoise(): HTMLCanvasElement {
  if (feltTile) return feltTile;
  const [c, g] = canvas(256, 256);
  const img = g.createImageData(256, 256);
  const rnd = noiseRng(11);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = rnd() - 0.5;
    const v = n > 0 ? 255 : 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.round(Math.abs(n) * 14 * 2);
  }
  g.putImageData(img, 0, 0);
  feltTile = c;
  return c;
}

/** Paints the whole table from the focused canvas steps. */
export function paintTable(base: Omit<PaintTableArgs, 'railImg' | 'details'>, railImg: HTMLImageElement | null = null): TableArt {
  const { t, pxPerM } = base;
  const hx = t.L / 2 + t.railWidth;
  const hy = t.W / 2 + t.railWidth;
  const [c, g] = canvas(hx * 2 * pxPerM, hy * 2 * pxPerM);
  const p = makePaintContext(t, t.railWidth, pxPerM);
  const args = { ...base, railImg, details: {} as PaintTableArgs['details'] };
  paintFrame(p, args, { c, g });
  paintBed(g, p, args);
  paintPlaySurface(g, p, args);
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
const bodies = new WeakMap<HTMLImageElement, { thick: number; mid: number }>();

/** Thickness and centre line of a painted cue's plain front shaft, in image pixels. */
function cueBody(img: HTMLImageElement): { thick: number; mid: number } {
  const hit = bodies.get(img);
  if (hit) return hit;
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const [c, g] = canvas(W, H);
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, W, H).data;
  const runs = shaftRuns(data, W, H);
  void c;
  runs.sort((a, b) => a.thick - b.thick);
  const body = runs.length ? runs[Math.floor(runs.length / 2)] : { thick: H, mid: H / 2 };
  bodies.set(img, body);
  return body;
}

function shaftRuns(data: Uint8ClampedArray, W: number, H: number): { thick: number; mid: number }[] {
  const runs: { thick: number; mid: number }[] = [];
  for (let u = 0.16; u <= 0.4; u += 0.02) {
    const x = Math.round(u * (W - 1));
    const best = longestOpaqueRun(data, W, H, x);
    if (best.len > 2) runs.push({ thick: best.len, mid: best.start + best.len / 2 });
  }
  return runs;
}

/** The longest opaque run in this column is the shaft; ornaments are shorter, detached runs. */
function longestOpaqueRun(data: Uint8ClampedArray, W: number, H: number, x: number): { len: number; start: number } {
  let best = { len: 0, start: 0 };
  let start = -1;
  for (let y = 0; y <= H; y++) {
    const solid = y < H && data[(y * W + x) * 4 + 3] > 140;
    if (solid && start < 0) start = y;
    if (!solid && start >= 0) {
      if (y - start > best.len) best = { len: y - start, start };
      start = -1;
    }
  }
  return best;
}

interface TaperBand {
  x0: number;
  x1: number;
  r0: number;
  r1: number;
}

function taperPath(g: CanvasRenderingContext2D, b: TaperBand, cy: number): void {
  g.beginPath();
  g.moveTo(b.x0, cy - b.r0);
  g.lineTo(b.x1, cy - b.r1);
  g.lineTo(b.x1, cy + b.r1);
  g.lineTo(b.x0, cy + b.r0);
  g.closePath();
}

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
    // Scale by the plain front shaft, not the whole picture: ornate butts, tassels and drips on
    // some cues would otherwise shrink the shaft to a thread. A wider butt is trimmed by the taper.
    const body = cueBody(img);
    const k = (rAt(0.28) * 2) / body.thick;
    g.save();
    taperPath(g, { x0: 0, x1: w, r0: rAt(0), r1: rAt(1) }, cy);
    g.clip();
    g.drawImage(img, 0, cy - body.mid * k, w, img.naturalHeight * k);
    g.restore();
    return { texture: Texture.from(c), length: L, thick: buttR * 2 + 4 / pxPerM };
  }
  const col = cue.colors;
  const band = (u0: number, u1: number, fill: string | CanvasGradient) => {
    g.fillStyle = fill;
    taperPath(g, { x0: u0 * w, x1: u1 * w, r0: rAt(u0), r1: rAt(u1) }, cy);
    g.fill();
  };
  const shade = (base: number) => {
    const gr = g.createLinearGradient(0, cy - buttR * pxPerM, 0, cy + buttR * pxPerM);
    gr.addColorStop(0, rgba(mixColour(base, 0xffffff, 0.35)));
    gr.addColorStop(0.35, rgba(base));
    gr.addColorStop(1, rgba(mixColour(base, 0x000000, 0.45)));
    return gr;
  };
  band(0, 0.008, '#3d6fa8'); // chalked tip
  band(0.008, 0.028, shade(col.ferrule));
  band(0.028, 0.5, shade(col.shaft));
  band(0.5, 0.515, shade(col.accent)); // joint collar
  band(0.515, 0.66, shade(mixColour(col.butt, col.shaft, 0.35)));
  // Inlay points on the forearm.
  g.fillStyle = rgba(col.butt);
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
