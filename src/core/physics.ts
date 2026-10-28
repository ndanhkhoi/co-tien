import type { TableGeom } from './table';

// Rigid-sphere pool physics with sliding/rolling friction, three-axis spin, cushion
// english transfer and cut-induced throw. Component cross products use a frame with
// z toward the viewer; the bottom contact point is (0, 0, -R).

export interface Ball {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  /** Height above resting centre and vertical velocity (metres, m/s). */
  z?: number; vz?: number;
  /** Angular velocity (rad/s). */
  wx: number; wy: number; wz: number;
  onTable: boolean;
}

export interface PhysParams {
  g: number;
  muSlide: number;
  muRoll: number;
  /** Deceleration of vertical-axis spin (rad/s²). */
  spinDecel: number;
  eBall: number;
  eCushion: number;
  muCushion: number;
  muBall: number;
}

export const DEFAULT_PHYS: PhysParams = {
  g: 9.81,
  muSlide: 0.2,
  muRoll: 0.011,
  spinDecel: 38,
  eBall: 0.94,
  eCushion: 0.82,
  muCushion: 0.17,
  muBall: 0.055,
};

export type PhysEvent =
  | { t: 'ball'; a: number; b: number; speed: number; x: number; y: number }
  | { t: 'cushion'; id: number; speed: number; x: number; y: number }
  | { t: 'off-table'; id: number; speed: number }
  | { t: 'pocket'; id: number; pocket: number; speed: number };

/**
 * Land effects ("Thiên Tượng") as plain mechanics. Forces act only on rolling balls and stay
 * below rolling resistance, so a resting ball stays put, as on a real slightly tilted table.
 */
export interface Terrain {
  /** Uniform acceleration on moving balls (table tilt g·sinθ, or wind), m/s². */
  force?: { x: number; y: number };
  /** Gusts: the force is scaled by (1 − amp + amp·sin(ω·t)). */
  gust?: { amp: number; omega: number };
  /** Friction patches (snow, sand, poison puddles): multipliers inside the circle. */
  patches?: { x: number; y: number; r: number; roll: number; slide: number; spin?: number }[];
  forces?: { x: number; y: number; region?: { x: number; y: number; r: number }; gust?: { amp: number; omega: number } }[];
  vortices?: { x: number; y: number; r: number; a: number; sense: number }[];
  rails?: { ax: number; ay: number; bx: number; by: number; multiplier: number }[];
  /** Point attractors (m/s² at the centre, fading to 0 at radius r). */
  wells?: { x: number; y: number; r: number; a: number }[];
}

export interface SimWorld {
  table: TableGeom;
  balls: Ball[];
  params: PhysParams;
  /** Pockets that currently act as closed (mutator). Index into table.pockets. */
  closedPockets?: number[];
  /** Extra segments (e.g. closed pocket mouths). */
  extraSegments?: { ax: number; ay: number; bx: number; by: number }[];
  /** Pocket capture radius multiplier (skills that widen the pockets). */
  captureScale?: number;
  /** Acceleration (m/s²) pulling slow object balls near an open pocket into it. */
  pocketPull?: number;
  /** Ball id the pull ignores (the shooter's cue ball). */
  pullExempt?: number;
  terrain?: Terrain | null;
  /** Simulation clock for time-varying terrain (s). */
  time?: number;
}

const STOP_V = 0.004;
const STOP_W = 0.6;

export function makeBall(id: number, x: number, y: number): Ball {
  return { id, x, y, z: 0, vz: 0, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, onTable: true };
}

export function cloneBalls(balls: Ball[]): Ball[] {
  return balls.map((b) => ({ ...b }));
}

export function isMoving(b: Ball): boolean {
  return b.onTable && ((b.z ?? 0) > 0 || (b.vz ?? 0) !== 0 || Math.abs(b.vx) > 0 || Math.abs(b.vy) > 0 || Math.abs(b.wz) > 0 || Math.abs(b.wx) > 0 || Math.abs(b.wy) > 0);
}

export function anyMoving(balls: Ball[]): boolean {
  for (const b of balls) if (isMoving(b)) return true;
  return false;
}

/** Cloth friction for one ball over dt. */
function applyCloth(b: Ball, R: number, p: PhysParams, dt: number, slideK = 1, rollK = 1) {
  // Contact point slip velocity.
  const cx = b.vx - R * b.wy;
  const cy = b.vy + R * b.wx;
  const slip = Math.hypot(cx, cy);
  const speed = Math.hypot(b.vx, b.vy);
  if (slip > 1e-3) {
    const ux = cx / slip;
    const uy = cy / slip;
    const a = p.muSlide * slideK * p.g;
    // Slip shrinks at 3.5·μg; snap to rolling instead of overshooting.
    if (3.5 * a * dt >= slip) {
      const k = slip / 3.5; // velocity change magnitude that zeroes slip
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
  } else if (speed > 0) {
    const dv = p.muRoll * rollK * p.g * dt;
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
  } else {
    b.wx = 0;
    b.wy = 0;
  }
  if (b.wz !== 0) {
    const dw = p.spinDecel * dt;
    b.wz = Math.abs(b.wz) <= dw ? 0 : b.wz - Math.sign(b.wz) * dw;
  }
  if (Math.hypot(b.vx, b.vy) < STOP_V && Math.hypot(b.wx, b.wy) * R < STOP_V) {
    b.vx = b.vy = b.wx = b.wy = 0;
    if (Math.abs(b.wz) < STOP_W) b.wz = 0;
  }
}

/** Two-ball impulse with cut-induced throw. Assumes the balls are touching. */
function collideBalls(a: Ball, b: Ball, R: number, p: PhysParams, events: PhysEvent[] | null): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = (b.z ?? 0) - (a.z ?? 0);
  if (dz !== 0 || (a.vz ?? 0) !== 0 || (b.vz ?? 0) !== 0) {
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

/** Gap under which balls count as frozen together (racks, clusters). */
const FROZEN = 2.5e-4;

function clusterSize(balls: Ball[], seed: Ball, D: number): number {
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

// Soft contact: ~120 µs Hertz-like contact time, damping tuned so e ≈ eBall.
const CONTACT_T = 1.2e-4;
const MICRO_DT = CONTACT_T / 40;

/**
 * Simultaneous impacts in frozen clusters (the break). Contacts are integrated as stiff
 * damped springs over microsecond steps, so impulse propagates through the rack
 * symmetrically and energy is conserved apart from the restitution loss.
 */
function softImpact(balls: Ball[], R: number, p: PhysParams, events: PhysEvent[] | null) {
  const D = 2 * R;
  const omega = Math.PI / CONTACT_T;
  const lnE = Math.log(p.eBall);
  const zeta = -lnE / Math.sqrt(Math.PI * Math.PI + lnE * lnE);
  const live = balls.filter((b) => b.onTable && !b.z && !b.vz);
  const n = live.length;
  const touching = new Set<number>();
  for (let it = 0; it < 8000; it++) {
    let overlap = false;
    let approaching = false;
    for (let i = 0; i < n; i++) {
      const a = live[i];
      for (let k = i + 1; k < n; k++) {
        const b = live[k];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) > D + FROZEN || Math.abs(dy) > D + FROZEN) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= (D + FROZEN) * (D + FROZEN)) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        const key = a.id * 64 + b.id;
        if (d < D) {
          overlap = true;
          if (!touching.has(key)) {
            touching.add(key);
            if (events && vn > 0.01) events.push({ t: 'ball', a: a.id, b: b.id, speed: vn, x: a.x + nx * R, y: a.y + ny * R });
          }
          // Cap the depth so a bad placement can't turn the spring into an explosion.
          const f = 0.5 * (omega * omega * Math.min(D - d, 2e-4) + 2 * zeta * omega * vn) * MICRO_DT;
          if (f > 0) {
            a.vx -= f * nx; a.vy -= f * ny;
            b.vx += f * nx; b.vy += f * ny;
          }
        } else {
          touching.delete(key);
          if (vn > 1e-4) approaching = true;
        }
      }
    }
    for (const b of live) {
      b.x += b.vx * MICRO_DT;
      b.y += b.vy * MICRO_DT;
    }
    if (!overlap && !approaching) break;
  }
  // Rolling spin no longer matches the new velocities: let cloth friction sort it out.
}

function collideSegment(
  b: Ball, s: { ax: number; ay: number; bx: number; by: number }, R: number, p: PhysParams, events: PhysEvent[] | null,
): boolean {
  // A ball whose bottom clears the cushion top can leave the table.
  if ((b.z ?? 0) > 0.04) return false;
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
  // Restitution falls slightly with impact speed.
  const e = Math.max(0.66, p.eCushion - 0.018 * Math.min(-vn, 7));
  const Jn = -(1 + e) * vn;
  b.vx += Jn * nx;
  b.vy += Jn * ny;
  // English: slip between ball surface and cushion along the rail.
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
  // Cushion nose sits above centre and scrubs most of the follow/draw.
  b.wx *= 0.35;
  b.wy *= 0.35;
  if (events) events.push({ t: 'cushion', id: b.id, speed: -vn, x: qx, y: qy });
  return true;
}

function checkPockets(w: SimWorld, b: Ball, events: PhysEvent[] | null): boolean {
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
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < t.pockets.length; i++) {
      if (closed && closed.includes(i)) continue;
      const d = Math.hypot(b.x - t.pockets[i].x, b.y - t.pockets[i].y);
      if (d < bd) { bd = d; best = i; }
    }
    pocketBall(b, best, events);
    return true;
  }
  return false;
}

function pocketBall(b: Ball, pocket: number, events: PhysEvent[] | null) {
  const speed = Math.hypot(b.vx, b.vy);
  b.onTable = false;
  b.vx = b.vy = b.wx = b.wy = b.wz = 0;
  b.z = b.vz = 0;
  if (events) events.push({ t: 'pocket', id: b.id, pocket, speed });
}

/**
 * Advance the world by `dt` seconds using adaptive substeps (no ball travels more
 * than ~0.35 R per substep, so nothing tunnels). Returns true while anything moves.
 */
export function step(w: SimWorld, dt: number, events: PhysEvent[] | null): boolean {
  const R = w.table.R;
  const p = w.params;
  const balls = w.balls;
  let remaining = dt;
  let guard = 0;
  while (remaining > 1e-9) {
    let vmax = 0;
    for (const b of balls) {
      if (!b.onTable) continue;
      const v = Math.abs(b.vx) + Math.abs(b.vy) + Math.abs(b.vz ?? 0) + ((b.z ?? 0) > 0 ? 0.01 : 0);
      if (v > vmax) vmax = v;
    }
    if (vmax === 0) {
      let spinning = false;
      for (const b of balls) if (b.onTable && (b.wz !== 0 || b.wx !== 0 || b.wy !== 0)) spinning = true;
      if (!spinning) return false;
    }
    let h = Math.min(remaining, Math.max(1 / 4000, (0.35 * R) / Math.max(vmax, 1e-6)), 1 / 240);
    // Resolve a landing at its ballistic time rather than integrating through the bed.
    for (const b of balls) {
      if (!b.onTable) continue;
      const z = b.z ?? 0, vz = b.vz ?? 0;
      if (z > 0 || vz > 0) {
        const landing = (vz + Math.sqrt(vz * vz + 2 * p.g * z)) / p.g;
        if (landing > 1e-9) h = Math.min(h, landing);
      }
    }
    // Step exactly to the next ball-ball contact so balls never interpenetrate.
    let hitA: Ball | null = null;
    let hitB: Ball | null = null;
    const D = 2 * R;
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (!a.onTable) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (!b.onTable) continue;
        if (!isMoving(a) && !isMoving(b)) continue;
        const t = timeOfImpact(a, b, D, h);
        if (t < h) {
          h = t;
          hitA = a;
          hitB = b;
        }
      }
    }
    remaining -= h;
    if (++guard > 20000) remaining = 0;
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
    if (h > 0) {
      const tr = w.terrain;
      if (tr) applyTerrain(w, tr, h);
      for (const b of balls) {
        if (!b.onTable) continue;
        if ((b.z ?? 0) > 0 || (b.vz ?? 0) > 0) continue;
        let slideK = 1;
        let rollK = 1;
        let spinK = 1;
        if (tr?.patches) {
          for (const pa of tr.patches) {
            if ((b.x - pa.x) ** 2 + (b.y - pa.y) ** 2 < pa.r * pa.r) {
              slideK *= pa.slide;
              spinK *= pa.spin ?? 1;
              rollK *= pa.roll;
            }
          }
        }
        applyCloth(b, R, spinK === 1 ? p : { ...p, spinDecel: p.spinDecel * spinK }, h, slideK, rollK);
      }
      w.time = (w.time ?? 0) + h;
    }
    if (hitA && hitB) {
      const frozen = !(hitA.z || hitB.z || hitA.vz || hitB.vz) && (clusterSize(balls, hitA, D) > 2 || clusterSize(balls, hitB, D) > 2);
      if (frozen && Math.abs((hitA.vx - hitB.vx)) + Math.abs(hitA.vy - hitB.vy) > 0.3) softImpact(balls, R, p, events);
      else collideBalls(hitA, hitB, R, p, events);
    }
    if (w.pocketPull) applyPocketPull(w, h);
    for (const b of balls) {
      if (!b.onTable) continue;
      if (b.vx === 0 && b.vy === 0) continue;
      for (const s of w.table.segments) {
        let multiplier = 1;
        for (const rail of w.terrain?.rails ?? []) {
          if (segmentDistance(b.x, b.y, rail) <= R * 1.1) multiplier *= rail.multiplier;
        }
        collideSegment(b, s, R, multiplier === 1 ? p : { ...p, eCushion: Math.min(1, p.eCushion * multiplier) }, events);
      }
      if (w.extraSegments) for (const s of w.extraSegments) collideSegment(b, s, R, p, events);
      if ((b.z ?? 0) > 0 && (Math.abs(b.x) > w.table.L / 2 + R || Math.abs(b.y) > w.table.W / 2 + R)) {
        const speed = Math.hypot(b.vx, b.vy, b.vz ?? 0);
        b.onTable = false;
        b.vx = b.vy = b.wx = b.wy = b.wz = b.vz = b.z = 0;
        if (events) events.push({ t: 'off-table', id: b.id, speed });
      } else checkPockets(w, b, events);
    }
  }
  return anyMoving(balls);
}

function applyTerrain(w: SimWorld, tr: Terrain, h: number) {
  let fx = 0;
  let fy = 0;
  if (tr.force) {
    const k = tr.gust ? 1 - tr.gust.amp + tr.gust.amp * Math.sin(tr.gust.omega * (w.time ?? 0)) : 1;
    fx = tr.force.x * k;
    fy = tr.force.y * k;
  }
  for (const b of w.balls) {
    if (!b.onTable || (b.z ?? 0) > 0 || (b.vz ?? 0) > 0 || (b.vx === 0 && b.vy === 0)) continue;
    let ax = fx;
    let ay = fy;
    if (tr.wells) {
      for (const wl of tr.wells) {
        const dx = wl.x - b.x;
        const dy = wl.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d > wl.r || d < 1e-4) continue;
        const a = wl.a * (1 - d / wl.r);
        ax += (dx / d) * a;
        ay += (dy / d) * a;
      }
    }
    for (const f of tr.forces ?? []) {
      if (f.region && Math.hypot(b.x - f.region.x, b.y - f.region.y) > f.region.r) continue;
      const k = f.gust ? 1 - f.gust.amp + f.gust.amp * Math.sin(f.gust.omega * (w.time ?? 0)) : 1;
      ax += f.x * k; ay += f.y * k;
    }
    for (const v of tr.vortices ?? []) {
      const dx = b.x - v.x, dy = b.y - v.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < v.r) {
        const a = v.a * Math.sin(Math.PI * d / v.r) * v.sense;
        ax -= dy / d * a; ay += dx / d * a;
      }
    }
    // Bound against the smallest rolling coefficient anywhere, including overlapping patches.
    const minRoll = (tr.patches ?? []).reduce((k, p) => k * Math.min(1, p.roll), 1);
    const limit = 0.799 * w.params.muRoll * minRoll * w.params.g;
    const scale = Math.min(1, limit / (Math.hypot(ax, ay) || 1));
    ax *= scale; ay *= scale;
    // A force through the centre of a rolling ball; cloth friction then re-establishes rolling.
    b.vx += ax * h;
    b.vy += ay * h;
  }
}

/** Moving object balls within reach of an open pocket are drawn toward it. */
function applyPocketPull(w: SimWorld, h: number) {
  const reach = 0.16;
  for (const b of w.balls) {
    if (!b.onTable || (b.z ?? 0) > 0 || b.id === w.pullExempt || (b.vx === 0 && b.vy === 0)) continue;
    w.table.pockets.forEach((pk, i) => {
      if (w.closedPockets?.includes(i)) return;
      const dx = pk.x - b.x;
      const dy = pk.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d > reach || d < 1e-6) return;
      const a = w.pocketPull! * (1 - d / reach);
      b.vx += (dx / d) * a * h;
      b.vy += (dy / d) * a * h;
    });
  }
}

export interface StrikeParams {
  /** Aim direction (radians). */
  angle: number;
  /** Cue elevation in radians (0–75°). A downward legal strike rebounds from the slate. */
  elevation?: number;
  /** Cue-ball launch speed (m/s). */
  speed: number;
  /** Tip offset normalised to the miscue limit: side (−1 left … 1 right), vert (−1 draw … 1 follow). */
  side: number;
  vert: number;
}

/** Miscue limit as a fraction of R. */
export const TIP_LIMIT = 0.5;

/** The visible tip-contact circle foreshortens as the cue becomes steep.
 * Offset is measured in the existing face-on spin control; steep strokes therefore
 * need a much smaller offset to retain a predominantly normal, chalked contact.
 */
export function elevatedTipOffset(side: number, vert: number, elevation = 0): number {
  const angle = Math.max(0, Math.min(75 * Math.PI / 180, Number.isFinite(elevation) ? elevation : 0));
  return Math.hypot(side, vert) / Math.cos(angle);
}

/** Apply a cue strike to the cue ball. Includes squirt (deflection away from side english). */
export function strike(b: Ball, R: number, s: StrikeParams) {
  const squirt = -s.side * 0.022 * Math.min(1, s.speed / 3);
  const ang = s.angle + squirt;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const elevation = Math.max(0, Math.min(75 * Math.PI / 180, Number.isFinite(s.elevation) ? s.elevation! : 0));
  const horizontal = s.speed * Math.cos(elevation);
  b.vx = dx * horizontal;
  b.vy = dy * horizontal;
  b.z = 0;
  // An elevated cue drives down into the slate; restitution produces the jump.
  // Low cues retain ordinary play rather than bouncing on every stroke.
  const tipOffset = elevatedTipOffset(s.side, s.vert, elevation);
  // Tangential/off-centre impulse goes into spin instead of the slate rebound.
  // Outside the chalk contact envelope no controlled jump impulse is transferred.
  const normalTransfer = Math.max(0, 1 - tipOffset * tipOffset);
  b.vz = elevation > 10 * Math.PI / 180 ? s.speed * Math.sin(elevation) * 0.45 * normalTransfer : 0;
  // Off-centre hit: ω = 5·v·offset / (2R²). Natural roll at vert offset 0.4R.
  const k = (5 * s.speed) / (2 * R * R);
  const vertOff = s.vert * TIP_LIMIT * R;
  const sideOff = s.side * TIP_LIMIT * R;
  b.wx = -k * vertOff * dy;
  b.wy = k * vertOff * dx;
  b.wz = -k * sideOff;
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

/** Distance to a finite cushion or obstacle. */
export function segmentDistance(x: number, y: number, s: { ax: number; ay: number; bx: number; by: number }): number {
  const dx = s.bx - s.ax, dy = s.by - s.ay;
  const u = Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - s.ax - u * dx, y - s.ay - u * dy);
}
