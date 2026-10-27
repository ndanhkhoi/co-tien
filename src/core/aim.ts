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

/** Smallest t ≥ 0 where a circle of radius r moving from (px,py) along unit (dx,dy) touches a segment. */
function sweepSegment(px: number, py: number, dx: number, dy: number, r: number, s: Segment): { t: number; nx: number; ny: number } | null {
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
    const denom = dx * nx + dy * ny;
    if (denom >= -1e-9) continue; // moving away from this face
    const dist = (px - s.ax) * nx + (py - s.ay) * ny - r;
    const t = -dist / denom;
    if (t < -1e-9) continue;
    const hx = px + dx * t - s.ax;
    const hy = py + dy * t - s.ay;
    const proj = hx * ux + hy * uy;
    if (proj < 0 || proj > len) continue;
    if (!best || t < best.t) best = { t: Math.max(0, t), nx, ny };
  }
  // Rounded endpoints.
  for (const [ex0, ey0] of [[s.ax, s.ay], [s.bx, s.by]]) {
    const t = sweepCircle(px, py, dx, dy, ex0, ey0, r);
    if (t !== null && (!best || t < best.t)) {
      const cx = px + dx * t - ex0;
      const cy = py + dy * t - ey0;
      const l = Math.hypot(cx, cy) || 1;
      best = { t, nx: cx / l, ny: cy / l };
    }
  }
  return best;
}

/** Distance along the ray at which the moving point reaches distance `rr` from (cx, cy). */
function sweepCircle(px: number, py: number, dx: number, dy: number, cx: number, cy: number, rr: number): number | null {
  const fx = px - cx;
  const fy = py - cy;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - rr * rr;
  if (c < 0) return b < 0 ? 0 : null;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

export function predictAim(t: TableGeom, balls: Ball[], cueId: number, angle: number, extraSegments: Segment[] = []): AimPrediction {
  const cue = balls.find((b) => b.id === cueId)!;
  const R = t.R;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let bestT = Infinity;
  let hit: Ball | null = null;
  for (const b of balls) {
    if (b.id === cueId || !b.onTable) continue;
    const tt = sweepCircle(cue.x, cue.y, dx, dy, b.x, b.y, 2 * R);
    if (tt !== null && tt < bestT) {
      bestT = tt;
      hit = b;
    }
  }
  let normal: { x: number; y: number } | null = null;
  for (const s of [...t.segments, ...extraSegments]) {
    const r = sweepSegment(cue.x, cue.y, dx, dy, R, s);
    if (r && r.t < bestT) {
      bestT = r.t;
      hit = null;
      normal = { x: r.nx, y: r.ny };
    }
  }
  if (bestT === Infinity) bestT = 3;
  const gx = cue.x + dx * bestT;
  const gy = cue.y + dy * bestT;
  if (hit) {
    let ox = hit.x - gx;
    let oy = hit.y - gy;
    const ol = Math.hypot(ox, oy) || 1;
    ox /= ol;
    oy /= ol;
    const cosCut = Math.max(-1, Math.min(1, ox * dx + oy * dy));
    // Tangent line: incoming direction minus its component along the line of centres.
    const tx = dx - ox * cosCut;
    const ty = dy - oy * cosCut;
    const tl = Math.hypot(tx, ty);
    const cueDir = tl > 1e-4 ? { x: tx / tl, y: ty / tl } : null;
    return { gx, gy, hitBall: hit.id, objDir: { x: ox, y: oy }, cueDir, cut: 1 - cosCut, cushionNormal: null };
  }
  if (normal) {
    const dot = dx * normal.x + dy * normal.y;
    return { gx, gy, hitBall: null, objDir: null, cueDir: { x: dx - 2 * dot * normal.x, y: dy - 2 * dot * normal.y }, cut: 0, cushionNormal: normal };
  }
  return { gx, gy, hitBall: null, objDir: null, cueDir: null, cut: 0, cushionNormal: null };
}

/** Pocket the object ball is heading for, if its path ends in one (for auto-calling). */
export function pocketAlong(t: TableGeom, x: number, y: number, dx: number, dy: number, closed: number[] = []): number | null {
  let best: number | null = null;
  let bestScore = Infinity;
  t.pockets.forEach((p, i) => {
    if (closed.includes(i)) return;
    const vx = p.ax - x;
    const vy = p.ay - y;
    const along = vx * dx + vy * dy;
    if (along <= 0) return;
    const off = Math.abs(vx * dy - vy * dx);
    const score = off / Math.max(0.05, along);
    if (score < bestScore && off < 0.12 + along * 0.08) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}
