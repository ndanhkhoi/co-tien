import { canPlaceCue } from '../../core/rack';
import type { Ball } from '../../core/physics';
import { other, type Side } from '../../core/rules/types';
import type { Match } from './match';

function legalObjectSpot(m: Match, id: number, from: Ball): { x: number; y: number } | null {
  const toward = { x: from.x * 0.4, y: from.y * 0.4 };
  const step = 0.035;
  for (let ring = 0; ring <= 24; ring++) {
    const r = ring * step;
    const turns = ring === 0 ? 1 : Math.max(6, Math.round(ring * 2.4));
    for (let i = 0; i < turns; i++) {
      const a = (i / turns) * Math.PI * 2;
      const q = { x: toward.x + Math.cos(a) * r, y: toward.y + Math.sin(a) * r };
      if (canPlaceCue({ table: m.table, balls: m.balls, cueId: id, kitchen: false }, q.x, q.y)) return q;
    }
  }
  return null;
}

function pocketDistance(m: Match, b: Ball): number {
  return Math.min(...m.table.pockets.map((p) => Math.hypot(b.x - p.ax, b.y - p.ay)));
}

/** Dời Bi: only opponent legal balls hanging at a pocket, moved while every ball rests. */
export function displaceBalls(m: Match, side: Side, count: number): { id: number; from: { x: number; y: number }; to: { x: number; y: number } }[] {
  const opp = other(side);
  const targets = m.legalTargets(opp).filter((id) => id !== m.cueId(opp));
  const moved: ReturnType<typeof displaceBalls> = [];
  for (const b of m.balls
    .filter((b) => b.onTable && targets.includes(b.id))
    .sort((a, b) => pocketDistance(m, a) - pocketDistance(m, b))
    .slice(0, count)) {
    const spot = legalObjectSpot(m, b.id, b);
    if (!spot) continue;
    const from = { x: b.x, y: b.y };
    Object.assign(b, spot);
    moved.push({ id: b.id, from, to: spot });
  }
  return moved;
}

/** Đổi Bi: exchange the caster's hardest legal ball with the opponent's easiest legal ball. */
export function swapBalls(m: Match, side: Side): { balls: [number, number]; at: [{ x: number; y: number }, { x: number; y: number }] } | null {
  const opp = other(side);
  const own = legalBall(m, side);
  const foe = legalBall(m, opp);
  if (!own || !foe) return null;
  const at: [{ x: number; y: number }, { x: number; y: number }] = [{ x: own.x, y: own.y }, { x: foe.x, y: foe.y }];
  const first = { x: own.x, y: own.y };
  Object.assign(own, { x: foe.x, y: foe.y });
  Object.assign(foe, first);
  return { balls: [own.id, foe.id], at };
}

function legalBall(m: Match, side: Side): Ball | undefined {
  const cue = m.cueId(side);
  const ids = m.legalTargets(side).filter((id) => id !== cue);
  return m.balls
    .filter((b) => b.onTable && ids.includes(b.id))
    .sort((a, b) => pocketDistance(m, b) - pocketDistance(m, a))[0];
}

/** Bi Giả: fixed circular obstacles that look like object balls to both players. */
export function decoySegments(m: Match, side: Side, count: number) {
  const opp = other(side);
  const cue = m.cueId(opp);
  const ids = m.legalTargets(opp).filter((id) => id !== cue);
  const targets = m.balls.filter((b) => b.onTable && ids.includes(b.id));
  const spots: { x: number; y: number }[] = [];
  for (const target of targets) {
    for (let i = 0; i < 12 && spots.length < count; i++) {
      const a = (i / 12) * Math.PI * 2 + m.rng.next() * 0.4;
      const r = m.table.R * 4.2;
      const q = { x: target.x + Math.cos(a) * r, y: target.y + Math.sin(a) * r };
      if (canPlaceCue({ table: m.table, balls: m.balls, cueId: cue, kitchen: false }, q.x, q.y)) spots.push(q);
    }
  }
  return spots.map((p) => polygon(p, m.table.R));
}

/** A fixed circle as polygon segments, shared by real play, prediction and AI. */
function polygon(p: { x: number; y: number }, r: number) {
  const count = 12;
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    const b = ((i + 1) / count) * Math.PI * 2;
    return { ax: p.x + Math.cos(a) * r, ay: p.y + Math.sin(a) * r, bx: p.x + Math.cos(b) * r, by: p.y + Math.sin(b) * r };
  });
}
