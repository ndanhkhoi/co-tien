import type { Ball } from './physics';
import type { Segment, TableGeom } from './table';

export interface AimPrediction {
  /** Cue-ball centre at first contact. */
  gx: number; gy: number;
  hitBall: number | null;
  /** Object ball travel direction after contact. */
  objDir: { x: number; y: number } | null;
  /** Cue ball direction after contact (tangent line, or cushion rebound). */
  cueDir: { x: number; y: number } | null;
  /** 0 = full hit … 1 = thinnest cut. */
  cut: number;
  /** Cushion contact normal if the first thing hit is a rail. */
  cushionNormal: { x: number; y: number } | null;
}

export interface AimInput {
  table: TableGeom;
  balls: Ball[];
  cueId: number;
  angle: number;
  extraSegments?: Segment[];
}

interface SweepRay {
  x: number;
  y: number;
  dx: number;
  dy: number;
  r: number;
}

const ray: SweepRay = { x: 0, y: 0, dx: 0, dy: 0, r: 0 };

interface AimHit {
  t: number;
  ball: Ball | null;
  normal: { x: number; y: number } | null;
}

const aimHit: AimHit = { t: 0, ball: null, normal: null };

/** Smallest t ≥ 0 where a circle of radius r moving from (px,py) along unit (dx,dy) touches a segment. */
function sweepSegment(r: SweepRay, s: Segment): { t: number; nx: number; ny: number } | null {
  let best: { t: number; nx: number; ny: number } | null = null;
  const ex = s.bx - s.ax;
  const ey = s.by - s.ay;
  const len = Math.hypot(ex, ey);
  const ux = ex / len;
  const uy = ey / len;
  // Two offset lines.
  for (const sgn of [-1, 1]) {
    const nx = -uy * sgn;
    const ny = ux * sgn;
    const denom = r.dx * nx + r.dy * ny;
    if (denom >= -1e-9) continue; // moving away from this face
    const dist = (r.x - s.ax) * nx + (r.y - s.ay) * ny - r.r;
    const t = -dist / denom;
    if (t < -1e-9) continue;
    const hx = r.x + r.dx * t - s.ax;
    const hy = r.y + r.dy * t - s.ay;
    const proj = hx * ux + hy * uy;
    if (proj < 0 || proj > len) continue;
    if (!best || t < best.t) best = { t: Math.max(0, t), nx, ny };
  }
  // Rounded endpoints.
  for (const [ex0, ey0] of [[s.ax, s.ay], [s.bx, s.by]]) {
    const t = sweepCircle(r, ex0, ey0, r.r);
    if (t !== null && (!best || t < best.t)) {
      const cx = r.x + r.dx * t - ex0;
      const cy = r.y + r.dy * t - ey0;
      const l = Math.hypot(cx, cy) || 1;
      best = { t, nx: cx / l, ny: cy / l };
    }
  }
  return best;
}

/** Distance along the ray at which the moving point reaches distance `rr` from (cx, cy). */
function sweepCircle(r: SweepRay, cx: number, cy: number, rr: number): number | null {
  const fx = r.x - cx;
  const fy = r.y - cy;
  const b = fx * r.dx + fy * r.dy;
  const c = fx * fx + fy * fy - rr * rr;
  if (c < 0) return b < 0 ? 0 : null;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

function findBallHit(input: AimInput): Ball | null {
  const R = input.table.R;
  aimHit.t = Infinity;
  let bestT = Infinity;
  let hit: Ball | null = null;
  for (const b of input.balls) {
    if (b.id === input.cueId || !b.onTable) continue;
    const tt = sweepCircle(ray, b.x, b.y, 2 * R);
    if (tt !== null && tt < bestT) {
      bestT = tt;
      hit = b;
    }
  }
  aimHit.t = bestT;
  return hit;
}

function findAimHit(input: AimInput): AimHit {
  const t = input.table;
  aimHit.ball = findBallHit(input);
  aimHit.normal = null;
  for (const s of t.segments) considerSegment(s);
  if (input.extraSegments) {
    for (const s of input.extraSegments) considerSegment(s);
  }
  return aimHit;
}

function considerSegment(s: Segment) {
  const r = sweepSegment(ray, s);
  if (!r || r.t >= aimHit.t) return;
  aimHit.t = r.t;
  aimHit.ball = null;
  aimHit.normal = { x: r.nx, y: r.ny };
}

export function predictAim(input: AimInput): AimPrediction {
  const t = input.table;
  const cue = input.balls.find((b) => b.id === input.cueId)!;
  const R = t.R;
  const dx = Math.cos(input.angle);
  const dy = Math.sin(input.angle);
  ray.x = cue.x;
  ray.y = cue.y;
  ray.dx = dx;
  ray.dy = dy;
  ray.r = R;
  const hit = findAimHit(input);
  const bestT = hit.t === Infinity ? 3 : hit.t;
  const gx = cue.x + dx * bestT;
  const gy = cue.y + dy * bestT;
  let result: AimPrediction;
  if (hit.ball) {
    let ox = hit.ball.x - gx;
    let oy = hit.ball.y - gy;
    const ol = Math.hypot(ox, oy) || 1;
    ox /= ol;
    oy /= ol;
    const cosCut = Math.max(-1, Math.min(1, ox * dx + oy * dy));
    // Tangent line: incoming direction minus its component along the line of centres.
    const tx = dx - ox * cosCut;
    const ty = dy - oy * cosCut;
    const tl = Math.hypot(tx, ty);
    const cueDir = tl > 1e-4 ? { x: tx / tl, y: ty / tl } : null;
    result = { gx, gy, hitBall: hit.ball.id, objDir: { x: ox, y: oy }, cueDir, cut: 1 - cosCut, cushionNormal: null };
  } else if (hit.normal) {
    const dot = dx * hit.normal.x + dy * hit.normal.y;
    result = { gx, gy, hitBall: null, objDir: null, cueDir: { x: dx - 2 * dot * hit.normal.x, y: dy - 2 * dot * hit.normal.y }, cut: 0, cushionNormal: hit.normal };
  } else {
    result = { gx, gy, hitBall: null, objDir: null, cueDir: null, cut: 0, cushionNormal: null };
  }
  aimHit.ball = null;
  aimHit.normal = null;
  return result;
}
