import { cloneBalls, step, type PhysEvent } from '../core/physics';
import { predictAim, type AimPrediction } from '../core/aim';
import { Sprite } from 'pixi.js';
import type { Match } from '../game/match';
import type { MetreGraphics } from './frame-diff';
import type { AimView } from './table-view';

type Prediction = AimPrediction;
export function drawCue(sprites: { cue: Sprite; shadow: Sprite }, aim: AimView, cue: { x: number; y: number }, R: number): void {
  const dx = Math.cos(aim.angle);
  const dy = Math.sin(aim.angle);
  sprites.cue.visible = sprites.shadow.visible = aim.showCue;
  if (!aim.showCue) return;
  const gap = R * 1.1 + aim.pull * 0.22 * (1 - aim.strike) - aim.strike * R * 0.1;
  const ox = cue.x - dx * gap + (-dy) * aim.side * R * 0.5;
  const oy = cue.y - dy * gap + dx * aim.side * R * 0.5;
  sprites.cue.position.set(ox, oy);
  sprites.cue.rotation = aim.angle + Math.PI;
  sprites.shadow.position.set(ox + R * 0.5, oy + R * 0.9);
  sprites.shadow.rotation = sprites.cue.rotation;
}

export function drawAimLock(m: Match, g: MetreGraphics, aim: AimView): void {
  const cue = m.cueBall();
  // Fixed direction, live force/spin: show the two physical launch boundaries.
  const band = m.aimLock!.band;
  for (const sign of [-1, 1]) {
    const probe = { ...cue };
    m.strikePreview(probe, { angle: m.aimLock!.angle + sign * band, power: aim.power, side: aim.side, vert: aim.vert, elevation: aim.elevation, call: null, pushOut: false });
    const length = Math.hypot(probe.vx, probe.vy) || 1;
    g.moveTo(cue.x, cue.y).lineTo(cue.x + probe.vx / length * 0.65, cue.y + probe.vy / length * 0.65);
    g.stroke({ width: 1, color: 0xffffff, alpha: 0.4 });
  }
}

export function hasPathPreview(m: Match): boolean {
  return m.eagle || m.sight || m.passiveInfo || m.activeEffects.some(e => e.target === m.turn);
}

function aimDirection(aim: AimView): { dx: number; dy: number } {
  return { dx: Math.cos(aim.angle), dy: Math.sin(aim.angle) };
}

export function drawEagleReference(m: Match, g: MetreGraphics, aim: AimView, cue: { x: number; y: number }): void {
  const dx = Math.cos(aim.angle);
  const dy = Math.sin(aim.angle);
  const R = m.table.R;
  // The simulated paths follow the chosen power, spin and terrain, so they move when the
  // power changes. Keep the straight aim to the ghost ball as a fixed reference beneath
  // them; otherwise a power change reads as the aim itself drifting.
  const ref = predictAim({ table: m.table, balls: m.balls, cueId: m.cueId(), angle: aim.angle, extraSegments: m.obstacles() });
  g.moveTo(cue.x + dx * R, cue.y + dy * R).lineTo(ref.gx - dx * R, ref.gy - dy * R).stroke({ width: 1, color: 0xffffff, alpha: 0.45 });
  g.circle(ref.gx, ref.gy, R).stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
}

export function drawJumpPath(m: Match, g: MetreGraphics, aim: AimView, cue: { x: number; y: number; id: number }): void {
  // A jump cannot use the planar ghost-ball ray: trace a short physical trajectory.
  const balls = cloneBalls(m.balls);
  const probe = balls.find(b => b.id === cue.id)!;
  m.strikePreview(probe, { angle: aim.angle, power: aim.power, side: aim.side, vert: aim.vert, elevation: aim.elevation, call: null, pushOut: false });
  const world = { ...m.simulationWorld(), balls };
  g.moveTo(cue.x, cue.y);
  for (let i = 0; i < 24; i++) {
    const events: PhysEvent[] = [];
    step(world, 1 / 120, events);
    if (!probe.onTable) break;
    g.lineTo(probe.x, probe.y - (probe.z ?? 0) * 0.7);
    if (events.some(e => e.t === 'ball' || e.t === 'cushion')) break;
  }
  g.stroke({ width: 1.6, color: 0xffffff, alpha: 0.65 });
}

export function drawShotHint(m: Match, g: MetreGraphics, aim: AimView, cue: { x: number; y: number }): void {
  const { dx, dy } = aimDirection(aim);
  const R = m.table.R;
  // Line to the first thing the cue ball meets and the ghost ball there, plus a short
  // chevron hint of where the object ball leaves: enough to read the cut, never a full path.
  const pred = predictAim({ table: m.table, balls: m.balls, cueId: m.cueId(), angle: aim.angle, extraSegments: m.obstacles() });
  const legal = m.legalTargets();
  const illegal = pred.hitBall !== null && legal.length > 0 && !legal.includes(pred.hitBall) && !m.state.pushOutAvailable;
  if (drawFogHint(g, aim, { cue, dx, dy }, pred)) return;
  g.moveTo(cue.x + dx * R, cue.y + dy * R).lineTo(pred.gx - dx * R, pred.gy - dy * R).stroke({ width: 1.6, color: 0xffffff, alpha: 0.85 });
  g.circle(pred.gx, pred.gy, R).stroke({ width: 1.6, color: illegal ? 0xff4d4d : 0xffffff, alpha: 0.9 });
  if (illegal) {
    drawIllegalMark(g, pred.gx, pred.gy, R);
    return;
  }
  drawCuePath(m, g, aim, pred);
  if (!decoysAim(m)) drawObjectHint(m, g, aim, pred);
}

/** Đất Dắt: keep the intended line, then mark the unavoidable rotation in vermilion. */
export function drawDriftNote(m: Match, g: MetreGraphics, aim: AimView): void {
  if (!m.driftNow) return;
  const cue = m.cueBall();
  const x = cue.x + Math.cos(aim.angle + m.driftNow * Math.PI / 180) * 0.45;
  const y = cue.y + Math.sin(aim.angle + m.driftNow * Math.PI / 180) * 0.45;
  g.circle(x, y, 0.012).stroke({ width: 2, color: 0xb03522, alpha: 0.9 });
}

function drawFogHint(g: MetreGraphics, aim: AimView, aimLine: { cue: { x: number; y: number }; dx: number; dy: number }, pred: Prediction): boolean {
  if (!aim.fog) return false;
  // Fog: the line fades out before reaching anything, no ghost ball.
  const maxLen = 0.35 + 0.5 * aim.guideScale;
  const { cue, dx, dy } = aimLine;
  const dist = Math.hypot(pred.gx - cue.x, pred.gy - cue.y);
  if (dist <= maxLen) return false;
  g.moveTo(cue.x + dx * 0.028575, cue.y + dy * 0.028575);
  g.lineTo(cue.x + dx * maxLen, cue.y + dy * maxLen);
  g.stroke({ width: 1.6, color: 0xffffff, alpha: 0.6 });
  return true;
}

function drawIllegalMark(g: MetreGraphics, x: number, y: number, R: number): void {
  const sx = R * 0.55;
  g.moveTo(x - sx, y - sx).lineTo(x + sx, y + sx).moveTo(x + sx, y - sx).lineTo(x - sx, y + sx).stroke({ width: 2, color: 0xff4d4d });
}

function drawCuePath(m: Match, g: MetreGraphics, aim: AimView, pred: Prediction): void {
  if (!pred.cueDir) return;
  // Show the tangent after a cut, or the rebound after first meeting a cushion.
  const { x: ux, y: uy } = pred.cueDir;
  const R = m.table.R;
  const len = R * (4 + 3 * aim.guideScale);
  g.moveTo(pred.gx + ux * R, pred.gy + uy * R)
    .lineTo(pred.gx + ux * len, pred.gy + uy * len)
    .stroke({ width: 1.6, color: 0xffffff, alpha: 0.65 });
}

/** Bi Giả hides the real object-ball route; the cue guide remains readable. */
function decoysAim(m: Match): boolean {
  return m.activeEffects.some((e) => e.kind === 'decoy' && (e.target === m.turn || e.target === 'both'));
}

function drawObjectHint(m: Match, g: MetreGraphics, aim: AimView, pred: Prediction): void {
  const obj = pred.hitBall !== null ? m.balls.find((b) => b.id === pred.hitBall) : null;
  if (!obj || !pred.objDir) return;
  const ux = pred.objDir.x;
  const uy = pred.objDir.y;
  const R = m.table.R;
  const n = aim.guideScale >= 1 ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const d = R * (1.55 + i * 0.95);
    const tipX = obj.x + ux * (d + R * 0.32);
    const tipY = obj.y + uy * (d + R * 0.32);
    const bx = obj.x + ux * d;
    const by = obj.y + uy * d;
    const w = R * 0.5;
    g.moveTo(bx - uy * w, by + ux * w).lineTo(tipX, tipY).lineTo(bx + uy * w, by - ux * w)
      .stroke({ width: 2.2, color: 0xffc531, alpha: 0.95 - i * 0.22, cap: 'round', join: 'round' });
  }
}
