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

function addForces(forces: NonNullable<Terrain['forces']>, time: number, b: Ball, quake = false) {
  for (const f of forces) {
    if (f.window && (time < f.window.start || time > f.window.start + f.window.duration)) continue;
    if (f.window && quake) continue;
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
  const gust = tr.gust;
  const gustK = gust ? gustScale(gust, w.time ?? 0) : 1;
  const quake = unclampedForce(tr, w.time ?? 0);
  for (const b of w.balls) {
    if (resting(b, !!quake)) continue;
    accel.x = tr.force ? tr.force.x * gustK : 0;
    accel.y = tr.force ? tr.force.y * gustK : 0;
    if (tr.wells) addWells(tr.wells, b);
    addForces(tr.forces ?? [], w.time ?? 0, b, !!quake);
    addVortices(tr.vortices ?? [], b);
    clampAcceleration(w, tr);
    if (quake) {
      accel.x += quake.x;
      accel.y += quake.y;
    }
    // A force through the centre of a rolling ball; cloth friction then re-establishes rolling.
    b.vx += accel.x * h;
    b.vy += accel.y * h;
  }
}

function resting(b: Ball, quake: boolean): boolean {
  return !b.onTable || (b.z ?? 0) > 0 || (b.vz ?? 0) > 0 || (b.vx === 0 && b.vy === 0 && !quake);
}

/** The one force exempt from rolling-resistance clamping, while its time window is open. */
function unclampedForce(tr: Terrain, time: number) {
  if (!tr.unclamped) return null;
  return (tr.forces ?? []).find((f) => f.window && time >= f.window.start && time <= f.window.start + f.window.duration) ?? null;
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
