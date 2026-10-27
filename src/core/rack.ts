import { makeBall, type Ball } from './physics';
import type { Rng } from './rng';
import type { TableGeom } from './table';

/**
 * Slots of a tight rack, rows growing toward the foot rail. `spotRow` is the row whose
 * centre sits on the foot spot (0 = apex on the spot).
 */
function rackSlots(t: TableGeom, rows: number[], spotRow = 0): { x: number; y: number }[][] {
  const r = t.R + 0.00001; // hair gap so the frozen rack doesn't start pre-compressed
  const dx = Math.sqrt(3) * r;
  return rows.map((n, i) => {
    const out: { x: number; y: number }[] = [];
    for (let j = 0; j < n; j++) out.push({ x: t.footSpot.x + (i - spotRow) * dx, y: (j - (n - 1) / 2) * 2 * r });
    return out;
  });
}

/** Tiny random jitter so no two racks break identically (real racks are never perfect). */
function jitter(b: Ball, rng: Rng) {
  b.x += rng.range(-0.00006, 0.00006);
  b.y += rng.range(-0.00006, 0.00006);
}

export function cueBallAtHead(t: TableGeom, rng: Rng): Ball {
  return makeBall(0, t.headStringX - rng.range(0.03, 0.12), rng.range(-0.18, 0.18));
}

/**
 * WPA 8-ball: 15-ball triangle, apex on the foot spot, 8 in the centre of the third row,
 * one solid and one stripe in the two back corners, everything else random.
 */
export function rackEight(t: TableGeom, rng: Rng): Ball[] {
  const slots = rackSlots(t, [1, 2, 3, 4, 5]);
  const solids = rng.shuffle([1, 2, 3, 4, 5, 6, 7]);
  const stripes = rng.shuffle([9, 10, 11, 12, 13, 14, 15]);
  const solidLeft = rng.next() < 0.5;
  const ids: (number | null)[][] = slots.map((row) => row.map(() => null));
  ids[2][1] = 8;
  ids[4][0] = solidLeft ? solids.pop()! : stripes.pop()!;
  ids[4][4] = solidLeft ? stripes.pop()! : solids.pop()!;
  const rest = rng.shuffle([...solids, ...stripes]);
  const balls: Ball[] = [];
  slots.forEach((row, i) => row.forEach((s, j) => {
    const id = ids[i][j] ?? rest.pop()!;
    const b = makeBall(id, s.x, s.y);
    jitter(b, rng);
    balls.push(b);
  }));
  return [cueBallAtHead(t, rng), ...balls];
}

/** WPA 9-ball: diamond, 1 at the apex toward the head, 9 in the centre on the foot spot, others random. */
export function rackNine(t: TableGeom, rng: Rng): Ball[] {
  const slots = rackSlots(t, [1, 2, 3, 2, 1], 2);
  const rest = rng.shuffle([2, 3, 4, 5, 6, 7, 8]);
  const balls: Ball[] = [];
  slots.forEach((row, i) => row.forEach((s, j) => {
    const id = i === 0 ? 1 : i === 2 && j === 1 ? 9 : rest.pop()!;
    const b = makeBall(id, s.x, s.y);
    jitter(b, rng);
    balls.push(b);
  }));
  return [cueBallAtHead(t, rng), ...balls];
}

/** WPA 10-ball: triangle of ten, 1 at the apex on the foot spot, 10 in the centre of the third row. */
export function rackTen(t: TableGeom, rng: Rng): Ball[] {
  const slots = rackSlots(t, [1, 2, 3, 4]);
  const rest = rng.shuffle([2, 3, 4, 5, 6, 7, 8, 9]);
  const balls: Ball[] = [];
  slots.forEach((row, i) => row.forEach((s, j) => {
    const id = i === 0 ? 1 : i === 2 && j === 1 ? 10 : rest.pop()!;
    const b = makeBall(id, s.x, s.y);
    jitter(b, rng);
    balls.push(b);
  }));
  return [cueBallAtHead(t, rng), ...balls];
}

/**
 * Respot an object ball on the foot spot; if blocked, as close as possible behind it
 * on the long string toward the foot rail, then in front of it toward the head.
 */
export function respot(t: TableGeom, balls: Ball[], id: number) {
  const b = balls.find((x) => x.id === id);
  if (!b) return;
  const free = (x: number, y: number) =>
    balls.every((o) => o === b || !o.onTable || Math.hypot(o.x - x, o.y - y) >= 2 * t.R + 1e-4);
  const y = t.footSpot.y;
  const limit = t.L / 2 - t.R;
  let x = t.footSpot.x;
  for (let k = 0; k < 400 && !free(x, y); k++) x += 0.002;
  if (x > limit || !free(x, y)) {
    x = t.footSpot.x;
    for (let k = 0; k < 800 && !free(x, y); k++) x -= 0.002;
  }
  Object.assign(b, { x, y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, onTable: true });
}

/** Is a cue-ball position legal for ball in hand? */
export function canPlaceCue(t: TableGeom, balls: Ball[], cueId: number, x: number, y: number, kitchen: boolean): boolean {
  if (Math.abs(x) > t.L / 2 - t.R || Math.abs(y) > t.W / 2 - t.R) return false;
  if (kitchen && x > t.headStringX) return false;
  for (const o of balls) {
    if (o.id === cueId || !o.onTable) continue;
    if (Math.hypot(o.x - x, o.y - y) < 2 * t.R + 1e-4) return false;
  }
  return true;
}

/** Nearest legal cue-ball spot to (x, y) by spiral search. */
export function nearestCueSpot(t: TableGeom, balls: Ball[], cueId: number, x: number, y: number, kitchen: boolean) {
  const lx = t.L / 2 - t.R - 1e-4;
  const ly = t.W / 2 - t.R - 1e-4;
  const cx = Math.max(-lx, Math.min(kitchen ? t.headStringX : lx, x));
  const cy = Math.max(-ly, Math.min(ly, y));
  if (canPlaceCue(t, balls, cueId, cx, cy, kitchen)) return { x: cx, y: cy };
  for (let r = 0.005; r < 1.2; r += 0.005) {
    for (let a = 0; a < 24; a++) {
      const px = cx + Math.cos((a / 24) * Math.PI * 2) * r;
      const py = cy + Math.sin((a / 24) * Math.PI * 2) * r;
      if (canPlaceCue(t, balls, cueId, px, py, kitchen)) return { x: px, y: py };
    }
  }
  return { x: cx, y: cy };
}
