import { speedToPower } from '../core/cue-power';
import { canPlaceCue } from '../core/rack';
import type { TableGeom } from '../core/table';
import type { Ball, PhysEvent } from '../core/physics';
import type { AiShot } from './types';
import { bankLines, judge, potLines } from './shot-lines';
import { play, type Ctx, type Outcome, type Plan } from './search-context';

const DEG = Math.PI / 180;

function speedFor(dist: number, ctx: Ctx): number {
  // Enough to roll the distance with margin; firmer when the cloth is fast.
  const mu = ctx.params.muRoll;
  return Math.sqrt(2 * mu * 9.81 * dist * 1.25) + 0.55;
}

interface Stroke {
  angle: number;
  speed: number;
  side?: number;
  vert?: number;
}

export function makeShot(stroke: Stroke, ctx: Ctx, extra: Partial<AiShot> = {}): AiShot {
  return {
    angle: stroke.angle,
    power: speedToPower(Math.min(stroke.speed, ctx.req.maxSpeed), ctx.req.maxSpeed),
    side: stroke.side ?? 0,
    vert: stroke.vert ?? 0,
    call: null,
    pushOut: false,
    ...extra,
  };
}

function variants(ctx: Ctx): { mul: number; side: number; vert: number }[] {
  const pers = ctx.req.profile.personality;
  const all = [
    { mul: 1.35, side: 0, vert: 0 },
    { mul: 1.9, side: 0, vert: -0.55 },
    { mul: 1.6, side: 0, vert: 0.5 },
    { mul: 2.6, side: 0, vert: 0 },
    { mul: 1.1, side: 0, vert: 0.3 },
    { mul: 2.2, side: 0, vert: -0.85 },
    { mul: 1.7, side: 0.55, vert: 0.2 },
    { mul: 1.7, side: -0.55, vert: 0.2 },
    { mul: 3.2, side: 0, vert: 0.4 },
  ];
  let list = all.slice(0, ctx.tune.variants);
  if (pers === 'aggressive') list = list.map((v) => ({ ...v, mul: v.mul * 1.25 }));
  if (pers === 'trickster' && ctx.tune.variants < 9) list = [...list, all[6], all[7]];
  return list;
}

/** Robustness: fraction of noisy executions that still succeed. */
function robustness(ctx: Ctx, balls: Ball[], shot: AiShot, ok: (o: Outcome) => boolean): number {
  const n = ctx.tune.robust;
  if (n === 0) return 1 - Math.min(0.85, ctx.tune.aimSigma * 18);
  let good = 0;
  let total = 0;
  const s = ctx.tune.aimSigma * 1.4;
  for (let i = 0; i < n; i++) {
    for (const sign of [-1, 1]) {
      total++;
      if (ok(play(ctx, balls, { ...shot, angle: shot.angle + sign * s * (i + 1) * 0.8 }))) good++;
    }
  }
  return 0.25 + 0.75 * (good / total);
}

function callFor(ctx: Ctx, line: ReturnType<typeof potLines>[number]): AiShot['call'] {
  const ct = ctx.rules.callType(ctx.req.state, ctx.req.balls, ctx.side);
  if (ct === 'none') return null;
  return { ball: line.target, pocket: line.pocket };
}

export function potPlans(ctx: Ctx, balls: Ball[], cue: { x: number; y: number }, cuePlaced: boolean): Plan[] {
  const targets = ctx.rules.legalTargets(ctx.req.state, balls, ctx.side);
  let lines = potLines(ctx, balls, cue, targets).slice(0, ctx.tune.candidates);
  if (ctx.tune.banks || ctx.req.profile.personality === 'trickster') {
    lines = lines.concat(bankLines(ctx, balls, cue, targets).slice(0, 4));
  }
  const plans: Plan[] = [];
  for (const line of lines) {
    const base = speedFor(line.dist, ctx);
    for (const v of variants(ctx)) {
      const shot = makeShot({ angle: line.angle, speed: base * v.mul, side: v.side, vert: v.vert }, ctx, {
        call: callFor(ctx, line),
        cue: cuePlaced ? { x: cue.x, y: cue.y } : undefined,
      });
      const o = play(ctx, balls, shot);
      const success = o.res.keepTurn || o.res.winner === ctx.side;
      const score = judge(ctx, o);
      if (!success) continue;
      plans.push({ shot, score, p: line.ease, ev: score });
    }
  }
  plans.sort((a, b) => b.score - a.score);
  // Re-weight the best few by how forgiving they are to execution error.
  const top = plans.slice(0, 4);
  for (const pl of top) {
    const r = robustness(ctx, balls, pl.shot, (o) => o.res.keepTurn || o.res.winner === ctx.side);
    pl.p = Math.min(0.97, r);
    pl.ev = pl.p * pl.score + (1 - pl.p) * -45;
  }
  return top.sort((a, b) => b.ev - a.ev);
}

/** Safety: thin/soft contacts on a legal ball that leave the opponent nothing. */
export function safetyPlans(ctx: Ctx, balls: Ball[], cue: { x: number; y: number }, cuePlaced: boolean): Plan[] {
  const R = ctx.table.R;
  const targets = ctx.rules.legalTargets(ctx.req.state, balls, ctx.side);
  const ids = targets.length ? targets : balls.filter((b) => b.onTable && b.id !== ctx.cueId).map((b) => b.id);
  const out: Plan[] = [];
  const speeds = [0.9, 1.4, 2.1];
  for (const id of ids.slice(0, 4)) {
    const ob = balls.find((b) => b.id === id)!;
    const d = Math.hypot(ob.x - cue.x, ob.y - cue.y);
    const center = Math.atan2(ob.y - cue.y, ob.x - cue.x);
    const half = Math.asin(Math.min(1, (2 * R) / d)) * 0.92;
    for (const f of [-0.85, -0.5, 0, 0.5, 0.85]) {
      for (const sp of speeds) {
        const shot = makeShot({ angle: center + half * f, speed: sp + d * 0.4, vert: -0.2 }, ctx, { cue: cuePlaced ? { ...cue } : undefined });
        const o = play(ctx, balls, shot);
        const score = judge(ctx, o);
        out.push({ shot, score, p: 0.8, ev: score * 0.8 });
      }
    }
  }
  return out.sort((a, b) => b.ev - a.ev).slice(0, 3);
}

export function breakShot(ctx: Ctx): AiShot {
  const t = ctx.table;
  const balls = ctx.req.balls;
  const head = balls.filter((b) => b.id !== 0 && b.onTable).reduce((a, b) => (b.x < a.x ? b : a));
  const y = ctx.rng.pick([0, 0.12, -0.12, 0.25, -0.25]) * (ctx.req.state.mode === 'eight' ? 1 : 0.8);
  const cue = { x: t.headStringX - 0.02, y };
  const aim = Math.atan2(head.y - cue.y + ctx.rng.range(-0.004, 0.004), head.x - cue.x);
  const pers = ctx.req.profile.personality;
  return {
    cue: ctx.req.ballInHand !== 'none' ? cue : undefined,
    angle: ctx.req.ballInHand !== 'none' ? aim : Math.atan2(head.y - balls[0].y, head.x - balls[0].x),
    power: pers === 'defensive' ? 0.88 : 0.97,
    side: 0,
    vert: -0.15,
    call: null,
    pushOut: false,
  };
}

/** Candidate cue positions for ball in hand. */
interface PlacementSearch {
  ctx: Ctx;
  balls: Ball[];
  kitchen: boolean;
  out: { x: number; y: number }[];
}

function aimedSpots(search: PlacementSearch): void {
  const { ctx, balls } = search;
  const targets = ctx.rules.legalTargets(ctx.req.state, balls, ctx.side);
  const ids = targets.length ? targets : balls.filter((b) => b.onTable && b.id !== ctx.cueId).map((b) => b.id);
  for (const id of ids) {
    const ob = balls.find((b) => b.id === id && b.onTable);
    if (!ob) continue;
    search.ctx.table.pockets.forEach((pk, pi) => {
      if (!ctx.req.closedPockets.includes(pi)) addPocketSpots(search, ob, pk);
    });
  }
}

function addPocketSpots(search: PlacementSearch, ob: Ball, pk: TableGeom['pockets'][number]): void {
  const place = { table: search.ctx.table, balls: search.balls, cueId: search.ctx.cueId, kitchen: search.kitchen };
  const ang = Math.atan2(pk.ay - ob.y, pk.ax - ob.x);
  for (const off of [-0.3, 0, 0.3]) {
    for (const dist of [0.22, 0.4]) {
      const a = ang + Math.PI + off;
      const x = ob.x + Math.cos(a) * (dist + 2 * search.ctx.table.R);
      const y = ob.y + Math.sin(a) * (dist + 2 * search.ctx.table.R);
      if (canPlaceCue(place, x, y)) search.out.push({ x, y });
    }
  }
}

function randomSpots(search: PlacementSearch): void {
  if (!search.kitchen && search.out.length >= 4) return;
  const { ctx, out } = search;
  const t = ctx.table;
  const place = { table: t, balls: search.balls, cueId: ctx.cueId, kitchen: search.kitchen };
  for (let i = 0; i < 12; i++) {
    const x = search.kitchen ? ctx.rng.range(-t.L / 2 + t.R, t.headStringX) : ctx.rng.range(-t.L / 2 + t.R, t.L / 2 - t.R);
    const y = ctx.rng.range(-t.W / 2 + t.R, t.W / 2 - t.R);
    if (canPlaceCue(place, x, y)) out.push({ x, y });
  }
}

function nudgedSpots(search: PlacementSearch): { x: number; y: number }[] | null {
  const n = search.ctx.req.nudge;
  if (!n) return null;
  const { ctx, balls, out } = search;
  const t = ctx.table;
  const place = { table: t, balls, cueId: ctx.cueId, kitchen: false };
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const x = n.x + Math.cos(a) * n.radius * 0.95;
    const y = n.y + Math.sin(a) * n.radius * 0.95;
    if (canPlaceCue(place, x, y)) out.push({ x, y });
  }
  return ctx.rng.shuffle(out.filter((p) => Math.hypot(p.x - n.x, p.y - n.y) <= n.radius)).slice(0, 7);
}

export function placements(ctx: Ctx, balls: Ball[], kitchen: boolean): { x: number; y: number }[] {
  const search = { ctx, balls, kitchen, out: [] as { x: number; y: number }[] };
  aimedSpots(search);
  randomSpots(search);
  const nudge = nudgedSpots(search);
  if (nudge) return nudge;
  return ctx.rng.shuffle(search.out).slice(0, ctx.req.profile.level >= 3 ? 14 : 7);
}

/** Spots that get the full search once the deep levels have taken a quick look at all of them. */
const FINALISTS = 4;

/**
 * Ball in hand at levels 3–4: every spot first gets a quick look (its two easiest pots, one
 * natural stroke each) and only the most promising spots get every line and stroke. A full search
 * of all fourteen spots costs thousands of simulated shots, several seconds on a phone.
 */
export function shortlist(ctx: Ctx, balls: Ball[], spots: { x: number; y: number }[]): { x: number; y: number }[] {
  if (ctx.req.profile.level < 3 || spots.length <= FINALISTS) return spots;
  const v = variants(ctx)[0];
  const targets = ctx.rules.legalTargets(ctx.req.state, balls, ctx.side);
  const rated = spots.map((pos) => {
    const lines = potLines(ctx, balls, pos, targets);
    let best = -1e9;
    for (const line of lines.slice(0, 2)) {
      const shot = makeShot({ angle: line.angle, speed: speedFor(line.dist, ctx) * v.mul, side: v.side, vert: v.vert }, ctx, { call: callFor(ctx, line), cue: { x: pos.x, y: pos.y } });
      const o = play(ctx, balls, shot);
      if (o.res.keepTurn || o.res.winner === ctx.side) best = Math.max(best, judge(ctx, o));
    }
    return { pos, best, ease: lines[0]?.ease ?? 0 };
  });
  return rated.sort((a, b) => b.best - a.best || b.ease - a.ease).slice(0, FINALISTS).map((r) => r.pos);
}

function seenTwoBalls(ctx: Ctx, ev: PhysEvent[]): boolean {
  const seen = new Set<number>();
  for (const e of ev) if (e.t === 'ball' && (e.a === ctx.cueId || e.b === ctx.cueId)) seen.add(e.a === ctx.cueId ? e.b : e.a);
  return seen.size >= 2;
}

interface CaromSweep {
  balls: Ball[];
  stop: (ev: PhysEvent[]) => boolean;
  angle: number;
  speed: number;
  spin: number;
  verts: number[];
}

function addCaromHits(hits: AiShot[], ctx: Ctx, sweep: CaromSweep): void {
  for (const vt of sweep.verts) {
    const shot = makeShot({ angle: sweep.angle, speed: sweep.speed, side: sweep.spin, vert: vt }, ctx);
    if (play(ctx, sweep.balls, shot, sweep.stop).res.points > 0) hits.push(shot);
  }
}

function scoringCaromShots(ctx: Ctx, balls: Ball[], sweeps: { speeds: number[]; spins: number[]; verts: number[] }): AiShot[] {
  const stop = (ev: PhysEvent[]) => seenTwoBalls(ctx, ev);
  const hits: AiShot[] = [];
  const stepRad = ctx.tune.caromStep * DEG;
  const sweep: CaromSweep = { balls, stop, angle: 0, speed: 0, spin: 0, verts: sweeps.verts };
  for (let a = 0; a < Math.PI * 2; a += stepRad) {
    sweep.angle = a;
    for (const sp of sweeps.speeds) {
      sweep.speed = sp;
      for (const sd of sweeps.spins) {
        sweep.spin = sd;
        addCaromHits(hits, ctx, sweep);
      }
    }
  }
  return hits;
}

/** Prefer shots whose neighbours also score (wide margin). */
function robustCaromPlan(ctx: Ctx, balls: Ball[], hits: AiShot[]): Plan {
  const stop = (ev: PhysEvent[]) => seenTwoBalls(ctx, ev);
  let best = hits[0];
  let bestScore = -1;
  for (const h of hits.slice(0, 60)) {
    let score = 0;
    for (const d of [-1, 1, -2, 2]) {
      const o = play(ctx, balls, { ...h, angle: h.angle + d * ctx.tune.aimSigma }, stop);
      if (o.res.points > 0) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }
  return { shot: best, score: 100, p: 0.3 + 0.17 * bestScore, ev: 100 };
}

export function caromPlan(ctx: Ctx): Plan {
  const balls = ctx.req.balls;
  const cue = balls.find((b) => b.id === ctx.cueId)!;
  const three = ctx.req.state.mode === 'carom-3c';
  const speeds = three ? [3.4, 4.4, 5.4] : [1.3, 2.0, 2.9];
  const spins = three ? [-0.6, 0, 0.6] : [0, -0.5, 0.5];
  const verts = three ? [0.35] : [0.2, -0.4];
  const hits = scoringCaromShots(ctx, balls, { speeds, spins, verts });
  if (hits.length) return robustCaromPlan(ctx, balls, hits);
  // No scoring line found: play a soft shot toward the red that leaves balls apart.
  const red = balls.find((b) => b.id === 2)!;
  return { shot: makeShot({ angle: Math.atan2(red.y - cue.y, red.x - cue.x) + ctx.rng.range(-0.05, 0.05), speed: 2.4, vert: 0.2 }, ctx), score: 0, p: 0.1, ev: 0 };
}
