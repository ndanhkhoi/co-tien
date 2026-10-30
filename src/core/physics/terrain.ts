import type { Ball, SimWorld, Terrain } from './types';

const accel = { x: 0, y: 0 };

function gustScale(gust: { amp: number; omega: number }, time: number): number {
  return 1 - gust.amp + gust.amp * Math.sin(gust.omega * time);
}

function addWells(wells: NonNullable<Terrain['wells']>, b: Ball) {
  for (const wl of wells) {
    const dx = wl.x - b.x;
    const dy = wl.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d > wl.r || d < 1e-4) continue;
    const a = wl.a * (1 - d / wl.r);
    accel.x += (dx / d) * a;
    accel.y += (dy / d) * a;
  }
}

function addForces(forces: NonNullable<Terrain['forces']>, time: number, b: Ball) {
  for (const f of forces) {
    if (f.region && Math.hypot(b.x - f.region.x, b.y - f.region.y) > f.region.r) continue;
    const k = f.gust ? gustScale(f.gust, time) : 1;
    accel.x += f.x * k;
    accel.y += f.y * k;
  }
}

function addVortices(vortices: NonNullable<Terrain['vortices']>, b: Ball) {
  for (const v of vortices) {
    const dx = b.x - v.x, dy = b.y - v.y, d = Math.hypot(dx, dy);
    if (d > 0 && d < v.r) {
      const a = v.a * Math.sin(Math.PI * d / v.r) * v.sense;
      accel.x -= dy / d * a;
      accel.y += dx / d * a;
    }
  }
}

function smallestRoll(patches: Terrain['patches']): number {
  let minRoll = 1;
  if (!patches) return minRoll;
  for (const p of patches) minRoll *= Math.min(1, p.roll);
  return minRoll;
}

function clampAcceleration(w: SimWorld, tr: Terrain) {
  // Bound against the smallest rolling coefficient anywhere, including overlapping patches.
  const limit = 0.799 * w.params.muRoll * smallestRoll(tr.patches) * w.params.g;
  const scale = Math.min(1, limit / (Math.hypot(accel.x, accel.y) || 1));
  accel.x *= scale;
  accel.y *= scale;
}

export function applyTerrain(w: SimWorld, tr: Terrain, h: number) {
  let fx = 0;
  let fy = 0;
  if (tr.force) {
    const k = tr.gust ? gustScale(tr.gust, w.time ?? 0) : 1;
    fx = tr.force.x * k;
    fy = tr.force.y * k;
  }
  for (const b of w.balls) {
    if (!b.onTable || (b.z ?? 0) > 0 || (b.vz ?? 0) > 0 || (b.vx === 0 && b.vy === 0)) continue;
    accel.x = fx;
    accel.y = fy;
    if (tr.wells) addWells(tr.wells, b);
    addForces(tr.forces ?? [], w.time ?? 0, b);
    addVortices(tr.vortices ?? [], b);
    clampAcceleration(w, tr);
    // A force through the centre of a rolling ball; cloth friction then re-establishes rolling.
    b.vx += accel.x * h;
    b.vy += accel.y * h;
  }
}

/** Moving object balls within reach of an open pocket are drawn toward it. */
export function applyPocketPull(w: SimWorld, h: number) {
  const reach = 0.16;
  for (const b of w.balls) {
    if (!b.onTable || (b.z ?? 0) > 0 || b.id === w.pullExempt || (b.vx === 0 && b.vy === 0)) continue;
    const pockets = w.table.pockets;
    for (let i = 0; i < pockets.length; i++) {
      if (w.closedPockets?.includes(i)) continue;
      const pk = pockets[i];
      const dx = pk.x - b.x;
      const dy = pk.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d > reach || d < 1e-6) continue;
      const a = w.pocketPull! * (1 - d / reach);
      b.vx += (dx / d) * a * h;
      b.vy += (dy / d) * a * h;
    }
  }
}
