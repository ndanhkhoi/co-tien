import type { Ball, PhysEvent } from './physics';
import type { TableGeom } from './table';

/**
 * How hard and how pretty a scoring shot was. Every counted ball or carom point is worth 1; a
 * thin cut, a bank, a combination, a kick, a jump or a long shot adds to it. Energy and Ảnh Sát's
 * run are paid in this value, so a well-made shot outweighs a string of hangers.
 */
export interface ShotScore {
  /** Balls or points the shot counted. */
  count: number;
  /** count plus every difficulty bonus. */
  value: number;
  /** Named feats, most notable first ("Cắt mỏng", "Bi băng"…). */
  names: string[];
  /** 0 plain, 1 đẹp, 2 tuyệt: the extra value per counted ball. */
  tier: 0 | 1 | 2;
}

export interface ScoreInput {
  table: TableGeom;
  /** Balls as they rested before the shot. */
  before: Ball[];
  events: PhysEvent[];
  cueId: number;
  /** Pool: the pocketed balls the rules counted for the shooter. */
  counted: number[];
  /** Carom: points the shot scored. */
  points: number;
  isBreak: boolean;
  /** Cue elevation of the stroke, radians. */
  elevation: number;
}

export const NO_SCORE: ShotScore = { count: 0, value: 0, names: [], tier: 0 };

const DEG = 180 / Math.PI;

/** Does point `p` lie within `r` of the segment a→b (strictly between its ends)? */
function crosses(a: { x: number; y: number }, b: { x: number; y: number }, p: { x: number; y: number }, r: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (!len2) return false;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  if (t <= 0 || t >= 1) return false;
  return Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y) < r;
}

export function scoreShot(s: ScoreInput): ShotScore {
  const count = s.counted.length + s.points;
  if (!count) return NO_SCORE;
  if (s.isBreak) return { count, value: count, names: [], tier: 0 };
  const feats = new Map<string, number>();
  const feat = (name: string, bonus: number) => feats.set(name, (feats.get(name) ?? 0) + bonus);
  const ev = s.events;
  const cue0 = s.before.find((b) => b.id === s.cueId);
  const cueHits = ev.findIndex((e) => e.t === 'ball' && (e.a === s.cueId || e.b === s.cueId));
  const cueRailsFirst = ev.slice(0, cueHits < 0 ? ev.length : cueHits).filter((e) => e.t === 'cushion' && e.id === s.cueId).length;
  const jumped = s.elevation > 10 / DEG;

  for (const id of s.counted) {
    const sunk = ev.findIndex((e) => e.t === 'pocket' && e.id === id);
    const upTo = sunk < 0 ? ev : ev.slice(0, sunk);
    const firstTouch = upTo.find((e) => e.t === 'ball' && (e.a === id || e.b === id));
    const banks = upTo.filter((e) => e.t === 'cushion' && e.id === id).length;
    if (banks) feat(banks > 1 ? 'Hai băng' : 'Bi băng', Math.min(2, banks) * 0.9);
    if (firstTouch?.t !== 'ball') continue;
    const hitter = firstTouch.a === id ? firstTouch.b : firstTouch.a;
    if (hitter !== s.cueId) {
      feat('Bi kết', 1);
      continue;
    }
    if (cueRailsFirst > 0) {
      feat('Gỡ băng', 1);
      continue;
    }
    // Direct pot: the cut angle between the cue ball's path and the line of centres.
    const obj = s.before.find((b) => b.id === id);
    if (!obj || !cue0) continue;
    const nx = obj.x - firstTouch.x;
    const ny = obj.y - firstTouch.y;
    const nl = Math.hypot(nx, ny) || 1;
    const gx = firstTouch.x - (nx / nl) * s.table.R;
    const gy = firstTouch.y - (ny / nl) * s.table.R;
    const ax = gx - cue0.x;
    const ay = gy - cue0.y;
    const al = Math.hypot(ax, ay);
    if (al < 1e-6) continue;
    // A jump only counts when the cue ball really had to clear a ball lying across its path.
    if (jumped && s.before.some((b) => b.onTable && b.id !== id && b.id !== s.cueId && crosses(cue0, { x: gx, y: gy }, b, 2 * s.table.R))) feat('Nhảy bi', 1.2);
    const cut = Math.acos(Math.max(-1, Math.min(1, (ax * nx + ay * ny) / (al * nl)))) * DEG;
    if (cut >= 50) feat('Cắt mỏng', cut >= 65 ? 1.1 : 0.8);
    else if (cut >= 30) feat('', 0.3);
    // Long shot: cue ball travel plus the object ball's run to the pocket.
    const pocket = sunk >= 0 ? ev[sunk] : null;
    const pk = pocket?.t === 'pocket' ? s.table.pockets[pocket.pocket] : null;
    const run = al + (pk ? Math.hypot(pk.x - obj.x, pk.y - obj.y) : 0);
    if (run > s.table.L * 0.8) feat('Cú xa', 0.4);
  }

  if (s.points) {
    // Carom: cushions the cue ball took before its second ball.
    const second = (() => {
      const met = new Set<number>();
      for (let i = 0; i < ev.length; i++) {
        const e = ev[i];
        if (e.t !== 'ball' || (e.a !== s.cueId && e.b !== s.cueId)) continue;
        met.add(e.a === s.cueId ? e.b : e.a);
        if (met.size === 2) return i;
      }
      return ev.length;
    })();
    const rails = ev.slice(0, second).filter((e) => e.t === 'cushion' && e.id === s.cueId).length;
    if (rails >= 3) feat('Ba băng', 0.6 + Math.min(2, rails - 3) * 0.3);
    else if (rails >= 1) feat('', 0.25 * rails);
    if (cueRailsFirst > 0) feat('Gỡ băng', 0.6);
  }
  if (s.counted.length >= 2) feat(s.counted.length >= 3 ? `Ăn ${s.counted.length} bi` : 'Ăn đôi', 0.3 * (s.counted.length - 1));

  const bonus = [...feats.values()].reduce((a, b) => a + b, 0);
  const names = [...feats.entries()].filter(([n]) => n).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const per = bonus / count;
  return { count, value: count + bonus, names, tier: per >= 1.2 ? 2 : per >= 0.5 ? 1 : 0 };
}
