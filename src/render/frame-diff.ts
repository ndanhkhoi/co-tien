import type { Graphics } from 'pixi.js';

interface Note {
  op: number;
  a: number;
  b: number;
  c: number;
  d: number;
}

/**
 * The numbers that make up one frame (every transform and texture, each ball's orientation and
 * every line drawn), compared with the frame before: a table where nothing changed is not drawn again.
 */
export class FrameDiff {
  private prev: number[] = [];
  private cur: number[] = [];
  private same = true;
  begin() {
    const spare = this.prev;
    this.prev = this.cur;
    this.cur = spare;
    this.cur.length = 0;
    this.same = true;
  }
  add(v: number) {
    if (this.same && this.prev[this.cur.length] !== v) this.same = false;
    this.cur.push(v);
  }
  /** True when this frame differs from the one before. */
  changed() {
    return !this.same || this.cur.length !== this.prev.length;
  }
}

export interface StrokeStyle {
  width: number;
  color: number;
  alpha?: number;
  cap?: 'round' | 'butt' | 'square';
  join?: 'round' | 'miter' | 'bevel';
}

/**
 * Draws in table metres onto a Graphics that lives in pixel space, so circle
 * tessellation is based on on-screen size (metre-sized radii would turn into diamonds).
 * Every command is also written into the frame description.
 */
export class MetreGraphics {
  k = 1;
  // Clearing an empty Graphics still rebuilds its geometry; skip it while nothing is drawn.
  private drawn = false;
  // Reused for every command: aim paths issue many notes every frame.
  private readonly command: Note = { op: 0, a: 0, b: 0, c: 0, d: 0 };
  constructor(readonly g: Graphics, private frame: FrameDiff) {}
  clear() {
    if (this.drawn) this.g.clear();
    this.drawn = false;
    return this;
  }
  private begin(op: number, a: number, b: number): Note {
    const n = this.command;
    n.op = op; n.a = a; n.b = b; n.c = 0; n.d = 0;
    return n;
  }
  private note() {
    const n = this.command;
    const f = this.frame;
    f.add(n.op); f.add(n.a); f.add(n.b); f.add(n.c); f.add(n.d);
  }
  moveTo(x: number, y: number) { this.drawn = true; this.begin(1, x, y); this.note(); this.g.moveTo(x * this.k, y * this.k); return this; }
  lineTo(x: number, y: number) { this.begin(2, x, y); this.note(); this.g.lineTo(x * this.k, y * this.k); return this; }
  circle(x: number, y: number, r: number) { this.drawn = true; this.begin(3, x, y).c = r; this.note(); this.g.circle(x * this.k, y * this.k, r * this.k); return this; }
  rect(x: number, y: number, w: number, h: number) { this.drawn = true; const n = this.begin(4, x, y); n.c = w; n.d = h; this.note(); this.g.rect(x * this.k, y * this.k, w * this.k, h * this.k); return this; }
  stroke(style: StrokeStyle) { this.begin(5, style.width, style.color).c = style.alpha ?? 1; this.note(); this.g.stroke(style); return this; }
  fill(style: { color: number; alpha?: number }) { this.begin(6, style.color, style.alpha ?? 1); this.note(); this.g.fill(style); return this; }
}
