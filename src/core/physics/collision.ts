import { DEFAULT_PHYS, type Ball, type PhysEvent, type PhysParams, type SimWorld } from './types';

// Rigid-sphere pool physics with sliding/rolling friction, three-axis spin, cushion
// english transfer and cut-induced throw. Component cross products use a frame with
// z toward the viewer; the bottom contact point is (0, 0, -R).

export interface ClothContext {
  R: number;
  p: PhysParams;
  dt: number;
  slideK: number;
  rollK: number;
  spinK: number;
}

export interface ImpactContext {
  R: number;
  p: PhysParams;
  events: PhysEvent[] | null;
  eCushion: number;
}

interface SoftContext {
  R: number;
  D: number;
  omega: number;
  zeta: number;
  events: PhysEvent[] | null;
}

/** Gap under which balls count as frozen together (racks, clusters). */
const FROZEN = 2.5e-4;
// Soft contact: ~120 µs Hertz-like contact time, damping tuned so e ≈ eBall.
const CONTACT_T = 1.2e-4;
const MICRO_DT = CONTACT_T / 40;

// Scratch contexts are reused because step() runs many substeps per frame.
const cloth: ClothContext = { R: 0, p: DEFAULT_PHYS, dt: 0, slideK: 1, rollK: 1, spinK: 1 };
const impact: ImpactContext = { R: 0, p: DEFAULT_PHYS, events: null, eCushion: 0 };
const soft: SoftContext = { R: 0, D: 0, omega: 0, zeta: 0, events: null };

export function prepareCloth(w: SimWorld): ClothContext {
  cloth.R = w.table.R;
  cloth.p = w.params;
  cloth.dt = 0;
  cloth.slideK = 1;
  cloth.rollK = 1;
  cloth.spinK = 1;
  return cloth;
}

export function prepareImpact(w: SimWorld, events: PhysEvent[] | null): ImpactContext {
  impact.R = w.table.R;
  impact.p = w.params;
  impact.events = events;
  impact.eCushion = w.params.eCushion;
  return impact;
}

export function releaseCollisionContexts(c: ClothContext, i: ImpactContext) {
  c.p = DEFAULT_PHYS;
  c.dt = 0;
  i.p = DEFAULT_PHYS;
  i.events = null;
  i.eCushion = 0;
}

function collideAirborneBalls(a: Ball, b: Ball, c: ImpactContext): boolean {
  const R = c.R;
  const p = c.p;
  const events = c.events;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = (b.z ?? 0) - (a.z ?? 0);
  const d = Math.hypot(dx, dy, dz) || 1e-9;
  const nx = dx / d, ny = dy / d, nz = dz / d;
  const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny + ((a.vz ?? 0) - (b.vz ?? 0)) * nz;
  if (vn <= 0) return false;
  const j = (1 + p.eBall) * vn / 2;
  a.vx -= j * nx; a.vy -= j * ny; a.vz = (a.vz ?? 0) - j * nz;
  b.vx += j * nx; b.vy += j * ny; b.vz = (b.vz ?? 0) + j * nz;
  // The slate supports a resting ball: a downward impulse cannot send it below the cloth.
  if (!(a.z ?? 0) && a.vz < 0) a.vz = 0;
  if (!(b.z ?? 0) && b.vz < 0) b.vz = 0;
  if (events && vn > 0.01) events.push({ t: 'ball', a: a.id, b: b.id, speed: vn, x: a.x + nx * R, y: a.y + ny * R });
  return true;
}

function collideFlatBalls(a: Ball, b: Ball, c: ImpactContext): boolean {
  const { R, p, events } = c;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1e-9;
  const nx = dx / d;
  const ny = dy / d;
  const D = 2 * R;
  if (d < D) {
    const push = (D - d) / 2 + 1e-8;
    a.x -= nx * push; a.y -= ny * push;
    b.x += nx * push; b.y += ny * push;
  }
  const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (vn <= 0) return false;
  const J = ((1 + p.eBall) / 2) * vn;
  a.vx -= J * nx; a.vy -= J * ny;
  b.vx += J * nx; b.vy += J * ny;
  // Throw: friction at the contact acts against tangential surface slip.
  const tx = -ny;
  const ty = nx;
  const slip = (a.vx - b.vx) * tx + (a.vy - b.vy) * ty + R * (a.wz + b.wz);
  if (Math.abs(slip) > 1e-6) {
    const jt = Math.min(p.muBall * J, Math.abs(slip) / 7) * Math.sign(slip);
    a.vx -= jt * tx; a.vy -= jt * ty;
    b.vx += jt * tx; b.vy += jt * ty;
    a.wz -= (1.25 * jt) / R;
    b.wz -= (1.25 * jt) / R;
  }
  if (events && vn > 0.01) events.push({ t: 'ball', a: a.id, b: b.id, speed: vn, x: a.x + nx * R, y: a.y + ny * R });
  return true;
}

/** Two-ball impulse with cut-induced throw. Assumes the balls are touching. */
export function collideBalls(a: Ball, b: Ball, c: ImpactContext): boolean {
  const dz = (b.z ?? 0) - (a.z ?? 0);
  if (dz !== 0 || (a.vz ?? 0) !== 0 || (b.vz ?? 0) !== 0) return collideAirborneBalls(a, b, c);
  return collideFlatBalls(a, b, c);
}

export function clusterSize(balls: Ball[], seed: Ball, D: number): number {
  const lim = (D + FROZEN) * (D + FROZEN);
  const seen = new Set<Ball>([seed]);
  const queue = [seed];
  while (queue.length) {
    const a = queue.pop()!;
    for (const b of balls) {
      if (!b.onTable || b.z || b.vz || seen.has(b)) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx * dx + dy * dy < lim) {
        seen.add(b);
        queue.push(b);
      }
    }
  }
  return seen.size;
}

function softPass(live: Ball[], touching: Set<number>): boolean {
  let active = false;
  for (let i = 0; i < live.length; i++) {
    if (softRow(live[i], live, i + 1, touching)) active = true;
  }
  return active;
}

function softRow(a: Ball, live: Ball[], start: number, touching: Set<number>): boolean {
  const D = soft.D;
  const omega = soft.omega;
  const zeta = soft.zeta;
  const events = soft.events;
  let active = false;
  const frozen = D + FROZEN;
  for (let k = start; k < live.length; k++) {
    const b = live[k];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) > frozen || Math.abs(dy) > frozen) continue;
    const d2 = dx * dx + dy * dy;
    if (d2 >= frozen * frozen) continue;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const ny = dy / d;
    const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    const key = a.id * 64 + b.id;
    if (d >= D) {
      touching.delete(key);
      if (vn > 1e-4) active = true;
      continue;
    }
    active = true;
    if (!touching.has(key)) {
      touching.add(key);
      recordSoftTouch(a, b, events);
    }
    // Cap the depth so a bad placement can't turn the spring into an explosion.
    const f = Math.max(0, 0.5 * (omega * omega * Math.min(D - d, 2e-4) + 2 * zeta * omega * vn) * MICRO_DT);
    a.vx -= f * nx; a.vy -= f * ny;
    b.vx += f * nx; b.vy += f * ny;
  }
  return active;
}

function recordSoftTouch(a: Ball, b: Ball, events: PhysEvent[] | null) {
  if (!events) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1e-9;
  const nx = dx / d;
  const ny = dy / d;
  const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (vn > 0.01) {
    events.push({ t: 'ball', a: a.id, b: b.id, speed: vn, x: a.x + nx * soft.R, y: a.y + ny * soft.R });
  }
}

/**
 * Simultaneous impacts in frozen clusters (the break). Contacts are integrated as stiff
 * damped springs over microsecond steps, so impulse propagates through the rack
 * symmetrically and energy is conserved apart from the restitution loss.
 */
export function softImpact(balls: Ball[], c: ImpactContext) {
  soft.R = c.R;
  soft.D = 2 * c.R;
  soft.omega = Math.PI / CONTACT_T;
  const lnE = Math.log(c.p.eBall);
  soft.zeta = -lnE / Math.sqrt(Math.PI * Math.PI + lnE * lnE);
  soft.events = c.events;
  const live = balls.filter((b) => b.onTable && !b.z && !b.vz);
  const touching = new Set<number>();
  for (let it = 0; it < 8000; it++) {
    const active = softPass(live, touching);
    for (const b of live) {
      b.x += b.vx * MICRO_DT;
      b.y += b.vy * MICRO_DT;
    }
    if (!active) break;
  }
  soft.events = null;
  // Rolling spin no longer matches the new velocities: let cloth friction sort it out.
}

function nearestOpenPocket(w: SimWorld, b: Ball): number {
  const closed = w.closedPockets;
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < w.table.pockets.length; i++) {
    if (closed && closed.includes(i)) continue;
    const d = Math.hypot(b.x - w.table.pockets[i].x, b.y - w.table.pockets[i].y);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

function pocketBall(b: Ball, pocket: number, events: PhysEvent[] | null) {
  const speed = Math.hypot(b.vx, b.vy);
  b.onTable = false;
  b.vx = b.vy = b.wx = b.wy = b.wz = 0;
  b.z = b.vz = 0;
  if (events) events.push({ t: 'pocket', id: b.id, pocket, speed });
}

export function checkPockets(w: SimWorld, b: Ball, events: PhysEvent[] | null): boolean {
  if ((b.z ?? 0) > 0.003) return false;
  const t = w.table;
  if (t.pockets.length === 0) return false;
  const closed = w.closedPockets;
  for (let i = 0; i < t.pockets.length; i++) {
    if (closed && closed.includes(i)) continue;
    const pk = t.pockets[i];
    const dx = b.x - pk.x;
    const dy = b.y - pk.y;
    const r = pk.r * (w.captureScale ?? 1);
    if (dx * dx + dy * dy < r * r) {
      pocketBall(b, i, events);
      return true;
    }
  }
  // A ball that slipped past the cushion line can only be inside a pocket mouth.
  const ox = Math.abs(b.x) - t.L / 2;
  const oy = Math.abs(b.y) - t.W / 2;
  if (ox > t.R * 0.6 || oy > t.R * 0.6) {
    pocketBall(b, nearestOpenPocket(w, b), events);
    return true;
  }
  return false;
}

/** Distance to a finite cushion or obstacle. */
export function segmentDistance(x: number, y: number, s: { ax: number; ay: number; bx: number; by: number }): number {
  const dx = s.bx - s.ax, dy = s.by - s.ay;
  const u = Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - s.ax - u * dx, y - s.ay - u * dy);
}
