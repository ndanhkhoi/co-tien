import {
  checkPockets, clusterSize, collideBalls, prepareCloth, prepareImpact,
  releaseCollisionContexts, segmentDistance, softImpact,
  type ClothContext, type ImpactContext,
} from './collision';
import { applyPocketPull, applyTerrain } from './terrain';
import type { Ball, PhysEvent, PhysParams, SimWorld, Terrain } from './types';

interface BallImpact {
  a: Ball | null;
  b: Ball | null;
  h: number;
}

const nextImpact: BallImpact = { a: null, b: null, h: 0 };
const STOP_V = 0.004;
const STOP_W = 0.6;

function applyRollingFriction(b: Ball, c: ClothContext, speed: number) {
  const R = c.R;
  const p = c.p;
  const dv = p.muRoll * c.rollK * p.g * c.dt;
  if (speed <= dv) {
    b.vx = 0;
    b.vy = 0;
  } else {
    const k = (speed - dv) / speed;
    b.vx *= k;
    b.vy *= k;
  }
  b.wx = -b.vy / R;
  b.wy = b.vx / R;
}

function decaySpin(b: Ball, c: ClothContext) {
  if (b.wz === 0) return;
  const dw = c.p.spinDecel * c.spinK * c.dt;
  b.wz = Math.abs(b.wz) <= dw ? 0 : b.wz - Math.sign(b.wz) * dw;
}

function settleBall(b: Ball, R: number) {
  if (Math.hypot(b.vx, b.vy) < STOP_V && Math.hypot(b.wx, b.wy) * R < STOP_V) {
    b.vx = b.vy = b.wx = b.wy = 0;
    if (Math.abs(b.wz) < STOP_W) b.wz = 0;
  }
}

/** Cloth friction for one ball over dt. */
function applyCloth(b: Ball, c: ClothContext) {
  const R = c.R;
  const p = c.p;
  const dt = c.dt;
  const cx = b.vx - R * b.wy;
  const cy = b.vy + R * b.wx;
  const slip = Math.hypot(cx, cy);
  const speed = Math.hypot(b.vx, b.vy);
  if (slip > 1e-3) {
    const ux = cx / slip;
    const uy = cy / slip;
    const a = p.muSlide * c.slideK * p.g;
    if (3.5 * a * dt >= slip) {
      const k = slip / 3.5;
      b.vx -= ux * k;
      b.vy -= uy * k;
      b.wx = -b.vy / R;
      b.wy = b.vx / R;
    } else {
      b.vx -= ux * a * dt;
      b.vy -= uy * a * dt;
      b.wx -= ((2.5 * a) / R) * uy * dt;
      b.wy += ((2.5 * a) / R) * ux * dt;
    }
  } else if (speed > 0) applyRollingFriction(b, c, speed);
  else {
    b.wx = 0;
    b.wy = 0;
  }
  decaySpin(b, c);
  settleBall(b, R);
}

/** Earliest time in [0, h] at which two balls moving linearly touch (Infinity if none). */
function timeOfImpact(a: Ball, b: Ball, D: number, h: number): number {
  const px = b.x - a.x;
  const py = b.y - a.y;
  const vx = b.vx - a.vx;
  const vy = b.vy - a.vy;
  const pz = (b.z ?? 0) - (a.z ?? 0);
  const vz = (b.vz ?? 0) - (a.vz ?? 0);
  const pv = px * vx + py * vy + pz * vz;
  if (pv >= 0) return Infinity;
  const vv = vx * vx + vy * vy + vz * vz;
  const reach = Math.sqrt(vv) * h + D;
  if (Math.abs(px) > reach || Math.abs(py) > reach) return Infinity;
  const pp = px * px + py * py + pz * pz - D * D;
  if (pp <= 0) return 0;
  const disc = pv * pv - vv * pp;
  if (disc < 0) return Infinity;
  const t = (-pv - Math.sqrt(disc)) / vv;
  return t <= h ? Math.max(0, t) : Infinity;
}

function isMoving(b: Ball): boolean {
  return b.onTable && ((b.z ?? 0) > 0 || (b.vz ?? 0) !== 0 || Math.abs(b.vx) > 0 || Math.abs(b.vy) > 0 || Math.abs(b.wz) > 0 || Math.abs(b.wx) > 0 || Math.abs(b.wy) > 0);
}

function anyMoving(balls: Ball[]): boolean {
  for (const b of balls) if (isMoving(b)) return true;
  return false;
}

function maxBallSpeed(balls: Ball[]): number {
  let vmax = 0;
  for (const b of balls) {
    if (!b.onTable) continue;
    const v = Math.abs(b.vx) + Math.abs(b.vy) + Math.abs(b.vz ?? 0) + ((b.z ?? 0) > 0 ? 0.01 : 0);
    if (v > vmax) vmax = v;
  }
  return vmax;
}

function hasSpinningBall(balls: Ball[]): boolean {
  for (const b of balls) if (b.onTable && (b.wz !== 0 || b.wx !== 0 || b.wy !== 0)) return true;
  return false;
}

function landingStep(balls: Ball[], p: PhysParams, h: number): number {
  // Resolve a landing at its ballistic time rather than integrating through the bed.
  for (const b of balls) {
    if (!b.onTable) continue;
    const z = b.z ?? 0, vz = b.vz ?? 0;
    if (z > 0 || vz > 0) {
      const landing = (vz + Math.sqrt(vz * vz + 2 * p.g * z)) / p.g;
      if (landing > 1e-9) h = Math.min(h, landing);
    }
  }
  return h;
}

function findBallImpact(balls: Ball[], moving: boolean[], D: number, h: number): BallImpact {
  let hitA: Ball | null = null;
  let hitB: Ball | null = null;
  // Which balls move this substep: the pair search below asks once per ball, not once per pair.
  markMoving(balls, moving);
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (!a.onTable) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (!b.onTable) continue;
      if (!moving[i] && !moving[j]) continue;
      const t = timeOfImpact(a, b, D, h);
      if (t < h) {
        h = t;
        hitA = a;
        hitB = b;
      }
    }
  }
  nextImpact.a = hitA;
  nextImpact.b = hitB;
  nextImpact.h = h;
  return nextImpact;
}

function markMoving(balls: Ball[], moving: boolean[]) {
  for (let i = 0; i < balls.length; i++) moving[i] = isMoving(balls[i]);
}

function advanceBalls(balls: Ball[], p: PhysParams, h: number) {
  for (const b of balls) {
    if (!b.onTable) continue;
    b.x += b.vx * h;
    b.y += b.vy * h;
    if ((b.z ?? 0) > 0 || (b.vz ?? 0) !== 0) {
      b.z = (b.z ?? 0) + (b.vz ?? 0) * h - 0.5 * p.g * h * h;
      b.vz = (b.vz ?? 0) - p.g * h;
      if (b.z <= 1e-10) {
        b.z = 0;
        // Cloth/slate returns a fraction of normal impact energy, then settles.
        b.vz = Math.abs(b.vz) > 0.35 ? -b.vz * 0.35 : 0;
      }
    }
  }
}

function applyClothToBalls(w: SimWorld, c: ClothContext, h: number) {
  c.dt = h;
  const tr = w.terrain;
  for (const b of w.balls) {
    if (!b.onTable) continue;
    if ((b.z ?? 0) > 0 || (b.vz ?? 0) > 0) continue;
    // Cloth friction leaves a ball at complete rest exactly as it is.
    if (b.vx === 0 && b.vy === 0 && b.wx === 0 && b.wy === 0 && b.wz === 0) continue;
    c.slideK = 1;
    c.rollK = 1;
    c.spinK = 1;
    if (tr?.patches) applyPatchFriction(c, tr.patches, b);
    applyCloth(b, c);
  }
}

function applyPatchFriction(c: ClothContext, patches: NonNullable<Terrain['patches']>, b: Ball) {
  for (const pa of patches) {
    if ((b.x - pa.x) ** 2 + (b.y - pa.y) ** 2 < pa.r * pa.r) {
      c.slideK *= pa.slide;
      c.spinK *= pa.spin ?? 1;
      c.rollK *= pa.roll;
    }
  }
}

function outsideSegmentBox(b: Ball, s: { ax: number; ay: number; bx: number; by: number }, R: number): boolean {
  return b.x - R > (s.ax > s.bx ? s.ax : s.bx) || b.x + R < (s.ax < s.bx ? s.ax : s.bx) ||
    b.y - R > (s.ay > s.by ? s.ay : s.by) || b.y + R < (s.ay < s.by ? s.ay : s.by);
}

function collideSegment(
  b: Ball, s: { ax: number; ay: number; bx: number; by: number }, c: ImpactContext,
): boolean {
  const R = c.R;
  const p = c.p;
  const events = c.events;
  // A ball whose bottom clears the cushion top can leave the table.
  if ((b.z ?? 0) > 0.04) return false;
  // Outside the segment's box grown by R the ball cannot touch it; most balls are nowhere near.
  if (outsideSegmentBox(b, s, R)) return false;
  const ex = s.bx - s.ax;
  const ey = s.by - s.ay;
  const l2 = ex * ex + ey * ey;
  let t = ((b.x - s.ax) * ex + (b.y - s.ay) * ey) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = s.ax + ex * t;
  const qy = s.ay + ey * t;
  const dx = b.x - qx;
  const dy = b.y - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= R * R || d2 === 0) return false;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  b.x += nx * (R - d + 1e-7);
  b.y += ny * (R - d + 1e-7);
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return false;
  const e = Math.max(0.66, c.eCushion - 0.018 * Math.min(-vn, 7));
  const Jn = -(1 + e) * vn;
  b.vx += Jn * nx;
  b.vy += Jn * ny;
  const tx = -ny;
  const ty = nx;
  const vt = b.vx * tx + b.vy * ty;
  const slip = vt - R * b.wz;
  if (Math.abs(slip) > 1e-6) {
    const f = Math.min(p.muCushion * Jn, (Math.abs(slip) * 2) / 7) * Math.sign(slip);
    b.vx -= f * tx;
    b.vy -= f * ty;
    b.wz += (2.5 * f) / R;
  }
  b.wx *= 0.35;
  b.wy *= 0.35;
  if (events) events.push({ t: 'cushion', id: b.id, speed: -vn, x: qx, y: qy });
  return true;
}

function resolveImpact(balls: Ball[], hit: BallImpact, c: ImpactContext) {
  if (!hit.a || !hit.b) return;
  const frozen = !(hit.a.z || hit.a.vz || hit.b.z || hit.b.vz)
    && (clusterSize(balls, hit.a, 2 * c.R) > 2 || clusterSize(balls, hit.b, 2 * c.R) > 2);
  if (frozen && Math.abs(hit.a.vx - hit.b.vx) + Math.abs(hit.a.vy - hit.b.vy) > 0.3) softImpact(balls, c);
  else collideBalls(hit.a, hit.b, c);
}

function railMultiplier(w: SimWorld, b: Ball, R: number): number {
  const rails = w.terrain?.rails;
  if (!rails) return 1;
  let multiplier = 1;
  for (const rail of rails) {
    if (segmentDistance(b.x, b.y, rail) <= R * 1.1) multiplier *= rail.multiplier;
  }
  return multiplier;
}

function leaveTableOrPocket(w: SimWorld, b: Ball, events: PhysEvent[] | null) {
  if ((b.z ?? 0) > 0 && (Math.abs(b.x) > w.table.L / 2 + w.table.R || Math.abs(b.y) > w.table.W / 2 + w.table.R)) {
    const speed = Math.hypot(b.vx, b.vy, b.vz ?? 0);
    b.onTable = false;
    b.vx = b.vy = b.wx = b.wy = b.wz = b.vz = b.z = 0;
    if (events) events.push({ t: 'off-table', id: b.id, speed });
  } else checkPockets(w, b, events);
}

function collideBallWithTable(w: SimWorld, b: Ball, c: ImpactContext) {
  if (!b.onTable || (b.vx === 0 && b.vy === 0)) return;
  const R = c.R;
  const p = c.p;
  const events = c.events;
  // The rail multiplier depends only on where the ball is, not on which cushion it meets.
  const multiplier = railMultiplier(w, b, R);
  c.eCushion = multiplier === 1 ? p.eCushion : Math.min(1, p.eCushion * multiplier);
  for (const s of w.table.segments) collideSegment(b, s, c);
  c.eCushion = p.eCushion;
  if (w.extraSegments) for (const s of w.extraSegments) collideSegment(b, s, c);
  leaveTableOrPocket(w, b, events);
}

export function step(w: SimWorld, dt: number, events: PhysEvent[] | null): boolean {
  const p = w.params;
  const balls = w.balls;
  const R = w.table.R;
  const D = 2 * R;
  let remaining = dt;
  let guard = 0;
  const moving: boolean[] = new Array(balls.length);
  const cloth = prepareCloth(w);
  const impact = prepareImpact(w, events);
  while (remaining > 1e-9) {
    const vmax = maxBallSpeed(balls);
    if (vmax === 0 && !hasSpinningBall(balls)) {
      releaseCollisionContexts(cloth, impact);
      return false;
    }
    let h = Math.min(remaining, Math.max(1 / 4000, (0.35 * R) / Math.max(vmax, 1e-6)), 1 / 240);
    h = landingStep(balls, p, h);
    const hit = findBallImpact(balls, moving, D, h);
    remaining -= hit.h;
    if (++guard > 20000) remaining = 0;
    advanceBalls(balls, p, hit.h);
    if (hit.h > 0) {
      const tr = w.terrain;
      if (tr) applyTerrain(w, tr, hit.h);
      applyClothToBalls(w, cloth, hit.h);
      w.time = (w.time ?? 0) + hit.h;
    }
    resolveImpact(balls, hit, impact);
    nextImpact.a = null;
    nextImpact.b = null;
    if (w.pocketPull) applyPocketPull(w, hit.h);
    for (const b of balls) collideBallWithTable(w, b, impact);
  }
  releaseCollisionContexts(cloth, impact);
  return anyMoving(balls);
}

/** Run a world to rest (or until maxTime) collecting events. */
export function simulate(w: SimWorld, maxTime = 30, events: PhysEvent[] = []): PhysEvent[] {
  let t = 0;
  const dt = 1 / 60;
  while (t < maxTime) {
    if (!step(w, dt, events)) break;
    t += dt;
  }
  return events;
}
