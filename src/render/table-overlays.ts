import type { AimView } from './table-view';
import type { MetreGraphics } from './frame-diff';
import type { Match } from '../game/match';
import { controllerIsHuman } from '../game/match/controller';

export interface OverlayView {
  guide: MetreGraphics;
  overlay: MetreGraphics;
  match: Match;
  calledShot: { ball: number | null; pocket: number } | null;
  goal: { pocket?: number; zone?: [number, number, number] } | null;
  time: number;
}

export function drawOverlay(v: OverlayView, aim: AimView | null): void {
  const { overlay: g } = v;
  g.clear();
  drawGoal(v);
  drawBomb(v);
  drawCalledShot(v);
  drawCalledBall(v);
  if (!aim) return;
  drawBallInHand(v);
  if (aim.pocketChoices) drawPocketChoices(v);
}

function drawGoal(v: OverlayView): void {
  if (!v.goal) return;
  const g = v.overlay;
  const t = v.match.table;
  const pulse = 0.5 + 0.5 * Math.sin(v.time * 4);
  if (v.goal.pocket !== undefined) {
    const p = t.pockets[v.goal.pocket];
    g.circle(p.hx, p.hy, p.hr * (1.05 + pulse * 0.12)).stroke({ width: 3, color: 0xb03522, alpha: 0.6 + pulse * 0.4 });
  }
  if (v.goal.zone) {
    const [zx, zy, zr] = v.goal.zone;
    g.circle(zx, zy, zr).fill({ color: 0x3ddc84, alpha: 0.13 + pulse * 0.07 });
    g.circle(zx, zy, zr).stroke({ width: 2, color: 0x8af5b8, alpha: 0.8 });
  }
}

function drawBomb(v: OverlayView): void {
  const m = v.match;
  if (m.bombId < 0 || m.bombUsed) return;
  const b = m.balls.find((x) => x.id === m.bombId);
  if (!b || !b.onTable) return;
  const g = v.overlay;
  const R = m.table.R;
  const pulse = 0.5 + 0.5 * Math.sin(v.time * 7);
  g.circle(b.x, b.y, R * (1.35 + pulse * 0.25)).stroke({ width: 2, color: 0xff3b30, alpha: 0.55 + pulse * 0.4 });
  g.circle(b.x, b.y - R * 1.1, R * 0.22).fill({ color: 0xffd34d, alpha: 0.6 + pulse * 0.4 });
}

function drawCalledShot(v: OverlayView): void {
  const cs = v.calledShot;
  if (!cs) return;
  const g = v.overlay;
  const { match: m, time } = v;
  const t = m.table;
  const pulse = 0.5 + 0.5 * Math.sin(time * 6);
  if (cs.pocket >= 0) drawCalledPocket(v, cs.pocket, pulse);
  if (cs.ball === null) return;
  const b = m.balls.find((x) => x.id === cs.ball);
  if (b && b.onTable) g.circle(b.x, b.y, t.R * (1.3 + pulse * 0.12)).stroke({ width: 2.5, color: 0xb03522, alpha: 0.9 });
}

function drawCalledBall(v: OverlayView): void {
  const id = v.match.calledNow ?? v.match.calledPreview;
  if (id === null) return;
  const b = v.match.balls.find((x) => x.id === id);
  if (!b?.onTable) return;
  const pulse = 0.5 + 0.5 * Math.sin(v.time * 6);
  v.overlay.circle(b.x, b.y, v.match.table.R * (1.3 + pulse * 0.12))
    .stroke({ width: 2.5, color: 0xb03522, alpha: 0.88 });
}

function drawCalledPocket(v: OverlayView, pocket: number, pulse: number): void {
  const p = v.match.table.pockets[pocket];
  const g = v.overlay;
  g.circle(p.hx, p.hy, p.hr * (1.02 + pulse * 0.1)).stroke({ width: 3.5, color: 0xb03522, alpha: 0.95 });
  g.circle(p.hx, p.hy, p.hr * (1.3 + pulse * 0.25)).stroke({ width: 2, color: 0xb03522, alpha: 0.5 * (1 - pulse) + 0.15 });
}

function drawBallInHand(v: OverlayView): void {
  const { overlay: g, match: m, time } = v;
  const t = m.table;
  if (!m.canMoveCue || !controllerIsHuman(m)) return;
  if (m.placing === 'kitchen') {
    g.rect(-t.L / 2, -t.W / 2, t.L / 4, t.W).fill({ color: 0xffffff, alpha: 0.05 });
    g.moveTo(t.headStringX, -t.W / 2).lineTo(t.headStringX, t.W / 2).stroke({ width: 1.5, color: 0xffffff, alpha: 0.35 });
  }
  if (m.placing === 'nudge' && m.nudgeOrigin) {
    g.circle(m.nudgeOrigin.x, m.nudgeOrigin.y, 0.12).stroke({ width: 1.5, color: 0x7fd6ff, alpha: 0.7 });
  }
  const c = m.cueBall();
  const pulse = 0.5 + 0.5 * Math.sin(time * 5);
  g.circle(c.x, c.y, t.R * (1.6 + pulse * 0.3)).stroke({ width: 2, color: 0xffffff, alpha: 0.4 + pulse * 0.4 });
}

function drawPocketChoices(v: OverlayView): void {
  const { overlay: g, match: m } = v;
  m.table.pockets.forEach((p, i) => {
    if (m.closedPockets.includes(i) || v.calledShot?.pocket === i) return;
    g.circle(p.hx, p.hy, p.hr * 0.9).stroke({ width: 1.5, color: 0xffffff, alpha: 0.35 });
  });
}
