import { powerToSpeed, speedToPower } from '../core/cue-power';
import { cloneBalls, DEFAULT_PHYS, step, strike, type Ball, type PhysEvent, type PhysParams, type SimWorld } from '../core/physics';
import { canPlaceCue } from '../core/rack';
import { Rng } from '../core/rng';
import { RULES } from '../core/rules';
import { other, summarize, type GameState, type Resolution, type RuleSet, type Side } from '../core/rules/types';
import { makeCaromTable, makePoolTable, type TableGeom } from '../core/table';
import { skillDef } from '../game/content/gear';
import type { AiDecision, AiProfile, AiRequest, AiShot } from './types';

interface LevelTune {
  /** Execution noise (radians / relative power). */
  aimSigma: number;
  powerSigma: number;
  candidates: number;
  variants: number;
  banks: boolean;
  position: boolean;
  robust: number;
  caromStep: number;
}

const LEVELS: Record<AiProfile['level'], LevelTune> = {
  1: { aimSigma: 0.022, powerSigma: 0.14, candidates: 5, variants: 1, banks: false, position: false, robust: 0, caromStep: 3 },
  2: { aimSigma: 0.011, powerSigma: 0.09, candidates: 9, variants: 3, banks: false, position: true, robust: 0, caromStep: 2 },
  3: { aimSigma: 0.0055, powerSigma: 0.05, candidates: 14, variants: 6, banks: true, position: true, robust: 2, caromStep: 1.5 },
  4: { aimSigma: 0.0022, powerSigma: 0.03, candidates: 22, variants: 9, banks: true, position: true, robust: 3, caromStep: 1 },
};

interface Ctx {
  req: AiRequest;
  table: TableGeom;
  rules: RuleSet;
  params: PhysParams;
  tune: LevelTune;
  rng: Rng;
  cueId: number;
  side: Side;
}

interface Outcome {
  balls: Ball[];
  res: Resolution;
  state: GameState;
}

interface Plan {
  shot: AiShot;
  /** Value of a successful execution. */
  score: number;
  /** Estimated probability the shot works. */
  p: number;
  ev: number;
}

const DEG = Math.PI / 180;

function makeWorld(ctx: Ctx, balls: Ball[]): SimWorld {
  const closed = ctx.req.closedPockets;
  return {
    table: ctx.table,
    balls,
    params: ctx.params,
    closedPockets: closed,
    extraSegments: closed.map((i) => ctx.table.pockets[i].mouth),
  };
}

/** Simulate one shot from a ball layout and judge it with the real rules. */
function play(ctx: Ctx, start: Ball[], shot: AiShot, earlyStop?: (ev: PhysEvent[]) => boolean): Outcome {
  const balls = cloneBalls(start);
  const cue = balls.find((b) => b.id === ctx.cueId)!;
  if (shot.cue) {
    cue.x = shot.cue.x;
    cue.y = shot.cue.y;
    cue.onTable = true;
  }
  const targets = ctx.rules.legalTargets(ctx.req.state, start, ctx.side);
  strike(cue, ctx.table.R, { angle: shot.angle, speed: powerToSpeed(shot.power, ctx.req.maxSpeed), side: shot.side * 0.86, vert: shot.vert * 0.86 });
  const w = makeWorld(ctx, balls);
  const events: PhysEvent[] = [];
  for (let t = 0; t < 25; t += 1 / 30) {
    if (!step(w, 1 / 30, events)) break;
    if (earlyStop && earlyStop(events)) break;
  }
  const crossed = balls.filter((b) => b.onTable && b.id !== 0 && b.x < ctx.table.headStringX).length;
  const sum = summarize(events, ctx.cueId, ctx.req.state.isBreak, shot.call, shot.pushOut, targets, crossed);
  const state = structuredClone(ctx.req.state);
  const res = ctx.rules.resolve(state, balls, sum);
  if (res.assignGroup) {
    state.groups[ctx.side] = res.assignGroup;
    state.groups[other(ctx.side)] = res.assignGroup === 'solid' ? 'stripe' : 'solid';
  }
  for (const id of res.respot) {
    const b = balls.find((x) => x.id === id);
    if (b) Object.assign(b, { onTable: true, x: ctx.table.footSpot.x, y: 0 });
  }
  return { balls, res, state };
}

// ---------- Geometry helpers ----------

function segClear(balls: Ball[], ax: number, ay: number, bx: number, by: number, ignore: number[], clearance: number): boolean {
  const ex = bx - ax;
  const ey = by - ay;
  const l2 = ex * ex + ey * ey || 1e-9;
  for (const b of balls) {
    if (!b.onTable || ignore.includes(b.id)) continue;
    let t = ((b.x - ax) * ex + (b.y - ay) * ey) / l2;
    t = Math.max(0, Math.min(1, t));
    const dx = b.x - (ax + ex * t);
    const dy = b.y - (ay + ey * t);
    if (dx * dx + dy * dy < clearance * clearance) return false;
  }
  return true;
}

interface PotLine {
  target: number;
  pocket: number;
  gx: number; gy: number;
  angle: number;
  cut: number;
  ease: number;
  dist: number;
}

/** Direct pot lines from a cue position: ease 0..1 (0 = impossible). */
function potLines(ctx: Ctx, balls: Ball[], cx: number, cy: number, targets: number[]): PotLine[] {
  const t = ctx.table;
  const R = t.R;
  const out: PotLine[] = [];
  for (const id of targets) {
    const ob = balls.find((b) => b.id === id && b.onTable);
    if (!ob) continue;
    t.pockets.forEach((pk, pi) => {
      if (ctx.req.closedPockets.includes(pi)) return;
      const px = pk.ax;
      const py = pk.ay;
      const d2 = Math.hypot(px - ob.x, py - ob.y);
      const ux = (px - ob.x) / d2;
      const uy = (py - ob.y) / d2;
      if (pk.kind === 'side' && Math.abs(uy) < 0.55) return; // too shallow for a side pocket
      if (pk.kind === 'corner') {
        // Approach must come from the table side of the corner.
        if (ux * Math.sign(pk.x) < -0.15 || uy * Math.sign(pk.y) < -0.15) return;
      }
      const gx = ob.x - ux * 2 * R;
      const gy = ob.y - uy * 2 * R;
      const d1 = Math.hypot(gx - cx, gy - cy);
      if (d1 < 1e-4) return;
      const ax = (gx - cx) / d1;
      const ay = (gy - cy) / d1;
      const cosCut = ax * ux + ay * uy;
      if (cosCut < Math.cos(78 * DEG)) return;
      if (!segClear(balls, cx, cy, gx, gy, [ctx.cueId, id], 2 * R - 1e-4)) return;
      if (!segClear(balls, ob.x, ob.y, px, py, [ctx.cueId, id], 2 * R - 1e-4)) return;
      const cut = Math.acos(Math.min(1, cosCut));
      const ease = Math.pow(cosCut, 2.2) * Math.exp(-(0.45 * d1 + 0.7 * d2)) * (pk.kind === 'side' ? 0.85 : 1);
      out.push({ target: id, pocket: pi, gx, gy, angle: Math.atan2(ay, ax), cut, ease, dist: d1 + d2 });
    });
  }
  return out.sort((a, b) => b.ease - a.ease);
}

/** One-rail bank lines: mirror the pocket across a long/short rail. */
function bankLines(ctx: Ctx, balls: Ball[], cx: number, cy: number, targets: number[]): PotLine[] {
  const t = ctx.table;
  const R = t.R;
  const out: PotLine[] = [];
  const rails = [
    { axis: 'y' as const, v: -t.W / 2 + R },
    { axis: 'y' as const, v: t.W / 2 - R },
    { axis: 'x' as const, v: -t.L / 2 + R },
    { axis: 'x' as const, v: t.L / 2 - R },
  ];
  for (const id of targets) {
    const ob = balls.find((b) => b.id === id && b.onTable);
    if (!ob) continue;
    t.pockets.forEach((pk, pi) => {
      if (ctx.req.closedPockets.includes(pi)) return;
      for (const r of rails) {
        const mx = r.axis === 'x' ? 2 * r.v - pk.ax : pk.ax;
        const my = r.axis === 'y' ? 2 * r.v - pk.ay : pk.ay;
        const d2 = Math.hypot(mx - ob.x, my - ob.y);
        const ux = (mx - ob.x) / d2;
        const uy = (my - ob.y) / d2;
        const gx = ob.x - ux * 2 * R;
        const gy = ob.y - uy * 2 * R;
        const d1 = Math.hypot(gx - cx, gy - cy);
        const ax = (gx - cx) / d1;
        const ay = (gy - cy) / d1;
        const cosCut = ax * ux + ay * uy;
        if (cosCut < Math.cos(60 * DEG)) continue;
        if (!segClear(balls, cx, cy, gx, gy, [ctx.cueId, id], 2 * R - 1e-4)) continue;
        const ease = 0.35 * Math.pow(cosCut, 2) * Math.exp(-(0.45 * d1 + 0.7 * d2));
        out.push({ target: id, pocket: pi, gx, gy, angle: Math.atan2(ay, ax), cut: Math.acos(Math.min(1, cosCut)), ease, dist: d1 + d2 });
      }
    });
  }
  return out.sort((a, b) => b.ease - a.ease);
}

/** How good is the table for `side` with the cue ball where it lies? 0..1. */
function tableEase(ctx: Ctx, balls: Ball[], state: GameState, side: Side, ballInHand: boolean): number {
  const cue = balls.find((b) => b.id === ctx.rules.cueId(state, side));
  if (!cue || !cue.onTable) return ballInHand ? 0.9 : 0;
  if (ballInHand) return 0.9;
  const targets = ctx.rules.legalTargets(state, balls, side);
  const ids = targets.length ? targets : balls.filter((b) => b.onTable && b.id !== cue.id).map((b) => b.id);
  const lines = potLines(ctx, balls, cue.x, cue.y, ids);
  if (!lines.length) return 0;
  const best = lines[0].ease;
  const second = lines.find((l) => l.target !== lines[0].target)?.ease ?? 0;
  return Math.min(1, best * 1.6 + second * 0.4);
}

/** Value of an outcome for the shooter. */
function judge(ctx: Ctx, o: Outcome): number {
  const { res } = o;
  const me = ctx.side;
  if (res.winner === me) return 1000;
  if (res.winner === other(me)) return -1000;
  if (res.keepTurn) {
    const pos = ctx.tune.position ? tableEase(ctx, o.balls, o.state, me, false) : 0.5;
    return 120 + 80 * pos + (res.points ? 30 : 0);
  }
  const oppEase = tableEase(ctx, o.balls, o.state, other(me), res.ballInHand !== 'none');
  let v = -60 * oppEase;
  if (res.foul) v -= 90;
  if (res.option) v -= 20;
  return v;
}

function speedFor(dist: number, ctx: Ctx): number {
  // Enough to roll the distance with margin; firmer when the cloth is fast.
  const mu = ctx.req.ice ? 0.005 : DEFAULT_PHYS.muRoll;
  return Math.sqrt(2 * mu * 9.81 * dist * 1.25) + 0.55;
}

function makeShot(angle: number, speed: number, ctx: Ctx, side = 0, vert = 0, extra: Partial<AiShot> = {}): AiShot {
  return { angle, power: speedToPower(Math.min(speed, ctx.req.maxSpeed), ctx.req.maxSpeed), side, vert, call: null, pushOut: false, ...extra };
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

function callFor(ctx: Ctx, line: PotLine): AiShot['call'] {
  const ct = ctx.rules.callType(ctx.req.state, ctx.req.balls, ctx.side);
  if (ct === 'none') return null;
  return { ball: line.target, pocket: line.pocket };
}

function potPlans(ctx: Ctx, balls: Ball[], cue: { x: number; y: number }, cuePlaced: boolean): Plan[] {
  const targets = ctx.rules.legalTargets(ctx.req.state, balls, ctx.side);
  let lines = potLines(ctx, balls, cue.x, cue.y, targets).slice(0, ctx.tune.candidates);
  if (ctx.tune.banks || ctx.req.profile.personality === 'trickster') {
    lines = lines.concat(bankLines(ctx, balls, cue.x, cue.y, targets).slice(0, 4));
  }
  const plans: Plan[] = [];
  for (const line of lines) {
    const base = speedFor(line.dist, ctx);
    for (const v of variants(ctx)) {
      const shot = makeShot(line.angle, base * v.mul, ctx, v.side, v.vert, {
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
function safetyPlans(ctx: Ctx, balls: Ball[], cue: { x: number; y: number }, cuePlaced: boolean): Plan[] {
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
        const shot = makeShot(center + half * f, sp + d * 0.4, ctx, 0, -0.2, { cue: cuePlaced ? { ...cue } : undefined });
        const o = play(ctx, balls, shot);
        const score = judge(ctx, o);
        out.push({ shot, score, p: 0.8, ev: score * 0.8 });
      }
    }
  }
  return out.sort((a, b) => b.ev - a.ev).slice(0, 3);
}

function breakShot(ctx: Ctx): AiShot {
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
function placements(ctx: Ctx, balls: Ball[], kitchen: boolean): { x: number; y: number }[] {
  const t = ctx.table;
  const out: { x: number; y: number }[] = [];
  const targets = ctx.rules.legalTargets(ctx.req.state, balls, ctx.side);
  const ids = targets.length ? targets : balls.filter((b) => b.onTable && b.id !== ctx.cueId).map((b) => b.id);
  for (const id of ids) {
    const ob = balls.find((b) => b.id === id && b.onTable);
    if (!ob) continue;
    t.pockets.forEach((pk, pi) => {
      if (ctx.req.closedPockets.includes(pi)) return;
      const ang = Math.atan2(pk.ay - ob.y, pk.ax - ob.x);
      for (const off of [-0.3, 0, 0.3]) {
        for (const dist of [0.22, 0.4]) {
          const a = ang + Math.PI + off;
          const x = ob.x + Math.cos(a) * (dist + 2 * t.R);
          const y = ob.y + Math.sin(a) * (dist + 2 * t.R);
          if (canPlaceCue(t, balls, ctx.cueId, x, y, kitchen)) out.push({ x, y });
        }
      }
    });
  }
  if (kitchen || out.length < 4) {
    for (let i = 0; i < 12; i++) {
      const x = kitchen ? ctx.rng.range(-t.L / 2 + t.R, t.headStringX) : ctx.rng.range(-t.L / 2 + t.R, t.L / 2 - t.R);
      const y = ctx.rng.range(-t.W / 2 + t.R, t.W / 2 - t.R);
      if (canPlaceCue(t, balls, ctx.cueId, x, y, kitchen)) out.push({ x, y });
    }
  }
  return ctx.rng.shuffle(out).slice(0, ctx.req.profile.level >= 3 ? 14 : 7);
}

// ---------- Carom ----------

function caromPlan(ctx: Ctx): Plan {
  const balls = ctx.req.balls;
  const cue = balls.find((b) => b.id === ctx.cueId)!;
  const three = ctx.req.state.mode === 'carom-3c';
  const speeds = three ? [3.4, 4.4, 5.4] : [1.3, 2.0, 2.9];
  const spins = three ? [-0.6, 0, 0.6] : [0, -0.5, 0.5];
  const verts = three ? [0.35] : [0.2, -0.4];
  const hits: AiShot[] = [];
  const stepRad = ctx.tune.caromStep * DEG;
  const stop = (ev: PhysEvent[]) => {
    const seen = new Set<number>();
    for (const e of ev) if (e.t === 'ball' && (e.a === ctx.cueId || e.b === ctx.cueId)) seen.add(e.a === ctx.cueId ? e.b : e.a);
    return seen.size >= 2;
  };
  for (let a = 0; a < Math.PI * 2; a += stepRad) {
    for (const sp of speeds) {
      for (const sd of spins) {
        for (const vt of verts) {
          const shot = makeShot(a, sp, ctx, sd, vt);
          const o = play(ctx, balls, shot, stop);
          if (o.res.points > 0) hits.push(shot);
        }
      }
    }
  }
  if (hits.length) {
    // Prefer shots whose neighbours also score (wide margin).
    let best = hits[0];
    let bestScore = -1;
    for (const h of hits.slice(0, 60)) {
      let s = 0;
      for (const d of [-1, 1, -2, 2]) {
        const o = play(ctx, balls, { ...h, angle: h.angle + d * ctx.tune.aimSigma }, stop);
        if (o.res.points > 0) s++;
      }
      if (s > bestScore) {
        bestScore = s;
        best = h;
      }
    }
    return { shot: best, score: 100, p: 0.3 + 0.17 * bestScore, ev: 100 };
  }
  // No scoring line found: play a soft shot toward the red that leaves balls apart.
  const red = balls.find((b) => b.id === 2)!;
  return { shot: makeShot(Math.atan2(red.y - cue.y, red.x - cue.x) + ctx.rng.range(-0.05, 0.05), 2.4, ctx, 0, 0.2), score: 0, p: 0.1, ev: 0 };
}

// ---------- Entry ----------

function addNoise(ctx: Ctx, shot: AiShot): AiShot {
  const t = ctx.tune;
  const pers = ctx.req.profile.personality;
  const aimMul = pers === 'aggressive' ? 1.15 : pers === 'defensive' ? 0.9 : 1;
  return {
    ...shot,
    angle: shot.angle + ctx.rng.gauss() * t.aimSigma * aimMul,
    power: Math.max(0.03, Math.min(1, shot.power * (1 + ctx.rng.gauss() * t.powerSigma))),
  };
}

function chooseSkill(ctx: Ctx, confidence: number): AiDecision['skill'] {
  const { energy, skills, profile } = ctx.req;
  if (profile.level < 2) return undefined;
  const can = (id: (typeof skills)[number]) => skills.includes(id) && energy >= skillDef(id).cost;
  if (confidence < 0.45 && can('shield')) return 'shield';
  if (confidence < 0.35 && can('tremor')) return 'tremor';
  if (can('spin2') && ctx.rng.next() < 0.15) return 'spin2';
  return undefined;
}

export function think(req: AiRequest): AiDecision {
  const rules = RULES[req.state.mode];
  const table = rules.table === 'pool' ? makePoolTable() : makeCaromTable();
  const ctx: Ctx = {
    req, table, rules,
    params: req.ice ? { ...DEFAULT_PHYS, muRoll: 0.0045, muSlide: 0.13, spinDecel: 18 } : DEFAULT_PHYS,
    tune: LEVELS[req.profile.level],
    rng: new Rng(req.seed),
    cueId: rules.cueId(req.state, req.side),
    side: req.side,
  };

  if (req.option) {
    const kind = req.state.pendingOption;
    const ease = tableEase(ctx, req.balls, req.state, req.side, false);
    if (kind === 'illegal-break-8') return { shot: null, option: ease > 0.25 ? 'play' : 'pass', confidence: ease };
    return { shot: null, option: ease > 0.3 ? 'play' : 'pass', confidence: ease };
  }

  if (req.state.isBreak && rules.table === 'pool') {
    return { shot: addNoise(ctx, breakShot(ctx)), confidence: 0.6 };
  }

  if (rules.table === 'carom') {
    const plan = caromPlan(ctx);
    return { shot: addNoise(ctx, plan.shot), confidence: plan.p, skill: chooseSkill(ctx, plan.p) };
  }

  const balls = req.balls;
  let best: Plan | null = null;
  if (req.ballInHand !== 'none') {
    for (const pos of placements(ctx, balls, req.ballInHand === 'kitchen')) {
      const plans = potPlans(ctx, balls, pos, true);
      if (plans[0] && (!best || plans[0].ev > best.ev)) best = plans[0];
    }
  } else {
    const cue = balls.find((b) => b.id === ctx.cueId)!;
    best = potPlans(ctx, balls, cue, false)[0] ?? null;
  }

  // Safety when the best attack is too risky for this personality.
  const threshold = { aggressive: 15, balanced: 40, defensive: 70, trickster: 35 }[req.profile.personality];
  const tryPush = req.pushOutAvailable && req.profile.level >= 2;
  if ((!best || best.ev < threshold) && req.profile.level >= 2) {
    const cue = req.ballInHand !== 'none'
      ? placements(ctx, balls, req.ballInHand === 'kitchen')[0] ?? balls.find((b) => b.id === ctx.cueId)!
      : balls.find((b) => b.id === ctx.cueId)!;
    const safe = safetyPlans(ctx, balls, cue, req.ballInHand !== 'none')[0];
    if (safe && (!best || safe.ev > best.ev)) {
      if (tryPush) safe.shot.pushOut = true;
      best = safe;
    }
  }
  if (!best) {
    // Nothing found: roll softly into the lowest legal ball.
    const targets = rules.legalTargets(req.state, balls, req.side);
    const cue = balls.find((b) => b.id === ctx.cueId)!;
    const ob = balls.find((b) => targets.includes(b.id) && b.onTable) ?? balls.find((b) => b.id !== ctx.cueId && b.onTable)!;
    const shot = makeShot(Math.atan2(ob.y - cue.y, ob.x - cue.x), 1.6, ctx, 0, 0, {
      cue: req.ballInHand !== 'none' ? { x: cue.x, y: cue.y } : undefined,
      call: rules.callType(req.state, balls, req.side) === 'none' ? null : { ball: ob.id, pocket: 0 },
    });
    return { shot: addNoise(ctx, shot), confidence: 0.05 };
  }
  return { shot: addNoise(ctx, best.shot), confidence: best.p, skill: chooseSkill(ctx, best.p) };
}

