import { applySkillBlast } from '../game/skill-cast';
import { cloneBalls, step, type Ball, type PhysEvent, type SimWorld } from '../core/physics';
import type { Match } from '../game/match';
import type { MetreGraphics } from './frame-diff';
import type { AimView } from './table-view';

/** One simulated shot of a path preview, advanced a slice at a time. */
export interface EagleRun {
  world: SimWorld;
  cue: Ball;
  angle: number;
  paths: Map<number, number[]>;
  frames: number;
  blastDone: boolean;
  done: boolean;
}

/** Physics time a path preview may take per frame (ms), so aiming stays smooth while it builds. */
const EAGLE_BUDGET_MS = 4;

/** Thần Nhãn: simulate the exact shot and draw every moving ball's path. */
export function drawEagle(m: Match, guide: MetreGraphics, state: { key: string; runs: EagleRun[] } | null, aim: AimView): { key: string; runs: EagleRun[] } {
  const w = m.simulationWorld();
  // Everything the preview depends on; the table and cloth constants are fixed for the match.
  const key = eagleKey(m, aim, w);
  const current = state?.key === key ? state : { key, runs: makeRuns(m, aim, w) };
  const deadline = performance.now() + EAGLE_BUDGET_MS;
  for (const run of current.runs) {
    while (!run.done && performance.now() < deadline) stepEagle(m, run);
  }
  drawRuns(m, guide, current.runs);
  return current;
}

function eagleKey(m: Match, aim: AimView, w: SimWorld): string {
  return `${m.sight}|${m.triplePreview}|${m.previewSpread}|${m.passiveInfo}|${aim.angle.toFixed(4)}|${aim.power.toFixed(2)}|${aim.side.toFixed(2)}|${aim.vert.toFixed(2)}|${(aim.elevation ?? 0).toFixed(3)}|${m.balls.map((b) => b.onTable ? `${b.x.toFixed(3)},${b.y.toFixed(3)}` : '-').join(';')}|${JSON.stringify([w.terrain, w.extraSegments, w.closedPockets, w.captureScale, w.pocketPull, w.pullExempt, m.blast])}`;
}

function makeRuns(m: Match, aim: AimView, w: SimWorld): EagleRun[] {
  return (m.triplePreview ? [-m.previewSpread, 0, m.previewSpread] : [0]).map((offset): EagleRun => {
    const balls = cloneBalls(m.balls);
    const cue = balls.find((b) => b.id === m.cueId())!;
    const power = Math.max(0.05, Math.min(1, aim.power + offset));
    m.strikePreview(cue, { angle: aim.angle, power, side: Math.max(-1, Math.min(1, aim.side + offset)), vert: Math.max(-1, Math.min(1, aim.vert - offset)), elevation: aim.elevation, call: null, pushOut: false });
    const paths = new Map<number, number[]>();
    for (const b of balls) paths.set(b.id, [b.x, b.y]);
    return { world: { ...w, balls }, cue, angle: aim.angle, paths, frames: 0, blastDone: false, done: false };
  });
}

function drawRuns(m: Match, g: MetreGraphics, runs: EagleRun[]): void {
  for (const run of runs) {
    for (const [id, pts] of run.paths) {
      if (pts.length <= 4) continue;
      // The rest mark only once the ball has really stopped there.
      if (run.done) g.circle(pts[pts.length - 2], pts[pts.length - 1], m.table.R * 0.55).stroke({ width: 1, color: 0xffffff, alpha: 0.7 });
      g.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.stroke({ width: 1.6, color: id === m.cueId() ? 0xffffff : 0xffd34d, alpha: 0.75 });
    }
  }
}

/** One 1/30 s slice of a path preview, recording where every ball goes. */
function stepEagle(m: Match, run: EagleRun): void {
  const balls = run.world.balls;
  const events: PhysEvent[] = [];
  const moving = step(run.world, 1 / 30, events);
  applyBlast(m, run, events, balls);
  recordPaths(run, balls);
  if (!moving || ++run.frames >= 600) run.done = true;
}

function applyBlast(m: Match, run: EagleRun, events: PhysEvent[], balls: Ball[]): void {
  if (!m.blast || run.blastDone) return;
  const contact = events.find(e => e.t === 'ball' && (e.a === run.cue.id || e.b === run.cue.id));
  if (!contact || contact.t !== 'ball') return;
  const direction = m.blast.direction ? { x: Math.cos(run.angle), y: Math.sin(run.angle) } : undefined;
  applySkillBlast(balls, contact.x, contact.y, m.blast.radius, m.blast.force, direction);
  run.blastDone = true;
}

function recordPaths(run: EagleRun, balls: Ball[]): void {
  for (const b of balls) {
    const p = run.paths.get(b.id)!;
    if (b.onTable && (p[p.length - 2] !== b.x || p[p.length - 1] !== b.y)) p.push(b.x, b.y);
  }
}
