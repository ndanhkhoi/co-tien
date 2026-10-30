import { sound } from '../../../audio/sound';
import { haptic } from '../../../platform/device';
import { h, uiOrigin, uiScale } from '../../dom';
import type { MatchCtx } from './context';
import type { MatchDom } from './dom';

type Ball = ReturnType<MatchCtx['match']['cueBall']>;

export interface TableInputDeps {
  canAct(): boolean;
  canAdjustAim(): boolean;
  placingNow(): boolean;
  renderHud(): void;
  aimAt(b: { x: number; y: number }): void;
  targetList(): Ball[];
  showBallTag(id: number): void;
}

export function createTableInput(ctx: MatchCtx, dom: MatchDom, deps: TableInputDeps): { down(e: PointerEvent): void; move(e: PointerEvent): void; up(e: PointerEvent): void; dispose(): void; showBallTag(id: number): void } {
  const { aim, flags, match, view, skill } = ctx;
  const canvas = ctx.app.pixi.canvas;
  let drag: { id: number; mode: 'aim' | 'cue'; sx: number; sy: number; lastA: number; moved: boolean; cue0: { x: number; y: number }; p0: { x: number; y: number } } | null = null;
  let ballTagTimer = 0;

  const down = (e: PointerEvent) => {
    sound.unlock();
    if (!flags.paused && !drag && dom.desk?.down(e)) return;
    if (!deps.canAct() || ctx.power.charging || drag) return;
    const p = view.toTable(e.clientX, e.clientY);
    if (skill.placement) skill.moveCast(p.x, p.y);
    if (pocketOrBallCall(ctx, p, deps)) return;
    const cue = match.cueBall();
    drag = {
      id: e.pointerId, mode: deps.placingNow() && (!flags.placementAim || skill.placement) ? 'cue' : 'aim',
      sx: e.clientX, sy: e.clientY, moved: false,
      lastA: Math.atan2(p.y - cue.y, p.x - cue.x), cue0: { x: cue.x, y: cue.y }, p0: p,
    };
    canvas.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (dom.desk?.move(e)) return;
    if (!drag || e.pointerId !== drag.id || !deps.canAct()) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    drag.moved = true;
    const p = view.toTable(e.clientX, e.clientY);
    if (skill.placement) {
      skill.moveCast(p.x, p.y);
      return;
    }
    if (drag.mode === 'cue') {
      // The ball keeps its offset from the finger, so the finger never hides it.
      match.placeCue(drag.cue0.x + p.x - drag.p0.x, drag.cue0.y + p.y - drag.p0.y);
      return;
    }
    aimAroundCue(p);
  };
  const up = (e: PointerEvent) => {
    if (dom.desk?.up(e)) return;
    if (drag?.id !== e.pointerId) return;
    drag = null;
    tapBall(ctx, e, deps);
  };
  const aimAroundCue = (p: { x: number; y: number }) => {
    // Relative dial around the cue ball: the cue turns by the finger's angle change, and
    // gears down further away from the ball for precise adjustments.
    const cue = match.cueBall();
    const a = Math.atan2(p.y - cue.y, p.x - cue.x);
    const rpx = Math.hypot(p.x - cue.x, p.y - cue.y) * view.pxPerM;
    if (rpx > 22 && drag) {
      const da = Math.atan2(Math.sin(a - drag.lastA), Math.cos(a - drag.lastA));
      const k = Math.max(0.35, Math.min(1, 1 - (rpx - 150) / 450));
      aim.angle += da * k;
    }
    if (drag) drag.lastA = a;
  };
const showBallTag = (id: number) => showBallTagIn(ctx, dom, id, (t) => {
    clearTimeout(ballTagTimer);
    ballTagTimer = t;
  });
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  return { down, move, up, showBallTag, dispose: () => {
    clearTimeout(ballTagTimer);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  } };
}

function tapBall(ctx: MatchCtx, e: PointerEvent, deps: TableInputDeps): void {
  if (!deps.canAdjustAim()) return;
  const { match, view, flags } = ctx;
  const p = view.toTable(e.clientX, e.clientY);
  const cue = match.cueBall();
  const grab = Math.max(match.table.R * 1.8, 16 / view.pxPerM);
  const hit = match.balls
    .filter((b) => b.onTable && b.id !== cue.id && Math.hypot(p.x - b.x, p.y - b.y) < grab)
    .sort((a, b) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y))[0];
  if (hit) {
    deps.aimAt(hit);
    deps.showBallTag(hit.id);
    const list = deps.targetList();
    flags.targetIdx = Math.max(-1, list.findIndex((b) => b.id === hit.id));
    haptic(8);
  } else if (Math.hypot(p.x - cue.x, p.y - cue.y) > match.table.R * 1.5) {
    deps.aimAt(p);
  }
}

function pocketOrBallCall(ctx: MatchCtx, p: { x: number; y: number }, input: {
  placingNow(): boolean; renderHud(): void;
}): boolean {
  const { match, flags } = ctx;
  const t = match.table;
  // Pocket call taps first.
  if (match.callType() !== 'none' && !input.placingNow()) {
    const hit = t.pockets.findIndex((pk, i) => !match.closedPockets.includes(i) && Math.hypot(p.x - pk.hx, p.y - pk.hy) < pk.hr * 1.6);
    if (hit >= 0) {
      flags.callPocket = hit;
      haptic(10);
      sound.tap();
      input.renderHud();
      return true;
    }
  }
  if (match.callType() === 'ball-pocket' && !input.placingNow()) {
    const hitBall = match.balls.find((b) => b.onTable && b.id !== match.cueId() && Math.hypot(p.x - b.x, p.y - b.y) < t.R * 1.6);
    if (hitBall) {
      flags.callBall = hitBall.id;
      input.renderHud();
    }
  }
  return false;
}

/** A tapped ball names itself for a moment, just above it on the cloth. */
function showBallTagIn(ctx: MatchCtx, dom: MatchDom, id: number, setTimer: (timer: number) => void): void {
  const { match, view } = ctx;
  const b = match.balls.find((x) => x.id === id);
  if (!b) return;
  const k = uiScale();
  const at = view.toScreen(b.x, b.y);
  const rect = uiOrigin();
  const label = id === match.cueId() ? 'Bi cái' : match.isCarom ? (id === 2 ? 'Bi đỏ' : 'Bi đối thủ') : `Bi ${id}`;
  dom.ballTag.replaceChildren(h('img.mx-bt-ball', { src: view.ballPortrait(id, 40), alt: '' }), h('span', null, label));
  dom.ballTag.style.left = `${(at.x - rect.left) / k}px`;
  dom.ballTag.style.top = `${(at.y - rect.top) / k - match.table.R * view.pxPerM / k - 6}px`;
  dom.ballTag.classList.remove('show');
  void dom.ballTag.offsetWidth;
  dom.ballTag.classList.add('show');
  setTimer(window.setTimeout(() => dom.ballTag.classList.remove('show'), 1400));
}
