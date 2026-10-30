import type { Ball } from '../core/physics';
import { other, type GameState, type Side } from '../core/rules/types';
import type { TableGeom } from '../core/table';
import type { Ctx, Outcome } from './search-context';

const DEG = Math.PI / 180;

interface ClearSegment { ax: number; ay: number; bx: number; by: number }

function segClear(balls: Ball[], line: ClearSegment, ignore: number[], clearance: number): boolean {
  const ex = line.bx - line.ax;
  const ey = line.by - line.ay;
  const l2 = ex * ex + ey * ey || 1e-9;
  for (const b of balls) {
    if (!b.onTable || ignore.includes(b.id)) continue;
    let t = ((b.x - line.ax) * ex + (b.y - line.ay) * ey) / l2;
    t = Math.max(0, Math.min(1, t));
    const dx = b.x - (line.ax + ex * t);
    const dy = b.y - (line.ay + ey * t);
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


interface ClearCheck {
  ignore: number[];
  value: number;
}

interface LineAim {
  ux: number;
  uy: number;
  gx: number;
  gy: number;
  d1: number;
  ax: number;
  ay: number;
  cosCut: number;
  d2: number;
}

function aimAtPocket(R: number, cue: { x: number; y: number }, ob: Ball, aim: { x: number; y: number }): LineAim | null {
  const d2 = Math.hypot(aim.x - ob.x, aim.y - ob.y);
  const ux = (aim.x - ob.x) / d2;
  const uy = (aim.y - ob.y) / d2;
  const gx = ob.x - ux * 2 * R;
  const gy = ob.y - uy * 2 * R;
  const d1 = Math.hypot(gx - cue.x, gy - cue.y);
  if (d1 < 1e-4) return null;
  const ax = (gx - cue.x) / d1;
  const ay = (gy - cue.y) / d1;
  return { ux, uy, gx, gy, d1, ax, ay, cosCut: ax * ux + ay * uy, d2 };
}

function cueIsClear(balls: Ball[], cue: { x: number; y: number }, line: LineAim, clearance: ClearCheck): boolean {
  return segClear(balls, { ax: cue.x, ay: cue.y, bx: line.gx, by: line.gy }, clearance.ignore, clearance.value);
}

const distanceEase = (d1: number, d2: number) => Math.exp(-(0.45 * d1 + 0.7 * d2));

function eachOpenPocket(ctx: Ctx, table: TableGeom, action: (pk: TableGeom['pockets'][number], pi: number) => void): void {
  table.pockets.forEach((pk, pi) => {
    if (!ctx.req.closedPockets.includes(pi)) action(pk, pi);
  });
}

function eachLiveTarget(balls: Ball[], targets: number[], action: (id: number, ob: Ball) => void): void {
  for (const id of targets) {
    const ob = balls.find((b) => b.id === id && b.onTable);
    if (ob) action(id, ob);
  }
}

/** Direct pot lines from a cue position: ease 0..1 (0 = impossible). */
export function potLines(ctx: Ctx, balls: Ball[], cue: { x: number; y: number }, targets: number[]): PotLine[] {
  const t = ctx.table;
  const R = t.R;
  const out: PotLine[] = [];
  eachLiveTarget(balls, targets, (id, ob) => eachOpenPocket(ctx, t, (pk, pi) => {
    const line = aimAtPocket(R, cue, ob, { x: pk.ax, y: pk.ay });
    if (!line) return;
    if (pk.kind === 'side' && Math.abs(line.uy) < 0.55) return; // too shallow for a side pocket
    if (pk.kind === 'corner') {
      // Approach must come from the table side of the corner.
      if (line.ux * Math.sign(pk.x) < -0.15 || line.uy * Math.sign(pk.y) < -0.15) return;
    }
    if (line.cosCut < Math.cos(78 * DEG)) return;
    const clearance = { ignore: [ctx.cueId, id], value: 2 * R - 1e-4 };
    if (!cueIsClear(balls, cue, line, clearance)) return;
    if (!segClear(balls, { ax: ob.x, ay: ob.y, bx: pk.ax, by: pk.ay }, clearance.ignore, clearance.value)) return;
    const cut = Math.acos(Math.min(1, line.cosCut));
    const ease = Math.pow(line.cosCut, 2.2) * distanceEase(line.d1, line.d2) * (pk.kind === 'side' ? 0.85 : 1);
    out.push({ target: id, pocket: pi, gx: line.gx, gy: line.gy, angle: Math.atan2(line.ay, line.ax), cut, ease, dist: line.d1 + line.d2 });
  }));
  return out.sort((a, b) => b.ease - a.ease);
}

/** One-rail bank lines: mirror the pocket across a long/short rail. */
export function bankLines(ctx: Ctx, balls: Ball[], cue: { x: number; y: number }, targets: number[]): PotLine[] {
  const t = ctx.table;
  const R = t.R;
  const out: PotLine[] = [];
  const rails = [
    { axis: 'y' as const, v: -t.W / 2 + R },
    { axis: 'y' as const, v: t.W / 2 - R },
    { axis: 'x' as const, v: -t.L / 2 + R },
    { axis: 'x' as const, v: t.L / 2 - R },
  ];
  eachLiveTarget(balls, targets, (id, ob) => eachOpenPocket(ctx, t, (pk, pi) => {
    for (const r of rails) {
      const aim = { x: r.axis === 'x' ? 2 * r.v - pk.ax : pk.ax, y: r.axis === 'y' ? 2 * r.v - pk.ay : pk.ay };
      const line = aimAtPocket(R, cue, ob, aim);
      if (!line) continue;
      if (line.cosCut < Math.cos(60 * DEG)) continue;
      if (!cueIsClear(balls, cue, line, { ignore: [ctx.cueId, id], value: 2 * R - 1e-4 })) continue;
      const ease = 0.35 * Math.pow(line.cosCut, 2) * distanceEase(line.d1, line.d2);
      out.push({ target: id, pocket: pi, gx: line.gx, gy: line.gy, angle: Math.atan2(line.ay, line.ax), cut: Math.acos(Math.min(1, line.cosCut)), ease, dist: line.d1 + line.d2 });
    }
  }));
  return out.sort((a, b) => b.ease - a.ease);
}

/** How good is the table for `side` with the cue ball where it lies? 0..1. */
export function tableEase(ctx: Ctx, balls: Ball[], state: GameState, side: Side): number {
  const cue = balls.find((b) => b.id === ctx.rules.cueId(state, side));
  if (!cue || !cue.onTable) return 0;
  const targets = ctx.rules.legalTargets(state, balls, side);
  const ids = targets.length ? targets : balls.filter((b) => b.onTable && b.id !== cue.id).map((b) => b.id);
  const lines = potLines(ctx, balls, cue, ids);
  if (!lines.length) return 0;
  const best = lines[0].ease;
  const second = lines.find((l) => l.target !== lines[0].target)?.ease ?? 0;
  return Math.min(1, best * 1.6 + second * 0.4);
}

/** A ball in hand is close to a guaranteed chance, wherever the cue lies. */
function heldEase(ctx: Ctx, o: Outcome, side: Side): number {
  return o.res.ballInHand === 'none' ? tableEase(ctx, o.balls, o.state, side) : 0.9;
}

/** Value of an outcome for the shooter (or the puppeteer owning this forced shot). */
export function judge(ctx: Ctx, o: Outcome): number {
  const { res } = o;
  const owner = ctx.req.benefitingSide;
  if (owner !== undefined) return puppetValue(ctx, o, owner);
  const me = ctx.side;
  if (res.winner === me) return 1000;
  if (res.winner === other(me)) return -1000;
  if (res.keepTurn) {
    const pos = ctx.tune.position ? tableEase(ctx, o.balls, o.state, me) : 0.5;
    return 120 + 80 * pos + (res.points ? 30 : 0);
  }
  const oppEase = heldEase(ctx, o, other(me));
  let v = -60 * oppEase;
  if (res.foul) v -= 90;
  if (res.option) v -= 20;
  return v;
}

/** A forced puppet shot always hands the next turn to its caster; rank only the caster's table. */
function puppetValue(ctx: Ctx, o: Outcome, owner: Side): number {
  if (o.res.winner !== null) return -1000;
  return tableEase(ctx, o.balls, o.state, owner);
}
