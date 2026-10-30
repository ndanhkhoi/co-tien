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

interface ScoreRun {
  input: ScoreInput;
  feats: Map<string, number>;
  cue0?: Ball;
  cueRailsFirst: number;
  jumped: boolean;
}

function addFeat(feats: Map<string, number>, name: string, bonus: number) {
  feats.set(name, (feats.get(name) ?? 0) + bonus);
}

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

function cueRailsBeforeHit(events: PhysEvent[], cueId: number): number {
  const cueHits = events.findIndex((e) => e.t === 'ball' && (e.a === cueId || e.b === cueId));
  return events.slice(0, cueHits < 0 ? events.length : cueHits)
    .filter((e) => e.t === 'cushion' && e.id === cueId).length;
}

function secondCueContact(events: PhysEvent[], cueId: number): number {
  const met = new Set<number>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.t !== 'ball' || (e.a !== cueId && e.b !== cueId)) continue;
    met.add(e.a === cueId ? e.b : e.a);
    if (met.size === 2) return i;
  }
  return events.length;
}

function scorePocketedBall(run: ScoreRun, id: number) {
  const s = run.input;
  const ev = s.events;
  const sunk = ev.findIndex((e) => e.t === 'pocket' && e.id === id);
  const upTo = sunk < 0 ? ev : ev.slice(0, sunk);
  const firstTouch = upTo.find((e) => e.t === 'ball' && (e.a === id || e.b === id));
  const banks = upTo.filter((e) => e.t === 'cushion' && e.id === id).length;
  if (banks) addFeat(run.feats, banks > 1 ? 'Hai băng' : 'Bi băng', Math.min(2, banks) * 0.9);
  if (firstTouch?.t !== 'ball') return;
  const hitter = firstTouch.a === id ? firstTouch.b : firstTouch.a;
  if (hitter !== s.cueId) {
    addFeat(run.feats, 'Bi kết', 1);
    return;
  }
  if (run.cueRailsFirst > 0) {
    addFeat(run.feats, 'Gỡ băng', 1);
    return;
  }
  scoreDirectPot(run, id, firstTouch, sunk);
}

function scoreDirectPot(run: ScoreRun, id: number, firstTouch: Extract<PhysEvent, { t: 'ball' }>, sunk: number) {
  const s = run.input;
  const ev = s.events;
  // Direct pot: the cut angle between the cue ball's path and the line of centres.
  const obj = s.before.find((b) => b.id === id);
  if (!obj || !run.cue0) return;
  const cue0 = run.cue0;
  const nx = obj.x - firstTouch.x;
  const ny = obj.y - firstTouch.y;
  const nl = Math.hypot(nx, ny) || 1;
  const gx = firstTouch.x - (nx / nl) * s.table.R;
  const gy = firstTouch.y - (ny / nl) * s.table.R;
  const ax = gx - cue0.x;
  const ay = gy - cue0.y;
  const al = Math.hypot(ax, ay);
  if (al < 1e-6) return;
  // A jump only counts when the cue ball really had to clear a ball lying across its path.
  if (run.jumped && s.before.some((b) => b.onTable && b.id !== id && b.id !== s.cueId && crosses(cue0, { x: gx, y: gy }, b, 2 * s.table.R))) addFeat(run.feats, 'Nhảy bi', 1.2);
  const cut = Math.acos(Math.max(-1, Math.min(1, (ax * nx + ay * ny) / (al * nl)))) * DEG;
  if (cut >= 50) addFeat(run.feats, 'Cắt mỏng', cut >= 65 ? 1.1 : 0.8);
  else if (cut >= 30) addFeat(run.feats, '', 0.3);
  // Long shot: cue ball travel plus the object ball's run to the pocket.
  const pocket = sunk >= 0 ? ev[sunk] : null;
  const pk = pocket?.t === 'pocket' ? s.table.pockets[pocket.pocket] : null;
  const runLength = al + (pk ? Math.hypot(pk.x - obj.x, pk.y - obj.y) : 0);
  if (runLength > s.table.L * 0.8) addFeat(run.feats, 'Cú xa', 0.4);
}

function scoreCarom(run: ScoreRun) {
  const s = run.input;
  const ev = s.events;
  const second = secondCueContact(ev, s.cueId);
  const rails = ev.slice(0, second).filter((e) => e.t === 'cushion' && e.id === s.cueId).length;
  if (rails >= 3) addFeat(run.feats, 'Ba băng', 0.6 + Math.min(2, rails - 3) * 0.3);
  else if (rails >= 1) addFeat(run.feats, '', 0.25 * rails);
  if (run.cueRailsFirst > 0) addFeat(run.feats, 'Gỡ băng', 0.6);
}

function finishScore(count: number, feats: Map<string, number>): ShotScore {
  const bonus = [...feats.values()].reduce((a, b) => a + b, 0);
  const names = [...feats.entries()].filter(([n]) => n).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const per = bonus / count;
  return { count, value: count + bonus, names, tier: per >= 1.2 ? 2 : per >= 0.5 ? 1 : 0 };
}

export function scoreShot(s: ScoreInput): ShotScore {
  const count = s.counted.length + s.points;
  if (!count) return NO_SCORE;
  if (s.isBreak) return { count, value: count, names: [], tier: 0 };
  const run: ScoreRun = {
    input: s,
    feats: new Map<string, number>(),
    cue0: s.before.find((b) => b.id === s.cueId),
    cueRailsFirst: cueRailsBeforeHit(s.events, s.cueId),
    jumped: s.elevation > 10 / DEG,
  };
  for (const id of s.counted) scorePocketedBall(run, id);
  if (s.points) scoreCarom(run);
  if (s.counted.length >= 2) addFeat(run.feats, s.counted.length >= 3 ? `Ăn ${s.counted.length} bi` : 'Ăn đôi', 0.3 * (s.counted.length - 1));
  return finishScore(count, run.feats);
}
