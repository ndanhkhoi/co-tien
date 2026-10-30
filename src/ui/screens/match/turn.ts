import type { Side } from '../../../core/rules/types';
import { champion } from '../../../game/content/sects';
import { h } from '../../dom';
import { hintTurn } from '../../hints';
import type { MatchCtx } from './context';
import type { MatchDom } from './dom';
import type { HeraldMsg } from './herald';
import { updateSpinDot } from './spin';
import type { Sheets } from './sheet';

interface TurnDeps {
  herald(m: HeraldMsg): void;
  coachTurn(): void;
  aimFirstTarget(): void;
  cancelCharge(): void;
  closeSheets(): void;
  aiTurn(): Promise<void>;
  openOption(): void;
  canAct(): boolean;
  openSkill(slot: number): void;
}

export function createTurn(ctx: MatchCtx, dom: MatchDom, sheets: Sheets, deps: TurnDeps): { turn(): void; hideNudge(): void; nudge(side: Side): void } {
  const nudgeApi = createNudge(ctx, dom, sheets, deps);
  return {
    turn: () => onTurn(ctx, dom, deps, nudgeApi.nudge),
    hideNudge: nudgeApi.hide,
    nudge: nudgeApi.nudge,
  };
}

function onTurn(ctx: MatchCtx, dom: MatchDom, deps: TurnDeps, nudge: (side: Side) => void): void {
  const { aim, flags, skill, match } = ctx;
  aim.elevation = 0;
  skill.pendingUltimate = null;
  flags.placeConfirmed = false;
  flags.placementAim = false;
  deps.cancelCharge();
  deps.closeSheets();
  flags.pushOut = false;
  flags.callPocket = null;
  flags.callBall = null;
  ctx.aiCall = null;
  ctx.firedCall = null;
  flags.targetIdx = -1;
  ctx.view.refreshCue();
  if (match.phase === 'option') return optionTurn(ctx, deps);
  if (match.phase !== 'aim') return;
  turnSide(ctx, dom, deps, nudge);
}

function optionTurn(ctx: MatchCtx, deps: TurnDeps): void {
  const { flags, match } = ctx;
  if (match.current.kind === 'ai') void deps.aiTurn();
  else setTimeout(() => !flags.disposed && deps.openOption(), 500);
}

function turnSide(ctx: MatchCtx, dom: MatchDom, deps: TurnDeps, nudge: (side: Side) => void): void {
  const { aim, power, flags, match } = ctx;
  const side = match.turn;
  const changed = flags.lastTurnSide !== side;
  flags.lastTurnSide = side;
  if (match.current.kind === 'ai') {
    void deps.aiTurn();
    return;
  }
  aim.side = 0;
  aim.vert = 0;
  power.heldPower = null;
  power.preset = power.presets[side];
  updateSpinDot(dom.spinDot, aim);
  deps.aimFirstTarget();
  announceTurn(ctx, deps, { side, changed });
  hintTurnApp(ctx);
  deps.coachTurn();
  if (ctx.hasSkills) nudgeIdle(ctx, nudge, side);
}

function announceTurn(ctx: MatchCtx, deps: TurnDeps, x: { side: Side; changed: boolean }): void {
  const { match, solo } = ctx;
  if (!match.canMoveCue) {
    if (x.changed && !solo) deps.herald({ side: x.side, title: `Lượt của ${match.setup.players[x.side].name}`, line: match.objective() });
    return;
  }
  const placingTitle = match.state.isBreak ? 'Đặt bi phá' : 'Đặt bi cái';
  deps.herald({ side: x.side, title: x.changed && !solo ? `Lượt của ${match.setup.players[x.side].name}` : placingTitle, line: `${placingTitle}: dời bi, Ngắm thử, rồi ĐẶT BI` });
}

function hintTurnApp(ctx: MatchCtx): void {
  hintTurn(ctx.app);
}

function nudgeIdle(ctx: MatchCtx, nudge: (side: Side) => void, side: Side): void {
  // Players used to plain billiards forget their kit: after a turn without casting,
  // point at a ready skill once the turn announcement has had its moment.
  const idle = ctx.turn.skillIdle[side]++;
  if (idle >= 1) setTimeout(() => nudge(side), 1900);
}

function createNudge(ctx: MatchCtx, dom: MatchDom, sheets: Sheets, deps: TurnDeps): {
  hide(): void; nudge(side: Side): void;
} {
  let timer = 0;
  const hide = () => {
    clearTimeout(timer);
    dom.skillNudge.classList.remove('show');
    dom.slots.forEach((s) => s.b.classList.remove('nudge'));
  };
  const nudge = (side: Side) => {
    if (ctx.flags.disposed || ctx.match.turn !== side || !deps.canAct() || sheets.skill) return;
    const ready = champion(ctx.match.setup.players[side].champion).skills.filter((sk) => ctx.match.canUseSkill(side, sk.slot));
    const sk = ready.find((x) => x.slot === 2) ?? ready[0];
    if (!sk) return;
    paintNudge(dom, sk);
    dom.skillNudge.onclick = () => {
      hide();
      deps.openSkill(sk.slot);
    };
    clearTimeout(timer);
    timer = window.setTimeout(hide, 4500);
  };
  return { hide, nudge };
}

function paintNudge(dom: MatchDom, sk: { name: string; slot: number }): void {
  const slot = dom.slots[sk.slot].b;
  dom.skillNudge.replaceChildren(h('b', null, sk.name), sk.slot === 2 ? 'Tuyệt chiêu sẵn sàng · chạm để dùng' : 'Chiêu sẵn sàng · chạm để dùng');
  dom.skillNudge.style.top = `${slot.offsetTop + dom.dock.offsetTop + slot.offsetHeight / 2}px`;
  dom.skillNudge.classList.add('show');
  slot.classList.add('nudge');
}
