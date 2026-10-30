import { sound } from '../../../audio/sound';
import { haptic } from '../../../platform/device';
import type { MatchCtx } from './context';
import type { MatchDom } from './dom';
import type { Sheets } from './sheet';

const DEG = Math.PI / 180;

interface ControlsDeps {
  canAct(): boolean;
  placingNow(): boolean;
  confirmPlace(): void;
  startCharge(): void;
  cancelCharge(): void;
  releaseCharge(): void;
  fireAtPreset(): void;
  rotate(deg: number): void;
  nudgeCue(dx: number, dy: number, metres: number): void;
  setPreset(v: number): void;
  canAdjustAim(): boolean;
  cancelPlacement(): void;
  toggleSense(): void;
  openPause(): void;
  back(): void;
  switchTarget(): void;
}

export function createControls(ctx: MatchCtx, dom: MatchDom, sheets: Sheets, deps: ControlsDeps): () => void {
  const detachKeys = attachKeys(ctx, sheets, deps);
  attachHoldButtons(ctx, dom, deps);
  attachPowerBar(ctx, dom, deps);
  attachStrike(ctx, dom, deps);
  return detachKeys;
}

function holdRepeat(ctx: MatchCtx, b: HTMLButtonElement, step: () => void, hold: (dt: number, t: number) => void): void {
  let id: number | null = null;
  let raf = 0;
  let t0 = 0;
  let last = 0;
  b.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || b.disabled || id !== null) return;
    sound.unlock();
    id = e.pointerId;
    b.setPointerCapture(id);
    b.classList.add('pressed');
    step();
    haptic(6);
    t0 = last = performance.now();
    const loop = () => {
      if (id === null || ctx.flags.disposed) return;
      const now = performance.now();
      const held = (now - t0) / 1000;
      if (held > 0.3) hold(Math.min(0.05, (now - last) / 1000), held - 0.3);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = null;
    cancelAnimationFrame(raf);
    b.classList.remove('pressed');
  };
  b.addEventListener('pointerup', end);
  b.addEventListener('pointercancel', end);
  b.addEventListener('lostpointercapture', end);
}

function attachHoldButtons(ctx: MatchCtx, dom: MatchDom, deps: ControlsDeps): void {
  // One tap = 0.1°; holding sweeps faster and faster.
  const rotRate = (t: number) => Math.min(40, 1 + 14 * t * t);
  holdRepeat(ctx, dom.rotL, () => deps.rotate(-0.1), (dt, t) => deps.rotate(-rotRate(t) * dt));
  holdRepeat(ctx, dom.rotR, () => deps.rotate(0.1), (dt, t) => deps.rotate(rotRate(t) * dt));
  // One tap = 3 mm; holding walks the ball, then runs.
  const walk = (t: number) => Math.min(0.6, 0.05 + 0.5 * t * t);
  holdRepeat(ctx, dom.upB, () => deps.nudgeCue(0, -1, 0.003), (dt, t) => deps.nudgeCue(0, -1, walk(t) * dt));
  holdRepeat(ctx, dom.downB, () => deps.nudgeCue(0, 1, 0.003), (dt, t) => deps.nudgeCue(0, 1, walk(t) * dt));
  holdRepeat(ctx, dom.leftB, () => deps.nudgeCue(-1, 0, 0.003), (dt, t) => deps.nudgeCue(-1, 0, walk(t) * dt));
  holdRepeat(ctx, dom.rightB, () => deps.nudgeCue(1, 0, 0.003), (dt, t) => deps.nudgeCue(1, 0, walk(t) * dt));
}

function attachPowerBar(ctx: MatchCtx, dom: MatchDom, deps: ControlsDeps): void {
  const { power } = ctx;
  let barId: number | null = null;
  // A tap sets the power where it lands; a drag fine-tunes from the current value at a
  // reduced rate (the full track height is worth about two thirds of the range).
  let barDrag: { y: number; from: number; moved: boolean } | null = null;
  const trackLevel = (e: PointerEvent) => {
    const r = dom.powerTrack.getBoundingClientRect();
    return 1 - (e.clientY - r.top) / r.height;
  };
  dom.powerBar.addEventListener('pointerdown', (e) => {
    if (!deps.canAct() || deps.placingNow() || power.charging || barId !== null) return;
    sound.unlock();
    barId = e.pointerId;
    dom.powerBar.setPointerCapture(barId);
    power.barActive = true;
    barDrag = { y: e.clientY, from: power.preset, moved: false };
  });
  dom.powerBar.addEventListener('pointermove', (e) => {
    if (e.pointerId !== barId || !barDrag || !deps.canAct()) return;
    const dy = e.clientY - barDrag.y;
    if (!barDrag.moved && Math.abs(dy) < 4) return;
    barDrag.moved = true;
    deps.setPreset(barDrag.from - dy / (dom.powerTrack.getBoundingClientRect().height * 1.5));
  });
  const barEnd = (e: PointerEvent) => {
    if (e.pointerId !== barId) return;
    if (barDrag && !barDrag.moved && e.type === 'pointerup' && deps.canAct()) deps.setPreset(trackLevel(e));
    barDrag = null;
    barId = null;
    power.barActive = false;
  };
  dom.powerBar.addEventListener('pointerup', barEnd);
  dom.powerBar.addEventListener('pointercancel', barEnd);
}

function attachStrike(ctx: MatchCtx, dom: MatchDom, deps: ControlsDeps): void {
  dom.strikeBtn.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !deps.canAct() || ctx.strikePress) return;
    sound.unlock();
    if (deps.placingNow()) {
      deps.confirmPlace();
      return;
    }
    ctx.strikePress = { id: e.pointerId, t0: performance.now() };
    dom.strikeBtn.setPointerCapture(e.pointerId);
    dom.strikeBtn.classList.add('pressed');
  });
  dom.strikeBtn.addEventListener('pointermove', (e) => strikeMove(ctx, dom, e));
  dom.strikeBtn.addEventListener('pointerup', (e) => strikeUp(ctx, dom, deps, e));
  dom.strikeBtn.addEventListener('pointercancel', () => deps.cancelCharge());
}

function strikeMove(ctx: MatchCtx, dom: MatchDom, e: PointerEvent): void {
  if (!ctx.strikePress || e.pointerId !== ctx.strikePress.id) return;
  const r = dom.strikeBtn.getBoundingClientRect();
  const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
  const armed = d > Math.max(r.width, r.height) * 1.1;
  if (armed !== ctx.cancelArmed) {
    ctx.cancelArmed = armed;
    dom.strikeBtn.classList.toggle('cancel', armed);
    dom.setStrikeAction(armed ? 'cancel' : 'strike');
    haptic(12);
  }
}

function strikeUp(ctx: MatchCtx, dom: MatchDom, deps: ControlsDeps, e: PointerEvent): void {
  if (!ctx.strikePress || e.pointerId !== ctx.strikePress.id) return;
  ctx.strikePress = null;
  dom.strikeBtn.classList.remove('pressed');
  if (ctx.power.charging) deps.releaseCharge();
  else if (ctx.cancelArmed) deps.cancelCharge();
  else deps.fireAtPreset();
  ctx.cancelArmed = false;
  dom.strikeBtn.classList.remove('cancel');
}

function attachKeys(ctx: MatchCtx, sheets: Sheets, deps: ControlsDeps): () => void {
  const canvas = ctx.app.pixi.canvas;
  const onKey = (e: KeyboardEvent) => keyEvent({ ctx, sheets, deps, e });
  const onWheel = (e: WheelEvent) => {
    if (!deps.canAdjustAim()) return;
    ctx.aim.angle += Math.sign(e.deltaY) * 0.06 * DEG;
  };
  // Rotating to portrait or squeezing the window hides the table: pause instead of playing blind.
  const onBlocked = () => {
    if (!ctx.flags.disposed && !ctx.flags.paused && ctx.match.phase !== 'match-over') deps.openPause();
  };
  window.addEventListener('cotien:blocked', onBlocked);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  canvas.addEventListener('wheel', onWheel, { passive: true });
  return () => {
    window.removeEventListener('cotien:blocked', onBlocked);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    canvas.removeEventListener('wheel', onWheel);
  };
}



function keyEvent(x: { ctx: MatchCtx; sheets: Sheets; deps: ControlsDeps; e: KeyboardEvent }): void {
  const { ctx, sheets, deps, e } = x;
  const target = e.target as HTMLElement | null;
  if (target?.closest('input, textarea, select, [contenteditable=true]')) return;
  if (sheets.skill || sheets.spin || ctx.flags.paused || document.querySelector('.modal-wrap')) {
    if (e.type === 'keydown' && e.code === 'Escape') deps.back();
    return;
  }
  if (e.type !== 'keydown') {
    if (e.code === 'Space') deps.releaseCharge();
    return;
  }
  keyDown(x);
}

function keyDown(x: { ctx: MatchCtx; deps: ControlsDeps; e: KeyboardEvent }): void {
  const { ctx, deps, e } = x;
  if (placementKey({ ctx, deps, e })) return;
  if (e.code.startsWith('Arrow') && deps.canAct()) e.preventDefault();
  actionKey(x);
  moveKey(x);
  if (e.code === 'Tab' && deps.canAct()) {
    e.preventDefault();
    deps.switchTarget();
  }
  if (e.code === 'Escape') deps.back();
}

function placementKey(x: { ctx: MatchCtx; deps: ControlsDeps; e: KeyboardEvent }): boolean {
  const { skill } = x.ctx;
  if (!skill.placement) return false;
  if (x.e.code === 'Escape') x.deps.cancelPlacement();
  else if (x.e.code === 'KeyR') x.deps.toggleSense();
  else return false;
  return true;
}

function actionKey(x: { ctx: MatchCtx; deps: ControlsDeps; e: KeyboardEvent }): void {
  const { deps, e } = x;
  const { power } = x.ctx;
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) {
      if (deps.placingNow()) deps.confirmPlace();
      else deps.startCharge();
    }
  }
  if (e.code === 'Enter' && !e.repeat) {
    if (deps.placingNow()) deps.confirmPlace();
    else if (!power.charging) deps.fireAtPreset();
  }
}

function moveKey(x: { ctx: MatchCtx; deps: ControlsDeps; e: KeyboardEvent }): void {
  const { flags, skill, power } = x.ctx;
  const fine = x.e.shiftKey ? 0.05 : 0.5;
  if (x.deps.placingNow() && (!flags.placementAim || skill.placement)) arrowPlace(x.deps, x.e);
  else arrowAim({ deps: x.deps, e: x.e, fine, preset: power.preset });
}

function arrowPlace(deps: ControlsDeps, e: KeyboardEvent): void {
  const m = e.shiftKey ? 0.002 : 0.01;
  if (e.code === 'ArrowLeft') deps.nudgeCue(-1, 0, m);
  if (e.code === 'ArrowRight') deps.nudgeCue(1, 0, m);
  if (e.code === 'ArrowUp') deps.nudgeCue(0, -1, m);
  if (e.code === 'ArrowDown') deps.nudgeCue(0, 1, m);
}

function arrowAim(x: { deps: ControlsDeps; e: KeyboardEvent; fine: number; preset: number }): void {
  const { deps, e, fine } = x;
  if (e.code === 'ArrowLeft') deps.rotate(-fine);
  if (e.code === 'ArrowRight') deps.rotate(fine);
  if (e.code === 'ArrowUp' && deps.canAct()) deps.setPreset(x.preset + 0.05);
  if (e.code === 'ArrowDown' && deps.canAct()) deps.setPreset(x.preset - 0.05);
}

