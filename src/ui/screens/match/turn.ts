import type { Side } from '../../../core/rules/types';
import { hintTurn } from '../../hints';
import type { MatchCtx } from './context';
import type { MatchDom } from './dom';
import type { HeraldMsg } from './herald';
import { updateSpinDot } from './spin';
import { controllerIsHuman, controllerPlayer, puppetHeraldLine, shotController } from './controller';
import type { Sheets } from './sheet';
import { createSkillNudge } from './skill-nudge';

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

export function createTurn(ctx: MatchCtx, dom: MatchDom, sheets: Sheets, deps: TurnDeps): { turn(): void; hideNudge(): boolean; nudge(side: Side): void } {
  const nudgeApi = createSkillNudge(ctx, dom, sheets, deps);
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
  if (!controllerIsHuman(match)) void deps.aiTurn();
  else setTimeout(() => !flags.disposed && deps.openOption(), 500);
}

function turnSide(ctx: MatchCtx, dom: MatchDom, deps: TurnDeps, nudge: (side: Side) => void): void {
  const { aim, power, flags, match } = ctx;
  const side = shotController(match);
  const changed = flags.lastTurnSide !== side;
  flags.lastTurnSide = side;
  if (!controllerIsHuman(match)) {
    void deps.aiTurn();
    return;
  }
  announcePuppet(ctx, deps, match.turn);
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

function announcePuppet(ctx: MatchCtx, deps: TurnDeps, shooter: Side): void {
  const line = puppetHeraldLine(ctx.match);
  if (line === null) return;
  deps.herald({ side: ctx.match.puppeteer, expr: 'cast', icon: 'thinking', title: 'Khuynh thành', line: `${line} (bi cái của ${ctx.match.setup.players[shooter].name})`, ms: 3400 });
}

function announceTurn(ctx: MatchCtx, deps: TurnDeps, x: { side: Side; changed: boolean }): void {
  const { match, solo } = ctx;
  if (!match.canMoveCue) {
    if (x.changed && !solo) deps.herald({ side: x.side, title: `Lượt của ${controllerPlayer(match).name}`, line: match.objective() });
    return;
  }
  const placingTitle = match.state.isBreak ? 'Đặt bi phá' : 'Đặt bi cái';
  deps.herald({ side: x.side, title: x.changed && !solo ? `Lượt của ${controllerPlayer(match).name}` : placingTitle, line: `${placingTitle}: dời bi, Ngắm thử, rồi ĐẶT BI` });
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
