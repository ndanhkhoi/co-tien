import type { Segment, TableGeom } from '../core/table';
import type { TableSkin } from '../game/content/gear';
import { feltNoise } from './art';

// Step painters for the table canvas; all coordinates stay in table metres.

export function rgba(c: number, a = 1): string {
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
}

export function mixColour(c1: number, c2: number, t: number): number {
  const r = ((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t;
  const g = ((c1 >> 8) & 255) * (1 - t) + ((c2 >> 8) & 255) * t;
  const b = (c1 & 255) * (1 - t) + (c2 & 255) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export interface PaintTableArgs {
  t: TableGeom;
  skin: TableSkin;
  pxPerM: number;
  railImg: HTMLImageElement | null;
  details: Partial<Record<'corner' | 'side', HTMLImageElement | null>>;
}

interface TableCanvas {
  c: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
}

/** Metre-to-pixel conversion plus the shared seeded grain stream. */
interface PaintContext {
  rail: number;
  X(x: number): number;
  Y(y: number): number;
  S(m: number): number;
  rnd(): number;
}

interface Bed {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function makePaintContext(t: TableGeom, rail: number, pxPerM: number): PaintContext {
  const hx = t.L / 2 + rail;
  const hy = t.W / 2 + rail;
  let seed = 7;
  return {
    rail,
    X: (x: number) => (x + hx) * pxPerM,
    Y: (y: number) => (y + hy) * pxPerM,
    S: (m: number) => m * pxPerM,
    rnd: () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    },
  };
}

/** Ink-washed wooden frame, with the sect's painted rail strip when available. */
export function paintFrame(p: PaintContext, args: PaintTableArgs, canvas: TableCanvas): void {
  const { g } = canvas;
  const w = canvas.c.width;
  const h = canvas.c.height;
  const { t, skin, railImg } = args;
  const corner = p.S(0.05);
  g.save();
  g.beginPath();
  g.roundRect(0, 0, w, h, corner);
  // Ink-washed wood: matte, a little lighter at the top like a brush wash.
  const wood = g.createLinearGradient(0, 0, 0, h);
  wood.addColorStop(0, rgba(mixColour(skin.rail, 0xffffff, 0.06)));
  wood.addColorStop(0.5, rgba(skin.rail));
  wood.addColorStop(1, rgba(skin.railDark));
  g.fillStyle = wood;
  g.fill();
  g.clip();
  if (railImg) paintRailStrips(p, railImg, canvas);
  // Grain streaks (only on the plain wood frame).
  const strokes = railImg ? 0 : 260;
  for (let i = 0; i < strokes; i++) paintGrainStroke(g, p, skin);
  // Polished top highlight.
  const sheen = g.createLinearGradient(0, 0, 0, p.S(t.railWidth));
  sheen.addColorStop(0, 'rgba(255,255,255,0.05)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, w, p.S(t.railWidth));
  g.restore();
  g.lineWidth = Math.max(1, p.S(0.004));
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.beginPath();
  g.roundRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth, corner);
  g.stroke();
}

function paintRailStrips(p: PaintContext, img: HTMLImageElement, canvas: TableCanvas): void {
  const { g } = canvas;
  const w = canvas.c.width;
  const h = canvas.c.height;
  // The sect's painted rail strip, tiled along each side (rotated for the short rails).
  const th = p.S(p.rail);
  const tw = th * (img.width / img.height);
  const strip = (len: number) => {
    for (let x = 0; x < len; x += tw) g.drawImage(img, x, 0, tw, th);
  };
  strip(w);
  g.save();
  g.translate(w, h);
  g.rotate(Math.PI);
  strip(w);
  g.restore();
  g.save();
  g.translate(0, h);
  g.rotate(-Math.PI / 2);
  strip(h);
  g.restore();
  g.save();
  g.translate(w, 0);
  g.rotate(Math.PI / 2);
  strip(h);
  g.restore();
}

function paintGrainStroke(g: CanvasRenderingContext2D, p: PaintContext, skin: TableSkin): void {
  const y = p.rnd() * g.canvas.height;
  const x = p.rnd() * g.canvas.width;
  const len = p.S(0.2 + p.rnd() * 0.9);
  const light = p.rnd() < 0.5;
  const grain = light ? skin.railDark : mixColour(skin.rail, 0xffffff, 0.25);
  const alpha = 0.08 + p.rnd() * 0.1;
  g.strokeStyle = rgba(grain, alpha);
  g.lineWidth = Math.max(1, p.S(0.002 + p.rnd() * 0.004));
  const bend1 = p.S(0.006) * (p.rnd() - 0.5);
  const bend2 = p.S(0.006) * (p.rnd() - 0.5);
  g.beginPath();
  g.moveTo(x, y);
  g.bezierCurveTo(x + len * 0.3, y + bend1, x + len * 0.6, y - bend2, x + len, y);
  g.stroke();
}

/** Cloth bed with fixed felt noise and lamp falloff. */
export function paintBed(g: CanvasRenderingContext2D, p: PaintContext, args: PaintTableArgs): Bed {
  const { t, skin } = args;
  const cushionDepth = 0.05;
  const bed = {
    x: p.X(-t.L / 2 - cushionDepth),
    y: p.Y(-t.W / 2 - cushionDepth),
    w: p.S(t.L + 2 * cushionDepth),
    h: p.S(t.W + 2 * cushionDepth),
  };
  g.fillStyle = rgba(skin.cloth);
  g.fillRect(bed.x, bed.y, bed.w, bed.h);
  // Felt fibres: a fixed noise tile laid over the cloth. Reading the canvas back pixel by pixel
  // cost over a second on mid-range phones every time the table was repainted.
  g.fillStyle = g.createPattern(feltNoise(), 'repeat')!;
  g.fillRect(bed.x, bed.y, bed.w, bed.h);
  // Lamp falloff: bright centre, darker edges.
  const lamp = g.createRadialGradient(p.X(0), p.Y(0), p.S(0.1), p.X(0), p.Y(0), p.S(t.L * 0.62));
  lamp.addColorStop(0, 'rgba(0,0,0,0)');
  lamp.addColorStop(0.65, 'rgba(0,0,0,0)');
  lamp.addColorStop(1, rgba(skin.clothDark, 0.35));
  g.fillStyle = lamp;
  g.fillRect(bed.x, bed.y, bed.w, bed.h);
  paintSpots(g, p, t);
  return bed;
}

function paintSpots(g: CanvasRenderingContext2D, p: PaintContext, t: TableGeom): void {
  // Pool tables mark only the foot spot.
  if (t.kind === 'pool') {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.arc(p.X(t.footSpot.x), p.Y(t.footSpot.y), Math.max(1.5, p.S(0.006)), 0, Math.PI * 2);
    g.fill();
    return;
  }
  g.fillStyle = 'rgba(255,255,255,0.4)';
  for (const sp of [t.headSpot, t.centerSpot, t.footSpot]) {
    g.beginPath();
    g.arc(p.X(sp.x), p.Y(sp.y), Math.max(1.5, p.S(0.005)), 0, Math.PI * 2);
    g.fill();
  }
}

/** Pockets, cushions, cushion shadows and painted pocket details. */
export function paintPlaySurface(
  g: CanvasRenderingContext2D,
  p: PaintContext,
  args: PaintTableArgs,
): void {
  paintHoles(g, p, args);
  paintCushions(g, p, args);
  paintCushionShadows(g, p, args.t);
  paintPockets(g, p, args);
  paintDiamonds(g, p, args.t);
}

function paintHoles(g: CanvasRenderingContext2D, p: PaintContext, args: PaintTableArgs): void {
  for (const pk of args.t.pockets) {
    if (args.details[pk.kind]) continue;
    const hole = g.createRadialGradient(p.X(pk.hx), p.Y(pk.hy), p.S(pk.hr * 0.1), p.X(pk.hx), p.Y(pk.hy), p.S(pk.hr));
    // Ink pooled in the hole, feathering out at the rim.
    hole.addColorStop(0, '#0b0a09');
    hole.addColorStop(0.8, '#14110f');
    hole.addColorStop(1, 'rgba(20,17,15,0.85)');
    g.fillStyle = hole;
    g.beginPath();
    g.arc(p.X(pk.hx), p.Y(pk.hy), p.S(pk.hr), 0, Math.PI * 2);
    g.fill();
  }
}

function paintCushions(g: CanvasRenderingContext2D, p: PaintContext, args: PaintTableArgs): void {
  const { t, skin } = args;
  if (t.kind !== 'pool') {
    paintCaromCushions(g, p, t, skin);
    return;
  }
  // Every three consecutive segments are [nose, jawP, jawQ].
  for (let i = 0; i < t.segments.length; i += 3) {
    const nose = t.segments[i];
    const jp = t.segments[i + 1];
    const jq = t.segments[i + 2];
    g.fillStyle = rgba(mixColour(skin.cloth, 0x000000, 0.12));
    cushionPath(g, p, [nose, jp, jq]);
    g.fill();
    // Lit nose line.
    g.strokeStyle = rgba(mixColour(skin.cloth, 0xffffff, 0.18), 0.55);
    g.lineWidth = Math.max(1, p.S(0.004));
    cushionPath(g, p, [nose, jp, jq]);
    g.stroke();
  }
}

function cushionPath(
  g: CanvasRenderingContext2D,
  p: PaintContext,
  segs: [Segment, Segment, Segment],
): void {
  g.beginPath();
  const [nose, jp, jq] = segs;
  g.moveTo(p.X(jp.bx), p.Y(jp.by));
  g.lineTo(p.X(nose.ax), p.Y(nose.ay));
  g.lineTo(p.X(nose.bx), p.Y(nose.by));
  // Left open: fill() closes it, while the lit stroke must not run along the rail.
  g.lineTo(p.X(jq.bx), p.Y(jq.by));
}

function paintCaromCushions(
  g: CanvasRenderingContext2D,
  p: PaintContext,
  t: TableGeom,
  skin: { cloth: number },
): void {
  const depth = 0.05;
  g.fillStyle = rgba(mixColour(skin.cloth, 0x000000, 0.12));
  g.fillRect(p.X(-t.L / 2 - depth), p.Y(-t.W / 2 - depth), p.S(t.L + 2 * depth), p.S(depth));
  g.fillRect(p.X(-t.L / 2 - depth), p.Y(t.W / 2), p.S(t.L + 2 * depth), p.S(depth));
  g.fillRect(p.X(-t.L / 2 - depth), p.Y(-t.W / 2 - depth), p.S(depth), p.S(t.W + 2 * depth));
  g.fillRect(p.X(t.L / 2), p.Y(-t.W / 2 - depth), p.S(depth), p.S(t.W + 2 * depth));
  g.strokeStyle = rgba(mixColour(skin.cloth, 0xffffff, 0.22), 0.9);
  g.lineWidth = Math.max(1, p.S(0.004));
  g.strokeRect(p.X(-t.L / 2), p.Y(-t.W / 2), p.S(t.L), p.S(t.W));
}

function paintCushionShadows(g: CanvasRenderingContext2D, p: PaintContext, t: TableGeom): void {
  // Soft shadow the cushion casts on the bed.
  const sh = Math.max(2, p.S(0.02));
  const edges: [number, number, number, number, number, number, number, number][] = [
    [p.X(-t.L / 2), p.Y(-t.W / 2), p.S(t.L), sh, 0, p.Y(-t.W / 2), 0, p.Y(-t.W / 2) + sh],
    [p.X(-t.L / 2), p.Y(t.W / 2) - sh, p.S(t.L), sh, 0, p.Y(t.W / 2), 0, p.Y(t.W / 2) - sh],
    [p.X(-t.L / 2), p.Y(-t.W / 2), sh, p.S(t.W), p.X(-t.L / 2), 0, p.X(-t.L / 2) + sh, 0],
    [p.X(t.L / 2) - sh, p.Y(-t.W / 2), sh, p.S(t.W), p.X(t.L / 2), 0, p.X(t.L / 2) - sh, 0],
  ];
  for (const [x, y, w, h, x0, y0, x1, y1] of edges) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, 'rgba(0,0,0,0.28)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
  }
}

function paintPockets(g: CanvasRenderingContext2D, p: PaintContext, args: PaintTableArgs): void {
  // Pocket liners (leather rims on the wood).
  for (const pk of args.t.pockets) {
    const image = args.details[pk.kind];
    if (image) {
      g.save();
      g.translate(p.X(pk.hx), p.Y(pk.hy));
      // Assets face down into the bed at the top rail; corner orientation follows the diagonal.
      const cornerAngle = Math.atan2(-Math.sign(pk.hy), -Math.sign(pk.hx)) - Math.PI / 2;
      g.rotate(pk.kind === 'corner' ? cornerAngle : pk.hy < 0 ? 0 : Math.PI);
      g.drawImage(image, -p.S(pk.hr), -p.S(pk.hr), p.S(pk.hr * 2), p.S(pk.hr * 2));
      g.restore();
      continue;
    }
    g.strokeStyle = 'rgba(20,14,10,0.9)';
    g.lineWidth = Math.max(2, p.S(0.012));
    g.beginPath();
    g.arc(p.X(pk.hx), p.Y(pk.hy), p.S(pk.hr + 0.004), 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = Math.max(1, p.S(0.003));
    g.beginPath();
    g.arc(p.X(pk.hx), p.Y(pk.hy), p.S(pk.hr + 0.011), Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
  }
}

function paintDiamonds(g: CanvasRenderingContext2D, p: PaintContext, t: TableGeom): void {
  // Plain white inlays like a real table, a touch larger so they read on a phone.
  for (const dm of t.diamonds) {
    g.fillStyle = '#f6f1e6';
    g.strokeStyle = 'rgba(26, 23, 19, 0.35)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(p.X(dm.x), p.Y(dm.y), Math.max(2.2, p.S(0.0075)), 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}
