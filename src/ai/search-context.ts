import { powerToSpeed } from '../core/cue-power';
import { cloneBalls, step, strike, type Ball, type PhysEvent, type PhysParams, type SimWorld } from '../core/physics';
import { Rng } from '../core/rng';
import { RULES } from '../core/rules';
import { other, summarize, type GameState, type Resolution, type RuleSet, type ShotSummary, type Side } from '../core/rules/types';
import { makeCaromTable, makePoolTable, type TableGeom } from '../core/table';
import { applySkillBlast } from '../game/skill-cast';
import type { AiProfile, AiRequest, AiShot } from './types';

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

export interface Ctx {
  req: AiRequest;
  table: TableGeom;
  rules: RuleSet;
  params: PhysParams;
  tune: LevelTune;
  rng: Rng;
  cueId: number;
  side: Side;
}

export interface Outcome {
  balls: Ball[];
  res: Resolution;
  state: GameState;
}

export interface Plan {
  shot: AiShot;
  /** Value of a successful execution. */
  score: number;
  /** Estimated probability the shot works. */
  p: number;
  ev: number;
}

export function makeCtx(req: AiRequest): Ctx {
  const rules = RULES[req.state.mode];
  return {
    req,
    table: rules.table === 'pool' ? makePoolTable() : makeCaromTable(),
    rules,
    params: req.params,
    tune: LEVELS[req.profile.level],
    rng: new Rng(req.seed),
    cueId: rules.cueId(req.state, req.side),
    side: req.side,
  };
}

function makeWorld(ctx: Ctx, balls: Ball[]): SimWorld {
  const closed = ctx.req.closedPockets;
  return {
    table: ctx.table,
    balls,
    params: ctx.params,
    closedPockets: closed,
    extraSegments: [...closed.map((i) => ctx.table.pockets[i].mouth), ...ctx.req.extraSegments],
    terrain: ctx.req.terrain,
    captureScale: ctx.req.captureScale,
    pocketPull: ctx.req.pocketPull, pullExempt: ctx.cueId,
  };
}

/** Simulate one shot from a ball layout and judge it with the real rules. */
interface ShotRun {
  ctx: Ctx;
  balls: Ball[];
  shot: AiShot;
  events: PhysEvent[];
}

function blastOnCueHit(run: ShotRun, from: number): boolean {
  const { ctx, balls, events, shot } = run;
  const hit = events.slice(from).find(e => e.t === 'ball' && (e.a === ctx.cueId || e.b === ctx.cueId));
  if (!hit || hit.t !== 'ball') return false;
  applySkillBlast(balls, hit, { radius: ctx.req.blast!.radius, force: ctx.req.blast!.force, direction: ctx.req.blast!.directional ? { x: Math.cos(shot.angle), y: Math.sin(shot.angle) } : undefined });
  return true;
}

function stillRolling(run: ShotRun, moving: boolean, blasted: boolean): boolean {
  if (moving) return true;
  if (!blasted) return false;
  return run.balls.some(b => b.onTable && Math.hypot(b.vx,b.vy)>0);
}

function settleBalls(ctx: Ctx, sum: ShotSummary, res: Resolution): void {
  const called = ctx.req.calledBall;
  if (called !== null && called !== undefined && res.winner === null && sum.firstHit !== called) {
    res.foul = `Phải chạm bi ${called} trước`;
    res.keepTurn = false;
    res.ballInHand = 'anywhere';
  }
  if (ctx.req.secondChance && !res.foul && !res.keepTurn && !res.option && res.winner === null) res.keepTurn = true;
  if (ctx.req.shield && res.foul && res.winner === null) { res.foul = null; res.ballInHand = 'none'; res.option = undefined; }
}

function shoot(run: ShotRun, cue: Ball): SimWorld {
  const { ctx, shot } = run;
  strike(cue, ctx.table.R, { angle: shot.angle, speed: powerToSpeed(shot.power, ctx.req.maxSpeed), side: shot.side * (ctx.req.spinReach?.side ?? 0.86) * (ctx.req.spinMultiplier ?? 1), vert: shot.vert * (ctx.req.spinReach?.vert ?? 0.86) * (ctx.req.spinMultiplier ?? 1) });
  return makeWorld(ctx, run.balls);
}

function simulateShot(run: ShotRun, world: SimWorld, earlyStop?: (ev: PhysEvent[]) => boolean): void {
  let blasted = false;
  for (let t = 0; t < 25; t += 1 / 30) {
    const from = run.events.length;
    const moving = step(world, 1 / 30, run.events);
    if (!blasted && run.ctx.req.blast) blasted = blastOnCueHit(run, from);
    if (!stillRolling(run, moving, blasted)) break;
    if (earlyStop?.(run.events)) break;
  }
}

function resolveShot(ctx: Ctx, shot: AiShot, targets: number[], run: ShotRun): Outcome {
  const balls = run.balls;
  const crossed = balls.filter((b) => b.onTable && b.id !== 0 && b.x < ctx.table.headStringX).length;
  const sum = summarize({
    events: run.events, cueId: ctx.cueId, isBreak: ctx.req.state.isBreak, call: shot.call,
    pushOut: shot.pushOut, targets, crossedHeadString: crossed,
  });
  const state = structuredClone(ctx.req.state);
  const res = ctx.rules.resolve(state, balls, sum);
  settleBalls(ctx, sum, res);
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

// Reused because the search calls this thousands of times per turn.
const shotRun: ShotRun = { ctx: undefined!, balls: undefined!, shot: undefined!, events: undefined! };

export function play(ctx: Ctx, start: Ball[], shot: AiShot, earlyStop?: (ev: PhysEvent[]) => boolean): Outcome {
  const balls = cloneBalls(start);
  const cue = balls.find((b) => b.id === ctx.cueId)!;
  if (shot.cue) {
    cue.x = shot.cue.x;
    cue.y = shot.cue.y;
    cue.onTable = true;
  }
  const targets = ctx.rules.legalTargets(ctx.req.state, start, ctx.side);
  const events: PhysEvent[] = [];
  const run = shotRun;
  run.ctx = ctx;
  run.balls = balls;
  run.shot = shot;
  run.events = events;
  simulateShot(run, shoot(run, cue), earlyStop);
  return resolveShot(ctx, shot, targets, run);
}
