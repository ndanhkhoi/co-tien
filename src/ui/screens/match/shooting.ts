import { champion } from '../../../game/content/sects';
import type { ShotCall, Side } from '../../../core/rules/types';
import { sound } from '../../../audio/sound';
import { haptic } from '../../../platform/device';
import { playCutIn } from '../../skill-cutin';
import type { MatchCtx } from './context';
import type { MatchDom } from './dom';
import { callBallId } from './hud';
import type { HeraldMsg } from './herald';
import type { Sleep } from './timing';

export type FireArgs = [angle: number, pw: number, side: number, vert: number, aiShotCall?: ShotCall | null];

interface ShootingDeps {
  canAct(): boolean;
  placingNow(): boolean;
  closeSheets(): void;
  renderControls(): void;
  renderHud(): void;
  herald(m: HeraldMsg): void;
  setFocus(side: Side, on: boolean): void;
  wobbleAmp(): number;
  wobbleNow(): number;
  sleep(ms: number): Promise<void>;
}

export function createShooting(ctx: MatchCtx, dom: MatchDom, deps: ShootingDeps): {
  readyToShoot(): boolean;
  confirmPlace(): void;
  startCharge(): void;
  cancelCharge(): void;
  releaseCharge(): void;
  fireAtPreset(): void;
  fire(angle: number, pw: number, side: number, vert: number, aiShotCall?: ShotCall | null): Promise<void>;
} {
  const { aim, power, flags, match, rng, skill } = ctx;
  const readyToShoot = () => readyToShootIn(ctx, deps);
  const confirmPlace = () => {
    if (!deps.placingNow()) return;
    if (skill.placement) {
      const { side, slot, cast } = skill.placement;
      if (slot === -1) match.useGuard(cast); else match.useSkill(side, slot, cast);
      clearPlacement(ctx, dom, deps);
      return;
    }
    flags.placeConfirmed = true;
    haptic(15);
    sound.tap();
  };
  const charge = createCharge(ctx, dom, deps);
  const fireAtPreset = () => {
    if (!readyToShoot()) return;
    power.power = power.preset;
    power.holdT = 0;
    const amp = deps.wobbleAmp();
    const ph = rng.next() * Math.PI * 2;
    const w = amp * (0.62 * Math.sin(ph) + 0.38 * Math.sin(ph * 1.8 + 1.7));
    shootWith(aim.angle + w + rng.gauss() * amp * 0.3, power.preset);
  };
  const shootWith = (angle: number, pw: number) => {
    const err = 0.012 + 0.008 * (5 - match.current.cue.control);
    const finalPower = Math.max(0.01, Math.min(1, pw * (1 + rng.gauss() * err)));
    fireInternal(angle, finalPower, aim.side, aim.vert);
  };
  const fireInternal = (...args: FireArgs) => fireShot(ctx, deps, { angle: args[0], pw: args[1], spinSide: args[2], vert: args[3], aiShotCall: args[4] });
  return { readyToShoot, confirmPlace, ...charge, fireAtPreset, fire: fireInternal };
}

function clearPlacement(ctx: MatchCtx, dom: MatchDom, deps: ShootingDeps): void {
  ctx.skill.placement = null;
  ctx.match.castPreview = [];
  dom.cancelCast.hidden = true;
  dom.castSense.hidden = true;
  deps.renderHud();
}

async function playUltimate(ctx: MatchCtx, sleep: Sleep, ultimate: MatchCtx['skill']['pendingUltimate']): Promise<void> {
  if (!ultimate) return;
  const { view, flags, renderState } = ctx;
  renderState.cutIn = playCutIn(champion(ultimate.champion), ultimate.skill, ultimate.side === 1);
  await sleep(1500);
  renderState.cutIn.remove();
  renderState.cutIn = null;
  if (flags.disposed) return;
  view.skillFx(ultimate.champion, ultimate.skill, ultimate.side);
  haptic([30, 40, 60]);
  await sleep(900);
}

function chooseCall(ctx: MatchCtx, aiShotCall: ShotCall | null | undefined): ShotCall | null {
  const { match, flags } = ctx;
  if (aiShotCall !== undefined) return aiShotCall;
  if (match.callType() === 'none') return null;
  return { ball: callBallId(ctx) ?? 8, pocket: flags.callPocket ?? 0 };
}


function createCharge(ctx: MatchCtx, dom: MatchDom, deps: ShootingDeps): {
  startCharge(): void; cancelCharge(): void; releaseCharge(): void;
} {
  const { power, match } = ctx;
  const startCharge = () => {
    if (!deps.canAct() || deps.placingNow()) return;
    power.charging = true;
    power.chargeT = 0;
    power.holdT = 0;
    power.power = 0;
    ctx.cancelArmed = false;
    dom.strikeBtn.classList.add('charging');
    deps.setFocus(match.turn, true);
  };
  const cancelCharge = () => {
    if (power.charging) deps.setFocus(match.turn, false);
    power.charging = false;
    power.power = 0;
    ctx.strikePress = null;
    dom.strikeBtn.classList.remove('charging', 'cancel', 'pressed');
    deps.renderControls();
  };
  const releaseCharge = () => release(ctx, dom, deps, cancelCharge);
  return { startCharge, cancelCharge, releaseCharge };
}

function release(ctx: MatchCtx, dom: MatchDom, deps: ShootingDeps, cancelCharge: () => void): void {
  const { aim, power, rng, match } = ctx;
  if (!power.charging) return;
  dom.strikeBtn.classList.remove('charging', 'pressed');
  if (ctx.cancelArmed || power.power < 0.02) {
    cancelCharge();
    return;
  }
  const amp = deps.wobbleAmp();
  const finalAngle = aim.angle + deps.wobbleNow() + rng.gauss() * amp * 0.3;
  power.charging = false;
  deps.setFocus(match.turn, false);
  shootWith(ctx, deps, finalAngle, power.power);
}

function shootWith(ctx: MatchCtx, deps: ShootingDeps, angle: number, pw: number): void {
  const { aim, rng, match } = ctx;
  const err = 0.012 + 0.008 * (5 - match.current.cue.control);
  const finalPower = Math.max(0.01, Math.min(1, pw * (1 + rng.gauss() * err)));
  void fireShot(ctx, deps, { angle, pw: finalPower, spinSide: aim.side, vert: aim.vert });
}

async function fireShot(ctx: MatchCtx, deps: ShootingDeps, x: {
  angle: number; pw: number; spinSide: number; vert: number; aiShotCall?: ShotCall | null;
}): Promise<void> {
  const { aim, power, flags, match, skill } = ctx;
  if (flags.presenting || flags.disposed || flags.paused || match.phase !== 'aim') return;
  flags.presenting = true;
  deps.closeSheets();
  deps.renderControls();
  const ultimate = skill.pendingUltimate;
  skill.pendingUltimate = null;
  await playUltimate(ctx, deps.sleep, ultimate);
  if (flags.disposed) return;
  power.strikePull = x.pw;
  power.strikeT = 0.0001;
  if (match.current.kind === 'human') power.presets[match.turn] = power.preset;
  const call = chooseCall(ctx, x.aiShotCall);
  ctx.firedCall = call;
  ctx.aiCall = null;
  const input = { angle: x.angle, power: x.pw, side: x.spinSide, vert: x.vert,
    elevation: x.aiShotCall !== undefined ? 0 : aim.elevation, call, pushOut: flags.pushOut };
  deps.renderControls();
  // Let the cue travel through before the ball moves.
  void deps.sleep(70).then(() => {
    if (flags.disposed) return;
    match.shoot(input);
    flags.presenting = false;
    flags.pushOut = false;
    flags.callPocket = null;
  });
}


function readyToShootIn(ctx: MatchCtx, deps: ShootingDeps): boolean {
  const { match, flags } = ctx;
  if (!deps.canAct() || deps.placingNow()) return false;
  if (match.callType() === 'none' || flags.callPocket !== null) return true;
  deps.herald({ side: null, icon: 'target', tone: 'red', title: 'Chưa gọi lỗ',
    line: match.callType() === 'ball-pocket' ? 'Chạm bi muốn gọi, rồi chạm một lỗ trên bàn' : 'Chạm một lỗ trên bàn để gọi trước khi đánh' });
  haptic([20, 40, 20]);
  return false;
}
